"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { useAiCharacter } from "./use-ai-character";
import { CharacterAvatar } from "./character-avatar";
import { AssistantTranscript } from "./assistant-transcript";
import { AssistantComposer } from "./assistant-composer";
import { characterLabels } from "./assistant-state";
import styles from "./assistant.module.css";

type Props = { token: string; userId: string; open: boolean; voiceAvailable: boolean; onDismiss(): void };
export default function AiCharacterPanel({ token, userId, open, voiceAvailable, onDismiss }: Props) {
  const assistant = useAiCharacter(token, open, userId);
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) { element?.close(); return; }
    element.showModal();
    const previousFocus = document.activeElement;
    const mobile = matchMedia("(max-width: 700px)").matches;
    const marker = crypto.randomUUID();
    if (mobile) history.pushState({ ...history.state, abhiaiAssistant: marker }, "");
    const back = () => dismiss.current();
    const resize = () => {
      const viewport = window.visualViewport;
      if (!viewport || !mobile) return;
      element.style.setProperty("--viewport-height", `${viewport.height}px`);
      element.style.setProperty("--viewport-top", `${viewport.offsetTop}px`);
    };
    window.addEventListener("popstate", back);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize); resize();
    return () => {
      element.close(); window.removeEventListener("popstate", back);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      if (mobile && history.state?.abhiaiAssistant === marker) history.back();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  const connecting = assistant.connection === "connecting" || assistant.connection === "reconnecting";
  const connectionText = connecting ? (assistant.connection === "reconnecting" ? "Reconnecting…" : "Connecting to AbhiAI…")
    : assistant.connection === "connected" ? "Live voice connected" : assistant.connection === "expired" ? "Voice session ended · text available" : "Text chat available";
  return <dialog ref={dialog} className={styles.panel} aria-labelledby="assistant-title" onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className={styles.panelInner}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>YOUR AI COMPANION</span><h2 id="assistant-title">AbhiAI Assistant</h2></div>
        <div className={styles.headerActions}>
          <button type="button" disabled={assistant.loading || assistant.busy || assistant.unsaved} aria-label="Start a new assistant conversation" title="New conversation" onClick={() => void assistant.initialize(true)}><AppIcon name="plus" /></button>
          <button type="button" aria-label="Minimize assistant and stop microphone" title="Minimize" onClick={onDismiss}>−</button>
          <button autoFocus type="button" aria-label="Close assistant and end voice session" title="Close assistant" onClick={onDismiss}><AppIcon name="x" /></button>
        </div>
      </header>
      <section className={styles.stage} aria-label="AbhiAI character">
        <CharacterAvatar state={assistant.character} level={assistant.level} />
        <p className={styles.characterStatus} role="status" aria-live="polite">{assistant.loading ? "Opening your conversation…" : characterLabels[assistant.character]}</p>
        <p className={styles.connectionStatus}>{connectionText}</p>
        {assistant.microphone && <span className={styles.micNotice}><i />Microphone on · audio is sent to Gemini</span>}
        {assistant.character === "speaking" && assistant.level > 0 && <div className={styles.waveform} aria-hidden="true">{[0.4, 0.7, 1, 0.8, 0.5].map((weight, i) => <i key={i} style={{ "--bar-height": `${3 + assistant.level * 18 * weight}px` } as CSSProperties} />)}</div>}
      </section>
      <AssistantTranscript messages={assistant.messages} onPlay={assistant.play} speechSupported={assistant.speechSupported} />
      {assistant.error && <div className={styles.error} role="alert"><span>{assistant.error}</span>
        {assistant.unsaved && <button type="button" onClick={assistant.retrySave}>Retry saving</button>}
        {!assistant.conversationId && <button type="button" onClick={() => void assistant.initialize()}>Retry loading</button>}
        {assistant.error.includes("Audio") && <button type="button" onClick={() => void assistant.enableAudio()}>Enable audio</button>}
      </div>}
      <footer className={styles.footer}>
        <AssistantComposer disabled={assistant.loading || assistant.busy || !assistant.conversationId} onSend={assistant.send} />
        <div className={styles.voiceControls}>
          <button type="button" className={styles.micButton} aria-pressed={assistant.microphone}
            disabled={!voiceAvailable || assistant.loading || connecting || !assistant.conversationId}
            aria-label={assistant.microphone ? "Stop listening and release microphone" : "Start live microphone"}
            onClick={() => void assistant.toggleMicrophone()}><AppIcon name={assistant.microphone ? "stop" : "microphone"} />{assistant.microphone ? "Stop listening" : connecting ? "Connecting…" : "Talk to AbhiAI"}</button>
          {(assistant.character === "speaking" || (assistant.busy && assistant.connection === "connected")) && <button type="button" onClick={assistant.interrupt} aria-label="Interrupt AbhiAI speech">Interrupt</button>}
          <button type="button" className={styles.autoSpeak} aria-pressed={assistant.autoSpeak} aria-label={`Auto Speak ${assistant.autoSpeak ? "on" : "off"}`} onClick={assistant.toggleAutoSpeak}><AppIcon name="speaker" />{assistant.autoSpeak ? "On" : "Off"}</button>
        </div>
        <p className={styles.privacy}>{voiceAvailable ? "Mic starts only when you tap. Closing or minimizing stops audio." : "Live voice isn’t enabled on this server. Text and read-aloud are available."}</p>
      </footer>
    </div>
  </dialog>;
}
