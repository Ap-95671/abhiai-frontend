"use client";

import { SelectControl } from "@/components/chat/tool-menu";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { useAssistantAgent } from "./use-assistant-agent";
import { AgentProgress } from "./agent-progress";
import type { AssistantSettings } from "./agent-types";
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
  const agent=useAssistantAgent(token,userId,open,()=>assistant.initialize());
  const [taskMode,setTaskMode]=useState(false);
  const [projectDraft,setProjectDraft]=useState("");
  const pageEnabled=agent.settings?.pageContext;
  const setPageEnabled=assistant.pageContext?.setEnabled;
  useEffect(()=>{if(pageEnabled!==undefined)setPageEnabled?.(pageEnabled);},[pageEnabled,setPageEnabled]);
  useEffect(()=>{queueMicrotask(()=>setProjectDraft(agent.settings?.projectKey??""));},[agent.settings?.projectKey]);
  async function updateSettings(patch:Partial<AssistantSettings>) {
    if(!agent.settings){if(patch.pageContext!==undefined)assistant.pageContext?.setEnabled(patch.pageContext);return;}
    assistant.endVoice();assistant.interrupt();
    await agent.update({...agent.settings,...patch});
  }
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
          <button type="button" disabled={assistant.loading || assistant.busy || assistant.unsaved || agent.running} aria-label="Start a new assistant conversation" title="New conversation" onClick={() => void assistant.initialize(true)}><AppIcon name="plus" /></button>
          <button type="button" aria-label="Minimize assistant and stop microphone" title="Minimize" onClick={onDismiss}>−</button>
          <button autoFocus type="button" aria-label="Close assistant and end voice session" title="Close assistant" onClick={onDismiss}><AppIcon name="x" /></button>
        </div>
      </header>
      <div className={styles.contextBar} aria-label="Page context">
        <span title={assistant.pageContext?.page?.title}>{assistant.pageContext?.enabled
          ? assistant.pageContext.page?.entityId ? `Context: ${contextLabels[assistant.pageContext.page.pageType]}` : "No content selected"
          : "Page context off"}{assistant.pageContext?.page?.selectedText ? " · Selected text" : ""}</span>
        {assistant.pageContext?.page?.pageType === "document" && <label>Page <input type="number" aria-label="Current document page" min={1} max={50} value={assistant.pageContext.page.currentPage??""} style={{width:48}} onChange={e=>{const page=assistant.pageContext?.page;if(page)assistant.pageContext?.selectDocument({...page,currentPage:e.target.value?Number(e.target.value):undefined});}}/></label>}
        {assistant.pageContext?.page?.pageType === "document" && <button type="button" onClick={assistant.pageContext.clearSelection}>Back to page</button>}
        {assistant.pageContext?.page?.selectedText && <button type="button" onClick={assistant.pageContext.clearSelection}>Clear selection</button>}
        <button type="button" aria-label="Use current page context" aria-pressed={!!assistant.pageContext?.enabled} onClick={()=>void updateSettings({pageContext:!assistant.pageContext?.enabled})}>{assistant.pageContext?.enabled ? "On" : "Off"}</button>
      </div>
      {settingsOpen ? <div className={styles.settings}>
        <label>Character animations<SelectControl aria-label="Character animations" value={assistant.animations} onChange={event=>assistant.changeAnimations(event.target.value as "full" | "reduced" | "off")}><option value="full">Full</option><option value="reduced">Reduced</option><option value="off">Off</option></SelectControl></label>
        {agent.settings && <fieldset className={styles.privacyControls} disabled={agent.savingSettings}><legend>Assistant Privacy & controls</legend>
          <label>Assistant mode<SelectControl aria-label="Assistant mode" value={agent.settings.mode} onChange={e=>void updateSettings({mode:e.target.value as AssistantSettings["mode"]})}>{["STANDARD","FRIENDLY","TUTOR","PROFESSIONAL","CREATIVE"].map(mode=><option key={mode}>{mode}</option>)}</SelectControl></label>
          <label>Project name<input maxLength={80} value={projectDraft} onChange={e=>setProjectDraft(e.target.value)}/></label>
          <button type="button" onClick={()=>void updateSettings({projectKey:projectDraft})}>Use this project</button>
          <p>Leave blank for general work. Project memories only apply to this exact project name.</p>
          <label><input type="checkbox" checked={agent.settings.pageContext} onChange={e=>void updateSettings({pageContext:e.target.checked})}/> Use current page context</label>
          <label><input type="checkbox" checked={agent.settings.agentActions} onChange={e=>void updateSettings({agentActions:e.target.checked})}/> Allow reviewed agent actions (each save still needs confirmation)</label>
          <label><input type="checkbox" checked={agent.settings.proactive} onChange={e=>void updateSettings({proactive:e.target.checked})}/> Suggest unfinished tasks (at most once per day)</label>
          <label><input type="checkbox" checked={agent.settings.fallbackAllowed} onChange={e=>void updateSettings({fallbackAllowed:e.target.checked})}/> Allow text answers from another configured provider if Gemini fails</label>
          <p>Microphone: {assistant.microphone?"On":"Off"}; starts only when tapped. Camera: off, unsupported. Voice falls back to text.</p>
        </fieldset>}
        <MemoryPanel accessToken={token} onUnauthorized={onDismiss} projectKey={agent.settings?.projectKey} conversationId={assistant.conversationId} sessionId={agent.sessionId}/>
        {agent.error && <p role="alert">{agent.error}</p>}
      </div> : <>
      <section className={styles.stage} aria-label="AbhiAI character">
        <CharacterAvatar state={agent.running?"thinking":assistant.character} expression={agent.running?"thinking":assistant.expression} animations={assistant.animations} level={assistant.level} />
        <p className={styles.characterStatus} role="status" aria-live="polite">{assistant.loading ? "Opening your conversation…" : assistant.toolStatus || characterLabels[assistant.character]}</p>
        <p className={styles.connectionStatus}>{connectionText}</p>
        {assistant.microphone && <span className={styles.micNotice}><i />Microphone on · audio is sent to Gemini</span>}
        {assistant.character === "speaking" && assistant.level > 0 && <div className={styles.waveform} aria-hidden="true">{[0.4, 0.7, 1, 0.8, 0.5].map((weight, i) => <i key={i} style={{ "--bar-height": `${3 + assistant.level * 18 * weight}px` } as CSSProperties} />)}</div>}
      </section>
      <AssistantTranscript token={token} toolResults={<>
        <AssistantToolResults results={assistant.toolResults} token={token} onNavigate={onDismiss}/>
        {agent.suggestion && <div className={styles.notice}>You have an unfinished task: {agent.suggestion.goal}<button type="button" onClick={()=>{agent.select(agent.suggestion);agent.dismissSuggestion();}}>Review</button><button type="button" onClick={agent.dismissSuggestion}>Dismiss</button></div>}
        <AgentProgress task={agent.task} running={agent.running} token={token} onStop={t=>void agent.stop(t.id)} onResume={t=>void agent.resume(t)} onConfirm={t=>void agent.confirm(t)} onNavigate={onDismiss}/>
        {!!agent.tasks.length && <details className={styles.taskHistory}><summary>Recent assistant tasks</summary>{agent.tasks.map(t=><button key={t.id} type="button" disabled={agent.running} onClick={()=>agent.select(t)}>{t.goal} · {t.status.toLowerCase()} · {new Date(t.updatedAt).toLocaleDateString()}</button>)}</details>}
      </>} messages={assistant.messages} onPlay={assistant.play} speechSupported={assistant.speechSupported} />
      {agent.error && <p className={styles.error} role="alert">{agent.error}</p>}
      {assistant.notice && <p className={styles.notice} role="status">{assistant.notice}</p>}
      {assistant.error && <div className={styles.error} role="alert"><span>{assistant.error}</span>
        {assistant.unsaved && <button type="button" onClick={assistant.retrySave}>Retry saving</button>}
        {!assistant.conversationId && <button type="button" onClick={() => void assistant.initialize()}>Retry loading</button>}
        {assistant.error.includes("Audio") && <button type="button" onClick={() => void assistant.enableAudio()}>Enable audio</button>}
      </div>}
      <footer className={styles.footer}>
        <div className={styles.inputTools}><label className={styles.taskToggle}><input type="checkbox" checked={taskMode} disabled={agent.running || assistant.busy} onChange={e=>{assistant.endVoice();setTaskMode(e.target.checked);}}/> Multi-step task</label>
        {!taskMode && <label className={styles.upload} title="Image, screenshot, PDF or text">Attach file<input className="sr-only" aria-label="Attach image, screenshot, PDF or text" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" disabled={assistant.busy || agent.running || assistant.uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void assistant.upload(file);e.target.value="";}}/></label>}</div>
        {assistant.attachment && <div className={styles.notice}><span>{assistant.attachment.filename}</span><button type="button" onClick={()=>void assistant.removeAttachment()}>Remove</button></div>}
        <AssistantComposer maxLength={taskMode?2000:10000} disabled={assistant.loading || !assistant.conversationId || agent.running || assistant.uploading} onSend={content=>{
          if(taskMode && assistant.conversationId){assistant.endVoice();return agent.start(content,assistant.conversationId,assistant.pageContext?.page??null);}
          return assistant.send(content,agent.sessionId);
        }} />
        <div className={styles.voiceControls}>
          <button type="button" className={styles.micButton} aria-pressed={assistant.microphone}
            disabled={!voiceAvailable || assistant.loading || connecting || !assistant.conversationId || agent.running || !!assistant.attachment}
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
