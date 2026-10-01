"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Room } from "livekit-client";
import { api, ApiError } from "@/lib/api";
import styles from "./assistant.module.css";

export type AvatarPlayback = {
  speak(messageId: string): Promise<boolean>;
  audio(data: string, mime: string): boolean;
  finishAudio(): void;
  interrupt(): void;
  listen(value: boolean): void;
};
/** Optional presentation sink: never receives questions, prompts, tools or conversation history. */
export function AstraLiveAvatar({ token, conversationId, visible, route, playback, children, listening }: {
  token: string; conversationId?: string; visible: boolean; route: string; listening: boolean;
  playback: RefObject<AvatarPlayback | null>; children: ReactNode;
}) {
  const scope = `${route}:${conversationId}`;
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const enabled = activeScope === scope;
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!enabled || !visible || !conversationId) return;
    let disposed = false, ready = false, revision = 0;
    let phase = "session creation";
    let room: Room | undefined, socket: WebSocket | undefined;
    let readyTimer: ReturnType<typeof setTimeout>;
    const send = (type: string, audio?: string, event_id = crypto.randomUUID()) => {
      if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 8000000) throw new Error("Avatar unavailable");
      socket.send(JSON.stringify({ type, event_id, ...(audio ? { audio } : {}) }));
    };
    const repeatAudio = (audio: string) => {
      const binary = atob(audio), eventId = crypto.randomUUID();
      for (let i=0;i<binary.length;i+=48000) send("agent.speak", btoa(binary.slice(i,i+48000)), eventId);
      send("agent.speak_end", undefined, eventId);
    };
    let audioParts: string[] = [], audioBytes = 0;
    let pending: AbortController | undefined;
    const id = crypto.randomUUID();
    let idle: ReturnType<typeof setTimeout>;
    const release = () => {
      ready = false; playback.current = null; revision++; pending?.abort();
      clearTimeout(idle); audioParts = []; audioBytes = 0;
      clearTimeout(readyTimer); socket?.close(); void room?.disconnect();
      void api.closeLiveAvatar(token, id).catch(() => {});
    };
    const fail = (failure?: unknown) => {
      if (process.env.NODE_ENV === "development") {
        // Never log the raw exception: SDK errors can contain session URLs/tokens.
        console.warn("[Astra LiveAvatar]", phase, "failed", failure instanceof ApiError ? `HTTP ${failure.status}` : "");
      }
      release();
      if (!disposed) { setError("Astra couldn't start the live avatar. Try again, or continue with standard voice."); setActiveScope(null); }
    };
    const activity = () => { clearTimeout(idle); idle = setTimeout(() => { release(); if (!disposed) setActiveScope(null); }, 120000); };
    const interrupt = () => {
      revision++; pending?.abort(); audioParts = []; audioBytes = 0;
      if (ready) { try { send("agent.interrupt"); } catch { fail(); } setStatus("Ready"); activity(); }
    };
    setStatus("Connecting Astra…"); setError("");
    const hide = () => { if (document.hidden) { release(); setActiveScope(null); } };
    window.addEventListener("pagehide", release); document.addEventListener("visibilitychange", hide);
    void (async () => {
      const { Room, RoomEvent } = await import("livekit-client");
      if (disposed) return;
      const credentials = await api.createLiveAvatar(token, { id, conversationId });
      if (disposed) { void api.closeLiveAvatar(token,id).catch(() => {}); return; }
      phase = "WebRTC connection";
      room = new Room({ adaptiveStream: true });
      room.on(RoomEvent.TrackSubscribed, track => { if (!disposed && video.current) { track.attach(video.current); void video.current.play().catch(() => setError("Tap the avatar to enable audio.")); } });
      room.on(RoomEvent.Disconnected, () => { if (ready && !disposed) fail(); });
      await room.connect(credentials.livekitUrl, credentials.livekitToken);
      if (disposed) { release(); return; }
      phase = "avatar control connection";
      await new Promise<void>((resolve, reject) => {
        readyTimer = setTimeout(() => reject(new Error("Avatar timed out")), 30000);
        socket = new WebSocket(credentials.wsUrl);
        socket.onerror = () => { reject(new Error("Avatar disconnected")); if (ready) fail(); };
        socket.onclose = () => { reject(new Error("Avatar disconnected")); if (ready && !disposed) fail(); };
        socket.onmessage = event => {
          if (disposed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "session.state_updated" && data.state === "connected") { clearTimeout(readyTimer); resolve(); }
            if (data.type === "agent.speak_started") { setStatus("Speaking"); activity(); }
            if (data.type === "agent.speak_ended") { setStatus("Ready"); activity(); }
            if (data.type === "error") { reject(new Error("Avatar unavailable")); fail(); }
          } catch { reject(new Error("Avatar unavailable")); fail(); }
        };
      });
      if (disposed) { release(); return; }
      phase = "avatar stream/audio";
      ready = true; setStatus("Ready"); activity();
      playback.current = {
        interrupt,
        listen(value) { if (ready) { try { send(value ? "agent.start_listening" : "agent.stop_listening"); setStatus(value ? "Listening" : "Ready"); } catch { fail(); } } },
        audio(data, mime) {
          if (!ready || !/^audio\/pcm;rate=24000/.test(mime)) return false;
          const bytes = atob(data); audioBytes += bytes.length;
          if (audioBytes > 48000 * 90) { interrupt(); fail(); return false; }
          audioParts.push(bytes); activity(); return true;
        },
        finishAudio() {
          if (!ready || !audioParts.length) return;
          try { repeatAudio(btoa(audioParts.join(""))); activity(); }
          catch { fail(); }
          audioParts = []; audioBytes = 0;
        },
        async speak(messageId) {
          if (!ready) return false;
          interrupt(); const turn = revision;
          pending = new AbortController();
          try {
            const audio = await api.liveAvatarSpeech(token, conversationId, messageId, pending.signal);
            if (disposed || turn !== revision || !ready) return true;
            const bytes = Uint8Array.from(atob(audio.data), c => c.charCodeAt(0));
            // Browser TTS cannot expose samples. The existing server Gemini key produces WAV;
            // resample it once to the LITE protocol's mono PCM16/24kHz format.
            const decoder = new OfflineAudioContext(1, 1, 24000);
            const decoded = await decoder.decodeAudioData(bytes.buffer);
            if (decoded.duration > 90) throw new Error("Use standard speech for long responses");
            const renderer = new OfflineAudioContext(1, Math.ceil(decoded.duration * 24000), 24000);
            const source = renderer.createBufferSource(); source.buffer = decoded;
            source.connect(renderer.destination); source.start();
            const result = await renderer.startRendering();
            if (disposed || turn !== revision || !ready) return true;
            const samples = result.getChannelData(0), pcm = new Uint8Array(samples.length * 2), view = new DataView(pcm.buffer);
            for (let i=0;i<samples.length;i++) view.setInt16(i*2, Math.round(Math.max(-1,Math.min(1,samples[i]))*32767), true);
            let binary = "";
            for(let i=0;i<pcm.length;i+=8192) binary += String.fromCharCode(...pcm.subarray(i,i+8192));
            repeatAudio(btoa(binary)); activity(); return true;
          } catch { if (disposed || turn !== revision) return true; fail(); return false; }
        },
      };
    })().catch(failure => { if (!disposed) fail(failure); });
    return () => {
      disposed = true; release();
      window.removeEventListener("pagehide", release); document.removeEventListener("visibilitychange", hide);
    };
  }, [enabled, visible, token, conversationId, route, playback]);
  useEffect(() => { playback.current?.listen(listening); }, [listening, playback]);
  // Closing the panel resets the opt-in; reopening never starts a paid session.
  useEffect(() => { setActiveScope(null); }, [visible, route]);
  return <div className={styles.liveAvatar}>
    {enabled && visible ? <><video ref={video} autoPlay playsInline aria-label="Astra live avatar" /><p role="status">{status}</p></> : children}
    <button type="button" disabled={!conversationId} aria-pressed={enabled} onClick={() => setActiveScope(enabled ? null : scope)}>{enabled ? "Stop live avatar" : "Start live avatar"}</button>
    {enabled && status === "Speaking" && <button type="button" onClick={() => playback.current?.interrupt()}>Interrupt</button>}
    {enabled && error.startsWith("Tap") && <button type="button" onClick={() => { void video.current?.play().then(() => setError("")).catch(() => {}); }}>Enable avatar audio</button>}
    {error && <p role="status" className={styles.notice}>{error}</p>}
  </div>;
}
