"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { useAiCharacter } from "./use-ai-character";
import { CharacterAvatar } from "./character-avatar";
import { AssistantTranscript } from "./assistant-transcript";
import { AssistantComposer } from "./assistant-composer";
import { MemoryPanel } from "@/components/memory-panel";
import { AssistantToolResults } from "./assistant-tool-results";
import { contextLabels } from "./context-types";
import { characterLabels } from "./assistant-state";
import styles from "./assistant.module.css";

type Props = { token: string; userId: string; open: boolean; voiceAvailable: boolean; onDismiss(): void };
export default function AiCharacterPanel({ token, userId, open, voiceAvailable, onDismiss }: Props) {
  const [settingsOpen,setSettingsOpen] = useState(false);
  const assistant = useAiCharacter(token, open, userId);
  const dialog = useRef<HTMLDialogElement>(null);
  const historyMarker = useRef<string | null>(null);
  const dismiss = useRef(onDismiss);
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) { element?.close(); return; }
    const mobile = matchMedia("(max-width: 700px)").matches;
    if (mobile) element.showModal(); else element.show();
    const previousFocus = document.activeElement;
    const marker = historyMarker.current ??= crypto.randomUUID();
    if (mobile && history.state?.abhiaiAssistant !== marker) history.pushState({ ...history.state, abhiaiAssistant: marker }, "");
    const back = () => dismiss.current();
    const resize = () => {
      const viewport = window.visualViewport;
      if (!viewport || !mobile) return;
      element.style.setProperty("--viewport-height", `${viewport.height}px`);
      element.style.setProperty("--viewport-top", `${viewport.offsetTop}px`);
    };
    if (mobile) window.addEventListener("popstate", back);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize); resize();
    return () => {
      element.close(); window.removeEventListener("popstate", back);
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      // Strict Mode replays effects. Defer removal so a reopened dialog keeps its one history entry.
      queueMicrotask(() => { if (mobile && !element.open && history.state?.abhiaiAssistant === marker) history.back(); });
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  const connecting = assistant.connection === "connecting" || assistant.connection === "reconnecting";
  const connectionText = connecting ? (assistant.connection === "reconnecting" ? "Reconnecting…" : "Connecting to AbhiAI…")
    : assistant.connection === "connected" ? "Live voice connected" : assistant.connection === "expired" ? "Voice session ended · text available" : "Text chat available";
  return <dialog ref={dialog} className={styles.panel} data-assistant-panel="true" onKeyDown={event=>{ if(event.key === "Escape") { event.stopPropagation(); onDismiss(); } }} aria-labelledby="assistant-title" onCancel={event => { event.preventDefault(); onDismiss(); }}>
    <div className={styles.panelInner}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>YOUR AI COMPANION</span><h2 id="assistant-title">AbhiAI Assistant</h2></div>
        <div className={styles.headerActions}>
          <button type="button" aria-label={settingsOpen ? "Back to assistant conversation" : "Assistant settings and memory"} aria-expanded={settingsOpen} onClick={()=>{ assistant.endVoice(); setSettingsOpen(value=>!value); }}>⚙</button>
          <button type="button" disabled={assistant.loading || assistant.busy || assistant.unsaved} aria-label="Start a new assistant conversation" title="New conversation" onClick={() => void assistant.initialize(true)}><AppIcon name="plus" /></button>
          <button type="button" aria-label="Minimize assistant and stop microphone" title="Minimize" onClick={onDismiss}>−</button>
          <button autoFocus type="button" aria-label="Close assistant and end voice session" title="Close assistant" onClick={onDismiss}><AppIcon name="x" /></button>
        </div>
      </header>
      <div className={styles.contextBar} aria-label="Page context">
        <span title={assistant.pageContext?.page?.title}>{assistant.pageContext?.enabled
          ? assistant.pageContext.page?.entityId ? `Context: ${contextLabels[assistant.pageContext.page.pageType]}` : "No content selected"
          : "Page context off"}{assistant.pageContext?.page?.selectedText ? " · Selected text" : ""}</span>
        {assistant.pageContext?.page?.pageType === "document" && <button type="button" onClick={assistant.pageContext.clearSelection}>Back to page</button>}
        {assistant.pageContext?.page?.selectedText && <button type="button" onClick={assistant.pageContext.clearSelection}>Clear selection</button>}
        <button type="button" aria-label="Use current page context" aria-pressed={!!assistant.pageContext?.enabled} onClick={()=>assistant.pageContext?.setEnabled(!assistant.pageContext.enabled)}>{assistant.pageContext?.enabled ? "On" : "Off"}</button>
      </div>
      {settingsOpen ? <div className={styles.settings}>
        <label>Character animations<select value={assistant.animations} onChange={event=>assistant.changeAnimations(event.target.value as "full" | "reduced" | "off")}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></select></label>
        <MemoryPanel accessToken={token} onUnauthorized={onDismiss}/>
      </div> : <>
      <section className={styles.stage} aria-label="AbhiAI character">
        <CharacterAvatar state={assistant.character} expression={assistant.expression} animations={assistant.animations} level={assistant.level} />
        <p className={styles.characterStatus} role="status" aria-live="polite">{assistant.loading ? "Opening your conversation…" : assistant.toolStatus || characterLabels[assistant.character]}</p>
        <p className={styles.connectionStatus}>{connectionText}</p>
        {assistant.microphone && <span className={styles.micNotice}><i />Microphone on · audio is sent to Gemini</span>}
        {assistant.character === "speaking" && assistant.level > 0 && <div className={styles.waveform} aria-hidden="true">{[0.4, 0.7, 1, 0.8, 0.5].map((weight, i) => <i key={i} style={{ "--bar-height": `${3 + assistant.level * 18 * weight}px` } as CSSProperties} />)}</div>}
      </section>
      <AssistantTranscript toolResults={<AssistantToolResults results={assistant.toolResults} token={token} onNavigate={onDismiss}/>} messages={assistant.messages} onPlay={assistant.play} speechSupported={assistant.speechSupported} />
      {assistant.notice && <p className={styles.notice} role="status">{assistant.notice}</p>}
      {assistant.error && <div className={styles.error} role="alert"><span>{assistant.error}</span>
        {assistant.unsaved && <button type="button" onClick={assistant.retrySave}>Retry saving</button>}
        {!assistant.conversationId && <button type="button" onClick={() => void assistant.initialize()}>Retry loading</button>}
        {assistant.error.includes("Audio") && <button type="button" onClick={() => void assistant.enableAudio()}>Enable audio</button>}
      </div>}
      <footer className={styles.footer}>
        <AssistantComposer disabled={assistant.loading || !assistant.conversationId} onSend={assistant.send} />
        <div className={styles.voiceControls}>
          <button type="button" className={styles.micButton} aria-pressed={assistant.microphone}
            disabled={!voiceAvailable || assistant.loading || connecting || !assistant.conversationId}
            aria-label={assistant.microphone ? "Stop listening and release microphone" : "Start live microphone"}
            onClick={() => void assistant.toggleMicrophone()}><AppIcon name={assistant.microphone ? "stop" : "microphone"} />{assistant.microphone ? "Stop listening" : connecting ? "Connecting…" : "Talk to AbhiAI"}</button>
          {(assistant.character === "speaking" || assistant.busy) && <button type="button" onClick={assistant.interrupt} aria-label="Interrupt AbhiAI speech">Interrupt</button>}
          <button type="button" className={styles.autoSpeak} aria-pressed={assistant.autoSpeak} aria-label={`Auto Speak ${assistant.autoSpeak ? "on" : "off"}`} onClick={assistant.toggleAutoSpeak}><AppIcon name="speaker" />{assistant.autoSpeak ? "On" : "Off"}</button>
        </div>
        <p className={styles.privacy}>{voiceAvailable ? "Mic starts only when you tap. Closing or minimizing stops audio." : "Live voice isn’t enabled on this server. Text and read-aloud are available."}</p>
      </footer>
      </>}
    </div>
  </dialog>;
}
