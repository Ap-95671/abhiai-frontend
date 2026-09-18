import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageContent } from "@/components/chat/message-content";
import { AppIcon } from "@/components/ui/app-icon";
import type { AssistantMessage } from "./assistant-state";
import styles from "./assistant.module.css";

export function AssistantTranscript({ messages, onPlay, speechSupported, toolResults }: { messages: AssistantMessage[]; toolResults?: ReactNode; speechSupported: boolean; onPlay(message: AssistantMessage): void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  useEffect(() => {
    if (follow.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;

  }, [messages]);
  return <div className={styles.transcriptWrap}>
    <div className={styles.transcript} ref={scroll} role="region" aria-label="Assistant conversation" tabIndex={0}
      onScroll={() => { const el = scroll.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70; setShowLatest(!follow.current); }}>
      {!messages.length && <div className={styles.empty}><strong>Start a conversation</strong><p>Ask a question, think out loud, or explore an idea. Voice and text stay in the same conversation.</p></div>}
      {messages.map(message => <article key={message.id} className={styles.message} data-role={message.role}>
        <div className={styles.messageLabel}>{message.role === "USER" ? "You" : "AbhiAI"}
          {speechSupported && message.role === "ASSISTANT" && message.final && message.content && !message.interrupted &&
            <button type="button" aria-label="Read this response aloud" title="Read aloud" onClick={() => onPlay(message)}><AppIcon name="speaker" /></button>}
        </div>
        {message.content ? <MessageContent content={message.content} /> : <span className={styles.pending}>{message.role === "USER" ? "Transcribing…" : "AbhiAI is thinking…"}</span>}
      </article>)}
      {toolResults}
    </div>
    {showLatest && <button className={styles.latest} type="button" onClick={() => { follow.current = true; if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; setShowLatest(false); }}>Latest messages ↓</button>}
  </div>;
}
