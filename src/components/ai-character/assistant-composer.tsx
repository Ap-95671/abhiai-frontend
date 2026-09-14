import { useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import styles from "./assistant.module.css";

export function AssistantComposer({ disabled, onSend }: { disabled: boolean; onSend(content: string): Promise<boolean> }) {
  const [draft, setDraft] = useState("");
  async function submit() {
    if (disabled || !draft.trim()) return;
    const value = draft;
    if (await onSend(value)) setDraft(current => current === value ? "" : current);
  }
  return <form className={styles.composer} onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label className="sr-only" htmlFor="assistant-message">Message AbhiAI Assistant</label>
    <textarea id="assistant-message" rows={2} maxLength={10000} placeholder="Ask AbhiAI…" value={draft}
      onChange={event => setDraft(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} />
    <button type="submit" disabled={disabled || !draft.trim()} aria-label="Send message"><AppIcon name="send" /></button>
  </form>;
}
