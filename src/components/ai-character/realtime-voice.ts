import { toolLabels, type AssistantToolResult, type AssistantEvent } from "./tool-types";
import { api, ApiError } from "@/lib/api";
import { AudioMeter } from "./audio-meter";
import { encodePcm, decodePcm } from "./pcm-audio";
import { realtimeHistory, type AssistantMessage, type CharacterEvent, type VoiceConnectionState } from "./assistant-state";

type GeminiEvent = {
  toolCall?: { functionCalls?: { id: string; name: string; args?: Record<string, string> }[] };
  toolCallCancellation?: { ids?: string[] };
  setupComplete?: object; error?: object; goAway?: object;
  serverContent?: {
    interrupted?: boolean; turnComplete?: boolean; generationComplete?: boolean;
    inputTranscription?: { text?: string; finished?: boolean };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: { text?: string; thought?: boolean; inlineData?: { data: string; mimeType: string } }[] };
  };
};
export type VoiceCallbacks = {
  connection(state: VoiceConnectionState): void; character(event: CharacterEvent): void;
  microphone(active: boolean): void; busy(value: boolean): void; message(message: AssistantMessage): void;
  level(value: number): void; error(message: string): void;
  tool?(name: string, args: Record<string,string>, signal: AbortSignal): Promise<AssistantToolResult>;
  event?(event: AssistantEvent): void;
  newTurn?(): void;
};

