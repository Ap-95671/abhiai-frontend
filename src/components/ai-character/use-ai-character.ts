"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSpeechPlayback } from "@/components/voice/use-speech-playback";
import { transition, upsertMessage, type AssistantMessage, type VoiceConnectionState } from "./assistant-state";
import { RealtimeVoice } from "./realtime-voice";

export function useAiCharacter(token: string, visible: boolean, userId: string) {
  const [character, dispatch] = useReducer(transition, "idle");
  const [connection, setConnection] = useState<VoiceConnectionState>("disconnected");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [unsaved, setUnsaved] = useState(false);
  const voice = useRef<RealtimeVoice | null>(null);
  const history = useRef<AssistantMessage[]>([]);
  const dirty = useRef(new Set<string>());
  const saved = useRef(new Set<string>());
  const voiceItems = useRef(new Set<string>());
  const saving = useRef<Promise<void> | null>(null);
  const id = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  const shown = useRef(visible);
  const sending = useRef(false);
  const textAbort = useRef<AbortController | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const speech = useSpeechPlayback();
  const { stop: stopSpeech } = speech;

  const replace = useCallback((items: AssistantMessage[]) => {
    history.current = items;
    if (mounted.current) setMessages(items);
  }, []);
  const flush = useCallback(async function flushPending(): Promise<void> {
    if (saving.current) { await saving.current; return flushPending(); }
    if (!id.current) return;
    // Never persist an assistant response ahead of a delayed user transcription.
    const eligible: AssistantMessage[] = [];
    for (const item of history.current) {
      if (!item.final) break;
      if (dirty.current.has(item.id) && item.content) eligible.push(item);
      if (eligible.length === 40) break;
    }
    if (!eligible.length) return;
    const conversation = id.current;
    const work = api.saveAssistantTranscript(token, conversation, eligible).then(() => {
      eligible.forEach(item => { dirty.current.delete(item.id); saved.current.add(item.id); });
      if (mounted.current) setUnsaved(dirty.current.size > 0);
    }).catch(() => {
      if (mounted.current) { setUnsaved(true); setError("Some messages haven’t saved yet. Retry saving before continuing or leaving this page."); }
      throw new Error("Transcript has not saved yet. Retry when your connection is back.");
    });
    saving.current = work;
    try { await work; } finally { saving.current = null; }
    if (eligible.length === 40) await flushPending();
  }, [token]);
  const receive = useCallback((message: AssistantMessage) => {
    voiceItems.current.add(message.id);
    replace(upsertMessage(history.current, message));
    if (message.final && !saved.current.has(message.id)) dirty.current.add(message.id);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush().catch(() => {}); }, 350);
  }, [flush, replace]);
  const finalizeVoice = useCallback(() => {
    // A closed connection cannot deliver its remaining transcription events.
    replace(history.current.map(message => {
      if (message.final || !voiceItems.current.has(message.id)) return message;
      const finalized = { ...message, final: true, content: message.role === "USER"
        ? message.content || "[Voice input ended before transcription completed]"
        : "[AbhiAI’s response was interrupted before it finished.]", interrupted: true };
      dirty.current.add(message.id);
      return finalized;
    }));
    void flush().catch(() => {});
  }, [flush, replace]);
  const endVoice = useCallback(() => {
    voice.current?.close(); voice.current = null;
    finalizeVoice(); stopSpeech();
  }, [finalizeVoice, stopSpeech]);
  const initialize = useCallback(async (fresh = false) => {
    setLoading(true); setError("");
    try {
      if (fresh) { endVoice(); await flush(); }
      const conversation = await api.openAssistant(token, fresh);
      if (!mounted.current) return;
      id.current = conversation.id; setConversationId(conversation.id);
      dirty.current.clear(); saved.current.clear(); setUnsaved(false);
      replace(conversation.messages.filter(message => message.role !== "SYSTEM").map(message => ({
        id: message.id, role: message.role as "USER" | "ASSISTANT", content: message.content, final: true,
      })));
      dispatch("settle");
    } catch { if (mounted.current) { setError("Your assistant conversation could not load. Please retry."); dispatch("fail"); } }
    finally { if (mounted.current) setLoading(false); }
  }, [token, endVoice, flush, replace]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      void initialize();
      try { setAutoSpeak(localStorage.getItem(`abhiai.assistant.auto-speak.${userId}`) !== "off"); } catch {}
    });
    return () => {
      active = false; mounted.current = false;
      textAbort.current?.abort(); endVoice(); clearTimeout(saveTimer.current);
    };
  }, [initialize, endVoice, userId]);
  useEffect(() => {
    shown.current = visible;
    if (!visible) endVoice();
  }, [visible, endVoice]);
  useEffect(() => {
    const hide = () => { if (document.hidden) endVoice(); };
    const leave = () => endVoice();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", leave); };
  }, [endVoice]);
  const previousSpeech = useRef(speech.status);
  useEffect(() => {
    if (speech.status === "playing") dispatch("speak");
    else if (previousSpeech.current === "playing" && !busy && !microphone) dispatch("settle");
    previousSpeech.current = speech.status;
  }, [speech.status, busy, microphone]);

  async function send(content: string) {
    if (!id.current || sending.current || busy || !content.trim()) return false;
    sending.current = true; setError("");
    let realtimeTurn = false;
    try {
      if (voice.current?.connected) { realtimeTurn = true; voice.current.sendText(content.trim()); return true; }
      endVoice();
      await flush();
      stopSpeech(); setBusy(true); dispatch("think");
      const user: AssistantMessage = { id: crypto.randomUUID(), role: "USER", content: content.trim(), final: true };
      const reply: AssistantMessage = { id: crypto.randomUUID(), role: "ASSISTANT", content: "", final: false };
      const before = history.current;
      replace([...before, user, reply]);
      const controller = new AbortController(); textAbort.current = controller;
      const timeout = setTimeout(() => controller.abort(), 125000);
      try {
        const exchange = await api.sendMessageStream(token, id.current, content.trim(), chunk => {
          if (controller.signal.aborted || !mounted.current) return;
          reply.content += chunk;
          replace(upsertMessage(history.current, { ...reply }));
        }, controller.signal);
        replace([...before, { ...user, id: exchange.userMessage.id }, {
          ...reply, id: exchange.assistantMessage.id, content: exchange.assistantMessage.content, final: true,
        }]);
        if (autoSpeak && shown.current && !document.hidden) speech.play(exchange.assistantMessage.id, exchange.assistantMessage.content);
      } catch (failure) {
        // Losing the SSE completion event does not prove that the server transaction rolled back.
        // Refresh authoritative history before the user decides whether to resend the retained draft.
        try {
          const persisted = await api.getConversation(token, id.current, AbortSignal.timeout(15000));
          replace(persisted.messages.filter(message => message.role !== "SYSTEM").map(message => ({
            id: message.id, role: message.role as "USER" | "ASSISTANT", content: message.content, final: true,
          })));
        } catch { replace(before); }
        throw failure;
      } finally { clearTimeout(timeout); }
      dispatch("settle"); return true;
    } catch { setError("Your response was interrupted or could not be saved. Check the conversation before retrying your message."); dispatch("fail"); return false; }
    finally { sending.current = false; if (!realtimeTurn) setBusy(false); textAbort.current = null; }
  }
  async function toggleMicrophone() {
    setError(""); stopSpeech();
    if (microphone) { voice.current?.stopMicrophone(); return; }
    if (voice.current?.connected) { await voice.current.startMicrophone(); return; }
    if (!id.current || busy || loading) return;
    try { await flush(); } catch { return; }
    voice.current?.close();
    const client = new RealtimeVoice(token, {
      connection: state => {
        setConnection(state);
        if (state === "disconnected" || state === "expired") finalizeVoice();
      }, character: dispatch, microphone: setMicrophone, busy: setBusy,
      message: receive, level: setLevel, error: message => { setError(message); dispatch("fail"); },
    });
    voice.current = client;
    await client.connect(id.current, history.current, autoSpeak);
  }
  function toggleAutoSpeak() {
    const next = !autoSpeak; setAutoSpeak(next); voice.current?.setAutoSpeak(next);
    if (!next) stopSpeech();
    try { localStorage.setItem(`abhiai.assistant.auto-speak.${userId}`, next ? "on" : "off"); } catch {}
  }
  function interrupt() { stopSpeech(); voice.current?.interrupt(); dispatch(microphone ? "listen" : "settle"); }
  return { character, connection, messages, conversationId, loading, busy, microphone, level, error, autoSpeak, unsaved,
    speechSupported: speech.supported, send, toggleMicrophone, toggleAutoSpeak, interrupt, endVoice, initialize,
    retrySave: () => { setError(""); void flush().catch(() => {}); },
    enableAudio: () => voice.current?.enableAudio(),
    play: (message: AssistantMessage) => { voice.current?.stopMicrophone(); voice.current?.interrupt(); speech.play(message.id, message.content); },
  };
}
