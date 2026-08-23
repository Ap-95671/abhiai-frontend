"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  api,
  ApiError,
  DirectConversation,
  DirectMessage,
  PageResponse,
} from "@/lib/api";
import { GroupMessagesPanel } from "@/components/group-messages-panel";
import { ReportButton } from "@/components/report-button";

type MessagesPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  return new Intl.DateTimeFormat(undefined, {
    month: date.toDateString() === today.toDateString() ? undefined : "short",
    day: date.toDateString() === today.toDateString() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function MessagesPanel({ accessToken, onUnauthorized, onViewProfile }: MessagesPanelProps) {
  const [messageMode, setMessageMode] = useState<"direct" | "groups">("direct");
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [selected, setSelected] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messagePage, setMessagePage] = useState<PageResponse<DirectMessage> | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleError = useCallback((loadError: unknown, fallback: string) => {
    if (loadError instanceof ApiError && loadError.status === 401) {
      onUnauthorized();
      return;
    }
    setError(errorText(loadError, fallback));
  }, [onUnauthorized]);

  const refreshConversations = useCallback(async () => {
    try {
      const items = await api.getDirectConversations(accessToken);
      setConversations(items);
      setSelected((current) => current
        ? items.find((item) => item.id === current.id) ?? current
        : current);
    } catch (loadError) {
      handleError(loadError, "Conversations could not be loaded.");
    }
  }, [accessToken, handleError]);

  const loadHistory = useCallback(async (
    conversation: DirectConversation,
    nextPage = 0,
    append = false,
  ) => {
    setIsLoadingHistory(true);
    setError("");
    try {
      const result = await api.getDirectMessages(accessToken, conversation.id, nextPage);
      setSelected(conversation);
      setMessages((current) => append ? [...current, ...result.content] : result.content);
      setMessagePage(result);
      await api.markDirectConversationRead(accessToken, conversation.id);
      setConversations((current) => current.map((item) => item.id === conversation.id
        ? { ...item, unreadCount: 0 }
        : item));
    } catch (loadError) {
      handleError(loadError, "Message history could not be loaded.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [accessToken, handleError]);

  useEffect(() => {
    let active = true;
    void Promise.all([api.getDirectConversations(accessToken), api.getCurrentProfile(accessToken)])
      .then(([items, profile]) => {
        if (!active) return;
        setConversations(items);
        setCurrentUserId(profile.id);
      })
      .catch((loadError: unknown) => { if (active) handleError(loadError, "Messages could not be loaded."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, handleError]);

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = recipient.trim();
    if (!username) return;
    setIsStarting(true);
    setError("");
    try {
      const conversation = await api.startDirectConversation(accessToken, username);
      setRecipient("");
      await refreshConversations();
      await loadHistory(conversation);
    } catch (startError) {
      handleError(startError, "The conversation could not be started.");
    } finally {
      setIsStarting(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!selected || !content) return;
    setIsSending(true);
    setError("");
    try {
      const message = await api.sendDirectMessage(accessToken, selected.id, content);
      setMessages((current) => [message, ...current]);
      setDraft("");
      await refreshConversations();
    } catch (sendError) {
      handleError(sendError, "The message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  async function deleteMessage(message: DirectMessage) {
    if (!selected || message.deleted || message.sender.id !== currentUserId) return;
    setPendingDeleteId(message.id);
    setError("");
    try {
      const deleted = await api.deleteDirectMessage(accessToken, selected.id, message.id);
      setMessages((current) => current.map((item) => item.id === deleted.id ? deleted : item));
      await refreshConversations();
    } catch (deleteError) {
      handleError(deleteError, "The message could not be deleted.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <section className="workspace-view dm-view" aria-labelledby="messages-title">
      <header className="workspace-header">
        <div><p className="eyebrow">Conversations</p><h1 id="messages-title">Messages</h1><p>Private direct messages and permission-controlled group conversations.</p></div>
        <div className="message-mode-tabs" role="tablist" aria-label="Message type">
          <button aria-selected={messageMode === "direct"} className={messageMode === "direct" ? "active" : ""} onClick={() => setMessageMode("direct")} role="tab" type="button">Direct</button>
          <button aria-selected={messageMode === "groups"} className={messageMode === "groups" ? "active" : ""} onClick={() => setMessageMode("groups")} role="tab" type="button">Groups</button>
        </div>
      </header>

      {messageMode === "groups" ? <GroupMessagesPanel accessToken={accessToken} onUnauthorized={onUnauthorized} onViewProfile={onViewProfile} /> :
      <div className="dm-workspace">
        <aside className="dm-conversation-panel">
          <form className="dm-start-form" onSubmit={startConversation}>
            <label htmlFor="dm-recipient">Start a conversation</label>
            <div><input id="dm-recipient" maxLength={31} onChange={(event) => setRecipient(event.target.value)} placeholder="@username" value={recipient} /><button disabled={isStarting || !recipient.trim()} type="submit">{isStarting ? "…" : "+"}</button></div>
          </form>
          <div className="dm-list" aria-label="Direct conversations">
            {isLoading && <p className="dm-empty">Loading conversations…</p>}
            {!isLoading && conversations.length === 0 && <p className="dm-empty">No direct messages yet. Start with a username above.</p>}
            {conversations.map((conversation) => (
              <button className={selected?.id === conversation.id ? "active" : ""} key={conversation.id} onClick={() => void loadHistory(conversation)} type="button">
                <span className="profile-avatar small-avatar" aria-hidden="true">{initials(conversation.participant.displayName)}</span>
                <span className="dm-list-copy"><strong>{conversation.participant.displayName}</strong><small>{conversation.lastMessagePreview ?? `@${conversation.participant.username}`}</small></span>
                <span className="dm-list-meta">{conversation.lastMessageAt && <time>{timeLabel(conversation.lastMessageAt)}</time>}{conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</b>}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="dm-thread" aria-label={selected ? `Conversation with ${selected.participant.displayName}` : "Direct message thread"}>
          {error && <p className="inline-error dm-error" role="alert">{error}</p>}
          {!selected ? <div className="feature-empty-state"><span className="empty-state-icon" aria-hidden="true">✉</span><h2>Your private inbox</h2><p>Select a conversation or start a new one using someone&apos;s username.</p></div> : <>
            <header className="dm-thread-header">
              <button className="profile-avatar" onClick={() => onViewProfile(selected.participant.username)} type="button">{initials(selected.participant.displayName)}</button>
              <div><button onClick={() => onViewProfile(selected.participant.username)} type="button">{selected.participant.displayName}</button><p>@{selected.participant.username}</p></div>
            </header>
            <div className="dm-history" aria-live="polite">
              {messagePage && !messagePage.last && <button className="dm-load-older" disabled={isLoadingHistory} onClick={() => void loadHistory(selected, messagePage.page + 1, true)} type="button">{isLoadingHistory ? "Loading…" : "Load older messages"}</button>}
              {isLoadingHistory && messages.length === 0 && <p className="dm-empty">Loading messages…</p>}
              {!isLoadingHistory && messages.length === 0 && <div className="dm-begin"><span>✦</span><p>This is the beginning of your conversation with <strong>{selected.participant.displayName}</strong>.</p></div>}
              {chronologicalMessages.map((message) => {
                const own = message.sender.id === currentUserId;
                return <article className={own ? "dm-message own" : "dm-message"} key={message.id}>
                  <div className={message.deleted ? "dm-bubble deleted" : "dm-bubble"}>{message.deleted ? "This message was deleted" : message.content}</div>
                  <footer><time>{timeLabel(message.createdAt)}</time>{own && !message.deleted ? <><span>· {message.readByRecipient ? "Read" : "Sent"}</span><button disabled={pendingDeleteId === message.id} onClick={() => void deleteMessage(message)} type="button">{pendingDeleteId === message.id ? "Deleting…" : "Delete"}</button></> : !message.deleted&&<ReportButton accessToken={accessToken} onUnauthorized={onUnauthorized} targetContext="DIRECT_MESSAGE" targetId={message.id} targetType="MESSAGE"/>}</footer>
                </article>;
              })}
            </div>
            <form className="dm-composer" onSubmit={sendMessage}>
              <textarea aria-label={`Message ${selected.participant.displayName}`} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a private message…" rows={1} value={draft} />
              <span>{draft.length}/2000</span>
              <button disabled={isSending || !draft.trim()} type="submit">{isSending ? "…" : "↑"}<span className="sr-only">Send direct message</span></button>
            </form>
          </>}
        </section>
      </div>}
    </section>
  );
}