/** One disposable Gemini Live socket. Permanent provider credentials never enter this class. */
export class RealtimeVoice {
  private socket: WebSocket | null = null;
  private microphone: MediaStream | null = null;
  private context: AudioContext | null = null;
  private capture: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private output: MediaStreamAudioDestinationNode | null = null;
  private meter: AudioMeter | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private playAt = 0;
  private abort = new AbortController();
  private closed = false;
  private ready = false;
  private micPending = false;
  private sessionId: string | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private idleTimer?: ReturnType<typeof setTimeout>;
  private responseTimer?: ReturnType<typeof setTimeout>;
  private setupTimer?: ReturnType<typeof setTimeout>;
  private idleSeconds = 120;
  private autoSpeak = true;
  private generating = false;
  private turnDone = false;
  private suppressOutput = false;
  private user: AssistantMessage | null = null;
  private assistant: AssistantMessage | null = null;
  private receiveQueue = Promise.resolve();
  private history: AssistantMessage[] = [];
  private toolRequests = new Map<string, AbortController>();
  private toolCount = 0;
  private contextRevision = 0;
  constructor(private token: string, private callbacks: VoiceCallbacks) {}
  static supported() {
    return typeof WebSocket !== "undefined" && typeof AudioContext !== "undefined"
      && typeof AudioWorkletNode !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
  }
  get connected() { return this.ready && !this.closed; }
  private later(callback: () => void, milliseconds: number) {
    const timer = setTimeout(() => { this.timers.delete(timer); callback(); }, milliseconds);
    this.timers.add(timer); return timer;
  }
  private clear(timer?: ReturnType<typeof setTimeout>) {
    if (timer) { clearTimeout(timer); this.timers.delete(timer); }
  }
  private activity() {
    this.clear(this.idleTimer);
    this.idleTimer = this.later(() => {
      if (this.generating || this.sources.size) this.activity();
      else this.fail("Voice paused after inactivity. Tap the microphone to reconnect.");
    }, this.idleSeconds * 1000);
  }
  private send(event: object) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error("Voice is disconnected. Continue by text or reconnect.");
    if (this.socket.bufferedAmount > 256000) { this.fail("Voice connection is too slow. Reconnect or continue by text."); return; }
    this.socket.send(JSON.stringify(event));
  }
  async connect(conversationId: string, history: AssistantMessage[], autoSpeak: boolean) {
    if (!RealtimeVoice.supported()) { this.fail("Live voice is unavailable in this browser. You can continue by text."); return; }
    this.autoSpeak = autoSpeak; this.history = history;
    this.callbacks.connection("connecting");
    try {
      this.setupTimer = this.later(() => this.fail("Voice took too long to connect. Please retry or use text."), 30000);
      this.context = new AudioContext();
      void this.enableAudio();
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (this.closed) { mic.getTracks().forEach(track => track.stop()); return; }
      this.microphone = mic;
      await this.context.audioWorklet.addModule("/audio/assistant-capture.js");
      if (this.closed) return;
      this.output = this.context.createMediaStreamDestination();
      this.meter = new AudioMeter(this.context, level => this.callbacks.level(this.autoSpeak && this.sources.size ? level : 0));
      this.meter.attach(this.output.stream);
      this.sessionId = crypto.randomUUID();
      const session = await api.createAssistantSession(this.token, { id: this.sessionId, conversationId }, this.abort.signal);
      if (this.closed) return;
      this.idleSeconds = session.idleSeconds;
      this.later(() => { this.close(); this.callbacks.connection("expired"); this.callbacks.error("Voice session ended. Tap the microphone to reconnect to the same conversation."); }, Math.max(0, Date.parse(session.expiresAt) - Date.now()));
      // Short-lived, single-use token only. Never persist it or log the socket URL.
      this.socket = new WebSocket("wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(session.token));
      this.socket.onopen = () => {
        if (!this.closed) this.send({ setup: { model: "models/" + session.model } });
      };
      this.socket.onmessage = event => {
        // Gemini may deliver JSON as Blob. Serialize decoding to preserve chunk ordering.
        this.receiveQueue = this.receiveQueue.then(async () => {
          if (this.closed) return;
          const raw = typeof event.data === "string" ? event.data : await event.data.text();
          if (!this.closed) this.handle(JSON.parse(raw) as GeminiEvent);
        }).catch(() => { if (!this.closed) this.fail("Gemini Live sent an unreadable response. Continue by text or reconnect."); });
      };
      this.socket.onerror = () => this.fail("Gemini Live could not connect. Check Live API access and try again, or use text.");
      this.socket.onclose = event => { if (!this.closed) this.fail(event.code === 1008
        ? "Gemini Live rejected the session. Check your Gemini key, model access, and quota."
        : "Gemini Live disconnected. Tap the microphone to reconnect or continue by text."); };
    } catch (error) {
      if (this.closed) return;
      const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
      this.fail(name === "NotAllowedError" ? "Microphone access is disabled. Enable it in browser settings or continue using text chat."
        : name === "NotFoundError" || name === "NotReadableError" ? "No available microphone was found. Check your audio device or continue by text."
        : error instanceof ApiError ? error.message : "Gemini Live could not connect. Check your connection and try again, or continue by text.");
    }
  }
  private attachMicrophone() {
    if (!this.context || !this.microphone) return;
    this.source = this.context.createMediaStreamSource(this.microphone);
    this.capture = new AudioWorkletNode(this.context, "assistant-capture");
    this.capture.port.onmessage = event => {
      if (!this.connected || !this.microphone || !this.context) return;
      this.send({ realtimeInput: { audio: { data: encodePcm(event.data as Float32Array, this.context.sampleRate), mimeType: "audio/pcm;rate=16000" } } });
    };
    this.source.connect(this.capture); this.capture.connect(this.context.destination);
    this.microphone.getAudioTracks()[0].onended = () => { if (!this.closed) this.stopMicrophone(); };
    this.callbacks.microphone(true); this.callbacks.character("listen");
  }
  private newMessage(role: "USER" | "ASSISTANT"): AssistantMessage {
    return { id: crypto.randomUUID(), role, content: "", final: false };
  }
  private emit(message: AssistantMessage) { this.callbacks.message({ ...message }); }
  private watchResponse() {
    this.clear(this.responseTimer);
    this.responseTimer = this.later(() => this.fail("Gemini Live did not finish responding. Reconnect or continue by text."), 60000);
  }
  private stopAudio() {
    this.sources.forEach(source => { source.onended = null; source.stop(); source.disconnect(); });
    this.sources.clear(); this.playAt = 0; this.callbacks.level(0);
  }
  private finalizeInterrupted() {
    this.stopAudio();
    if (this.assistant && !this.assistant.final) {
      this.assistant = { ...this.assistant, content: "[AbhiAI’s spoken response was interrupted; the unplayed response is omitted.]", final: true, interrupted: true };
      this.emit(this.assistant);
    }
    this.assistant = null; this.generating = false; this.clear(this.responseTimer); this.settle();
  }
  private settle() {
    const busy = this.generating || this.sources.size > 0;
    this.callbacks.busy(busy);
    if (!busy) this.callbacks.character(this.microphone ? "listen" : "settle");
  }
  private finishTurn() {
    if (!this.turnDone || this.sources.size) return;
    if (this.assistant && !this.assistant.final) {
      this.assistant.final = true;
      if (!this.assistant.content) this.assistant.content = "[Spoken response transcript unavailable]";
      this.emit(this.assistant);
    }
    this.assistant = null; this.generating = false; this.settle();
  }
  private play(data: string, mimeType: string) {
    if (!this.context || !this.autoSpeak || this.suppressOutput) return;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
    if (rate < 8000 || rate > 48000 || !mimeType.startsWith("audio/pcm")) throw new Error("Unsupported audio");
    const samples = decodePcm(data);
    if (!samples.length) return;
    const buffer = this.context.createBuffer(1, samples.length, rate); buffer.copyToChannel(samples, 0);
    const source = this.context.createBufferSource(); source.buffer = buffer;
    source.connect(this.context.destination); if (this.output) source.connect(this.output);
    this.playAt = Math.max(this.context.currentTime + 0.02, this.playAt);
    if (this.playAt - this.context.currentTime > 60) { this.fail("Audio playback fell behind. Enable audio and reconnect."); return; }
    this.sources.add(source);
    source.onended = () => { source.disconnect(); this.sources.delete(source); this.finishTurn(); };
    source.start(this.playAt); this.playAt += buffer.duration;
    this.callbacks.character("speak"); this.callbacks.busy(true);
  }
  private cancelTools(ids?: string[]) {
    for (const [id, controller] of this.toolRequests) {
      if (!ids || ids.includes(id)) { controller.abort(); this.toolRequests.delete(id); }
    }
    this.callbacks.event?.({ status: "" });
  }
  private async runTool(call: { id: string; name: string; args?: Record<string,string> }) {
    if (this.toolRequests.has(call.id)) return;
    const controller = new AbortController(); this.toolRequests.set(call.id, controller);
    const timeout = this.later(() => controller.abort(), 20000);
    const revision = this.contextRevision;
    try {
      if (++this.toolCount > 8 || !this.callbacks.tool) throw new Error("Tools unavailable");
      this.generating = true; this.callbacks.busy(true); this.callbacks.character("think"); this.watchResponse();
      this.callbacks.event?.({ status: toolLabels[call.name] ?? "Reading current content…" });
      const result = await this.callbacks.tool(call.name,call.args ?? {},controller.signal);
      if (!this.connected || revision !== this.contextRevision || !this.toolRequests.has(call.id)) return;
      if (controller.signal.aborted) throw new Error("Tool timed out");
      this.callbacks.event?.({ result, expression: result.expression, status: "" });
      this.send({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { result } }] } });
    } catch {
      if (this.connected && this.toolRequests.has(call.id) && revision === this.contextRevision) {
        const message = "This tool or content is unavailable, or access was denied. You can still chat.";
        this.callbacks.event?.({ notice: message, status: "" });
        this.send({ toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { error: message } }] } });
      }
    } finally { this.clear(timeout); this.toolRequests.delete(call.id); }
  }
  updateContext() {
    this.contextRevision++; this.cancelTools(); this.interrupt();
    if (this.connected) this.send({ clientContent: { turns: [{ role: "user", parts: [{ text: JSON.stringify({
      contextRevision: this.contextRevision, pageStatus: "changed; previous page context is obsolete; retrieve current context before the next answer"
    }) }] }], turnComplete: false } });
  }
  private handle(event: GeminiEvent) {
    if (event.toolCallCancellation) this.cancelTools(event.toolCallCancellation.ids);
    if (event.toolCall?.functionCalls) {
      if (event.toolCall.functionCalls.length > 8) { this.fail("Too many tool requests. Continue by text."); return; }
      for (const call of event.toolCall.functionCalls) void this.runTool(call);
    }
    if (event.error) { this.fail("Gemini Live encountered a problem. Check Gemini quota or continue by text."); return; }
    if (event.goAway) { this.fail("Gemini Live session is ending. Tap the microphone to reconnect with your saved conversation."); return; }
    if (event.setupComplete) {
      this.clear(this.setupTimer);
      const turns = realtimeHistory(this.history); this.history = [];
      if (turns.length) this.send({ clientContent: { turns, turnComplete: false } });
      this.ready = true; this.callbacks.connection("connected"); this.attachMicrophone(); this.activity();
    }
    const content = event.serverContent;
    if (!content) return;
    if (content.interrupted) { this.cancelTools(); this.finalizeInterrupted(); this.suppressOutput = false; }
    if (content.inputTranscription?.text) {
      this.activity(); this.watchResponse();
      if (!this.user || this.user.final) { this.callbacks.newTurn?.(); this.toolCount = 0; this.user = this.newMessage("USER"); this.turnDone = false; }
      this.user.content += content.inputTranscription.text; this.emit(this.user);
      this.callbacks.character("think");
    }
    // Input transcription is independent of model output. Keep its stable placeholder
    // open until transcription finishes or the turn ends; model chunks must not split it.
    if (this.user && !this.user.final && (content.inputTranscription?.finished || content.turnComplete)) {
      this.user.final = true;
      this.user.content ||= "[Voice input could not be transcribed]";
      this.emit(this.user);
    }
    if (!this.suppressOutput && (content.outputTranscription || content.modelTurn)) {
      this.activity(); this.watchResponse();
      if (!this.assistant) {
        if (!this.user || (this.user.final && this.turnDone)) {
          this.user = this.newMessage("USER"); this.emit(this.user);
        }
        this.assistant = this.newMessage("ASSISTANT"); this.emit(this.assistant);
      }
      this.generating = true; this.turnDone = false;
      if (content.outputTranscription?.text) { this.assistant.content += content.outputTranscription.text; this.emit(this.assistant); }
      for (const part of content.modelTurn?.parts ?? []) {
        if (part.inlineData) this.play(part.inlineData.data, part.inlineData.mimeType);
      }
      this.callbacks.busy(true);
      if (!this.sources.size) this.callbacks.character("think");
    }
    if (content.turnComplete) {
      this.clear(this.responseTimer); this.turnDone = true; this.generating = false;
      this.suppressOutput = false; this.finishTurn(); this.activity();
    }
  }
  sendText(content: string) {
    this.cancelTools(); this.callbacks.newTurn?.(); this.toolCount = 0; this.interrupt(); this.suppressOutput = false;
    this.user = { ...this.newMessage("USER"), content, final: true }; this.emit(this.user);
    this.send({ clientContent: { turns: [{ role: "user", parts: [{ text: content }] }], turnComplete: true } });
    this.generating = true; this.turnDone = false;
    this.callbacks.busy(true); this.callbacks.character("think"); this.activity(); this.watchResponse();
  }
  setAutoSpeak(value: boolean) {
    this.autoSpeak = value;
    if (!value) { this.stopAudio(); this.finishTurn(); if (this.generating) this.callbacks.character("think"); else this.settle(); }
    // Native-audio models always generate audio; Auto Speak controls local playback only.
  }
  async enableAudio() {
    try { await this.context?.resume(); }
    catch { if (!this.closed) this.callbacks.error("Audio is blocked. Press Enable audio, or turn Auto Speak off."); }
  }
  interrupt() {
    this.cancelTools();
    if (!this.connected || (!this.generating && !this.sources.size)) return;
    // Any clientContent message interrupts Gemini generation; false avoids requesting a new answer.
    this.send({ clientContent: { turnComplete: false } });
    this.suppressOutput = true; this.finalizeInterrupted();
  }
  stopMicrophone() {
    this.capture?.port.close(); this.capture?.disconnect(); this.source?.disconnect();
    this.capture = null; this.source = null;
    this.microphone?.getTracks().forEach(track => { track.onended = null; track.stop(); }); this.microphone = null;
    if (this.connected) this.send({ realtimeInput: { audioStreamEnd: true } });
    this.callbacks.microphone(false); this.settle();
  }
  async startMicrophone() {
    if (!this.connected || this.microphone || this.micPending) return;
    this.micPending = true;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (this.closed) { mic.getTracks().forEach(track => track.stop()); return; }
      this.microphone = mic; this.attachMicrophone(); this.activity();
    } catch { this.stopMicrophone(); if (!this.closed) this.callbacks.error("Microphone could not start. Enable access or continue by text."); }
    finally { this.micPending = false; }
  }
  private fail(message: string) { this.close(); this.callbacks.character("fail"); this.callbacks.error(message); }
  close() {
    if (this.closed) return;
    this.cancelTools(); this.closed = true; this.ready = false; this.abort.abort(); this.finalizeInterrupted();
    if (this.user && !this.user.final) { this.user.final = true; this.user.content ||= "[Voice input ended before transcription completed]"; this.emit(this.user); }
    this.timers.forEach(timer => clearTimeout(timer)); this.timers.clear(); this.stopMicrophone();
    if (this.socket) { this.socket.onmessage = null; this.socket.onopen = null; this.socket.onclose = null; this.socket.onerror = null; this.socket.close(); }
    this.meter?.stop(); this.output?.disconnect();
    void this.context?.close().catch(() => {});
    if (this.sessionId) void api.closeAssistantSession(this.token, this.sessionId).catch(() => {});
    this.socket = null; this.context = null; this.output = null; this.meter = null;
    this.callbacks.level(0); this.callbacks.busy(false); this.callbacks.character("settle"); this.callbacks.connection("disconnected");
  }
}
