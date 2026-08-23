"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { AuthScreen } from "@/components/auth/auth-screen";
import { BrandIntro } from "@/components/branding/brand-intro";
import { LandingPage } from "@/components/landing/landing-page";
import { NotificationsPanel } from "@/components/notifications-panel";
import { FeedPanel } from "@/components/feed-panel";
import { ExplorePanel } from "@/components/explore-panel";
import { CommunityPanel } from "@/components/community-panel";
import { MessagesPanel } from "@/components/messages-panel";
import { ProfilePanel } from "@/components/profile-panel";
import { SearchPanel } from "@/components/search-panel";
import { VideoFeedPanel } from "@/components/video-feed-panel";
import { StoriesPanel } from "@/components/stories-panel";
import { HashtagPanel } from "@/components/hashtag-panel";
import { ArticlesPanel } from "@/components/articles-panel";
import { CreatorDashboard } from "@/components/creator-dashboard";

import {
  api,
  ApiError,
  ChatMessage,
  ConversationAttachment,
  ConversationDetail,
  ConversationSummary,
} from "@/lib/api";

const TOKEN_STORAGE_KEY = "abhiai.access-token";
const SESSION_TOKEN_STORAGE_KEY = "abhiai.session-access-token";

type AuthMode = "login" | "register";
type GuestView = "landing" | "auth";
type ActiveView = "chat" | "feed" | "explore" | "communities" | "articles" | "creator" | "messages" | "stories" | "videos" | "hashtags" | "search" | "notifications" | "profile";

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [guestView, setGuestView] = useState<GuestView>("landing");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("chat");
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [profileUsername, setProfileUsername] = useState<string | undefined>();
  const [selectedHashtag, setSelectedHashtag] = useState<string | undefined>();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<ConversationAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [externalProcessingAllowed, setExternalProcessingAllowed] = useState(false);
  const [webSearchAllowed, setWebSearchAllowed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const streamAbortController = useRef<AbortController | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  const conversationId = selectedConversation?.id;
  const sortedMessages = useMemo(
    () => selectedConversation?.messages ?? [],
    [selectedConversation],
  );

  const expireSession = useCallback((message = "") => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    setAccessToken(null);
    setEmail("");
    setPassword("");
    setConversations([]);
    setSelectedConversation(null);
    setChatError("");
    setMessageDraft("");
    setActiveView("chat");
    setUnreadNotificationCount(0);
    setAuthError(message);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setGuestView("auth");
    expireSession("Your session has expired. Please sign in again.");
  }, [expireSession]);

  const viewProfile = useCallback((username?: string) => {
    setProfileUsername(username);
    setActiveView("profile");
  }, []);

  const viewHashtag = useCallback((tag?: string) => {
    setSelectedHashtag(tag);
    setActiveView("hashtags");
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setAccessToken(
        window.localStorage.getItem(TOKEN_STORAGE_KEY)
        ?? window.sessionStorage.getItem(SESSION_TOKEN_STORAGE_KEY),
      );
      setSessionResolved(true);
    });
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    let isCurrent = true;
    queueMicrotask(() => {
      if (isCurrent) {
        setIsLoadingConversations(true);
        setChatError("");
      }
    });

    api
      .getConversations(accessToken)
      .then(async (items) => {
        if (!isCurrent) return;
        setConversations(items);

        if (!items[0]) {
          setSelectedConversation(null);
          return;
        }

        setIsLoadingHistory(true);
        const conversation = await api.getConversation(accessToken, items[0].id);
        if (isCurrent) setSelectedConversation(conversation);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        if (error instanceof ApiError && error.status === 401) {
          handleSessionExpired();
          return;
        }
        setChatError(errorMessage(error));
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingConversations(false);
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, handleSessionExpired]);

  useEffect(() => {
    if (!accessToken) return;

    let isCurrent = true;
    const refreshUnreadCount = () => {
      void api.getUnreadNotificationCount(accessToken)
        .then(({ unreadCount }) => {
          if (isCurrent) setUnreadNotificationCount(unreadCount);
        })
        .catch((error: unknown) => {
          if (isCurrent && error instanceof ApiError && error.status === 401) {
            handleSessionExpired();
          }
        });
    };
    refreshUnreadCount();
    const refreshTimer = window.setInterval(refreshUnreadCount, 30_000);

    return () => {
      isCurrent = false;
      window.clearInterval(refreshTimer);
    };
  }, [accessToken, handleSessionExpired]);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ behavior: isSending ? "smooth" : "auto", block: "end" });
  }, [isSending, sortedMessages]);

  async function selectConversation(token: string, id: string) {
    setIsLoadingHistory(true);
    setChatError("");
    setChatAttachments([]);
    setExternalProcessingAllowed(false);
    setWebSearchAllowed(false);
    try {
      setSelectedConversation(await api.getConversation(token, id));
    } catch (error) {
      handleAuthenticatedError(error);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function handleAuthenticatedError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      handleSessionExpired();
      return;
    }

    setChatError(errorMessage(error));
  }

  async function handleAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      if (authMode === "register") {
        await api.register(displayName.trim(), email.trim(), password);
      }

      const session = await api.login(email.trim(), password);
      if (rememberMe) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, session.accessToken);
        window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_TOKEN_STORAGE_KEY, session.accessToken);
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      setAccessToken(session.accessToken);
      setPassword("");
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  function signOut() {
    expireSession();
    setGuestView("landing");
  }

  async function createConversation() {
    if (!accessToken) return;

    setIsCreatingConversation(true);
    setChatError("");
    try {
      const conversation = await api.createConversation(accessToken);
      setActiveView("chat");
      setConversations((current) => [conversation, ...current]);
      await selectConversation(accessToken, conversation.id);
    } catch (error) {
      handleAuthenticatedError(error);
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!accessToken || !conversationId || !content || isSending || isUploadingAttachment) return;
    if (chatAttachments.some((attachment) => attachment.processingStatus !== "READY")) {
      setChatError("Remove failed attachments or wait until processing completes.");
      return;
    }
    if (chatAttachments.length > 0 && !externalProcessingAllowed) {
      setChatError("Confirm external AI processing for the selected attachments.");
      return;
    }

    setChatError("");
    setIsSending(true);
    setMessageDraft("");
    const abortController = new AbortController();
    streamAbortController.current = abortController;

    const pendingTimestamp = new Date().toISOString();
    const pendingUserMessage: ChatMessage = {
      id: `pending-user-${pendingTimestamp}`,
      role: "USER",
      content,
      createdAt: pendingTimestamp,
    };
    const pendingAssistantMessage: ChatMessage = {
      id: `pending-assistant-${pendingTimestamp}`,
      role: "ASSISTANT",
      content: "",
      createdAt: pendingTimestamp,
    };

    setSelectedConversation((current) =>
      current && current.id === conversationId
        ? {
            ...current,
            messages: [
              ...current.messages,
              pendingUserMessage,
              pendingAssistantMessage,
            ],
          }
        : current,
    );

    try {
      const exchange = await api.sendMessageStream(
        accessToken,
        conversationId,
        content,
        (chunk) => {
          setSelectedConversation((current) =>
            current && current.id === conversationId
              ? {
                  ...current,
                  messages: current.messages.map((item) =>
                    item.id === pendingAssistantMessage.id
                      ? { ...item, content: `${item.content}${chunk}` }
                      : item,
                  ),
                }
              : current,
          );
        },
        abortController.signal,
        {
          attachmentIds: chatAttachments.map((attachment) => attachment.id),
          externalProcessingAllowed,
          webSearchAllowed,
        },
      );
      setChatAttachments([]);
      setExternalProcessingAllowed(false);
      setSelectedConversation((current) =>
        current && current.id === conversationId
          ? {
              ...current,
              title: exchange.conversation.title,
              updatedAt: exchange.assistantMessage.createdAt,
              messages: current.messages.map((item) => {
                if (item.id === pendingUserMessage.id) return exchange.userMessage;
                if (item.id === pendingAssistantMessage.id) return exchange.assistantMessage;
                return item;
              }),
            }
          : current,
      );
      setConversations((current) =>
        current
          .map((item) =>
            item.id === conversationId
              ? exchange.conversation
              : item,
          )
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
      );
    } catch (error) {
      setMessageDraft(content);
      setSelectedConversation((current) =>
        current && current.id === conversationId
          ? {
              ...current,
              messages: current.messages.filter(
                (item) =>
                  item.id !== pendingUserMessage.id &&
                  item.id !== pendingAssistantMessage.id,
              ),
            }
          : current,
      );
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatError("Generation stopped.");
      } else {
        handleAuthenticatedError(error);
      }
    } finally {
      streamAbortController.current = null;
      setIsSending(false);
    }
  }

  async function uploadChatAttachment(file: File) {
    if (!accessToken || !conversationId || isUploadingAttachment) return;
    setIsUploadingAttachment(true);
    setChatError("");
    try {
      const attachment = await api.uploadConversationAttachment(accessToken, conversationId, file);
      setChatAttachments((current) => [...current, attachment]);
      if (attachment.processingStatus === "FAILED") {
        setChatError(attachment.processingError ?? "Attachment processing failed.");
      }
    } catch (error) {
      handleAuthenticatedError(error);
    } finally {
      setIsUploadingAttachment(false);
    }
  }

  async function removeChatAttachment(attachment: ConversationAttachment) {
    if (!accessToken || !conversationId) return;
    try {
      await api.deleteConversationAttachment(accessToken, conversationId, attachment.id);
      setChatAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error) {
      handleAuthenticatedError(error);
    }
  }

  function stopGeneration() {
    streamAbortController.current?.abort();
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setChatError("Unable to copy this message. Please select the text manually.");
    }
  }

  async function renameConversation() {
    if (!accessToken || !selectedConversation) return;
    const title = window.prompt("Conversation title", selectedConversation.title)?.trim();
    if (!title || title === selectedConversation.title) return;

    try {
      const updated = await api.renameConversation(accessToken, selectedConversation.id, title);
      setSelectedConversation((current) => (current ? { ...current, ...updated } : current));
      setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      handleAuthenticatedError(error);
    }
  }

  async function deleteConversation() {
    if (!accessToken || !selectedConversation) return;
    if (!window.confirm("Delete this conversation and its messages?")) return;

    try {
      await api.deleteConversation(accessToken, selectedConversation.id);
      const remaining = conversations.filter((item) => item.id !== selectedConversation.id);
      setConversations(remaining);
      setSelectedConversation(null);
      if (remaining[0]) await selectConversation(accessToken, remaining[0].id);
    } catch (error) {
      handleAuthenticatedError(error);
    }
  }

  if (!sessionResolved) {
    return (
      <>
        <BrandIntro />
        <main className="session-loader" aria-label="Loading AbhiAI">
          <Image alt="AbhiAI" height={64} priority src="/abhiai-logo.png" width={64} />
        </main>
      </>
    );
  }

  if (!accessToken && guestView === "landing") {
    return (
      <>
        <BrandIntro />
        <LandingPage
          onLogin={() => {
            setAuthMode("login");
            setGuestView("auth");
          }}
          onStart={(prompt) => {
            if (prompt) setMessageDraft(prompt);
            setAuthMode("register");
            setGuestView("auth");
          }}
        />
      </>
    );
  }

  if (!accessToken) {
    return (
      <>
        <BrandIntro />
        <AuthScreen
          authError={authError}
          displayName={displayName}
          email={email}
          isAuthenticating={isAuthenticating}
          mode={authMode}
          onBack={() => setGuestView("landing")}
          onDisplayNameChange={setDisplayName}
          onEmailChange={setEmail}
          onModeChange={(mode) => {
            setAuthError("");
            setAuthMode(mode);
          }}
          onPasswordChange={setPassword}
          onRememberMeChange={setRememberMe}
          onSubmit={handleAuthentication}
          password={password}
          rememberMe={rememberMe}
        />
      </>
    );
  }

  return (
    <>
    <BrandIntro />
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-lockup">
            <span className="brand-mark small">
              <Image alt="" height={40} priority src="/abhiai-logo.png" width={40} />
            </span>
            AbhiAI
          </div>
          <button className="new-chat-button" disabled={isCreatingConversation} onClick={createConversation} type="button">
            <span>＋</span> New chat
          </button>
        </div>

        <nav className="primary-navigation" aria-label="Workspace">
          <button
            aria-current={activeView === "chat" ? "page" : undefined}
            className={activeView === "chat" ? "active" : ""}
            onClick={() => setActiveView("chat")}
            type="button"
          >
            <span aria-hidden="true">◇</span> Chat
          </button>
          <button
            aria-current={activeView === "feed" ? "page" : undefined}
            className={activeView === "feed" ? "active" : ""}
            onClick={() => setActiveView("feed")}
            type="button"
          >
            <span aria-hidden="true">◎</span> Feed
          </button>
          <button
            aria-current={activeView === "explore" ? "page" : undefined}
            className={activeView === "explore" ? "active" : ""}
            onClick={() => setActiveView("explore")}
            type="button"
          >
            <span aria-hidden="true">✦</span> Explore
          </button>
          <button
            aria-current={activeView === "communities" ? "page" : undefined}
            className={activeView === "communities" ? "active" : ""}
            onClick={() => setActiveView("communities")}
            type="button"
          >
            <span aria-hidden="true">◈</span> Communities
          </button>
          <button
            aria-current={activeView === "articles" ? "page" : undefined}
            className={activeView === "articles" ? "active" : ""}
            onClick={() => setActiveView("articles")}
            type="button"
          >
            <span aria-hidden="true">▤</span> Articles
          </button>
          <button
            aria-current={activeView === "creator" ? "page" : undefined}
            className={activeView === "creator" ? "active" : ""}
            onClick={() => setActiveView("creator")}
            type="button"
          >
            <span aria-hidden="true">⌁</span> Creator Studio
          </button>
          <button
            aria-current={activeView === "messages" ? "page" : undefined}
            className={activeView === "messages" ? "active" : ""}
            onClick={() => setActiveView("messages")}
            type="button"
          >
            <span aria-hidden="true">✉</span> Messages
          </button>
          <button
            aria-current={activeView === "stories" ? "page" : undefined}
            className={activeView === "stories" ? "active" : ""}
            onClick={() => setActiveView("stories")}
            type="button"
          >
            <span aria-hidden="true">◌</span> Stories
          </button>
          <button
            aria-current={activeView === "videos" ? "page" : undefined}
            className={activeView === "videos" ? "active" : ""}
            onClick={() => setActiveView("videos")}
            type="button"
          >
            <span aria-hidden="true">▶</span> Videos
          </button>
          <button
            aria-current={activeView === "hashtags" ? "page" : undefined}
            className={activeView === "hashtags" ? "active" : ""}
            onClick={() => viewHashtag()}
            type="button"
          >
            <span aria-hidden="true">#</span> Tags
          </button>
          <button
            aria-current={activeView === "search" ? "page" : undefined}
            className={activeView === "search" ? "active" : ""}
            onClick={() => setActiveView("search")}
            type="button"
          >
            <span aria-hidden="true">⌕</span> Search
          </button>
          <button
            aria-current={activeView === "notifications" ? "page" : undefined}
            className={activeView === "notifications" ? "active" : ""}
            onClick={() => setActiveView("notifications")}
            type="button"
          >
            <span aria-hidden="true">♢</span> Notifications
            {unreadNotificationCount > 0 && (
              <strong className="notification-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </strong>
            )}
          </button>
          <button
            aria-current={activeView === "profile" ? "page" : undefined}
            className={activeView === "profile" ? "active" : ""}
            onClick={() => viewProfile()}
            type="button"
          >
            <span aria-hidden="true">○</span> Profile
          </button>
        </nav>

        <nav className={activeView === "chat" ? "conversation-list" : "conversation-list hidden"} aria-label="Conversations">
          <p className="list-label">Recent chats</p>
          {isLoadingConversations && <p className="muted-text">Loading conversations…</p>}
          {!isLoadingConversations && conversations.length === 0 && (
            <p className="muted-text">Start a new chat to begin.</p>
          )}
          {conversations.map((conversation) => (
            <button
              className={conversation.id === conversationId ? "conversation-item selected" : "conversation-item"}
              key={conversation.id}
              onClick={() => void selectConversation(accessToken, conversation.id)}
              type="button"
            >
              <span>{conversation.title}</span>
              <small>{formatDate(conversation.updatedAt)}</small>
            </button>
          ))}
        </nav>

        <button className="sign-out-button" onClick={signOut} type="button">Sign out</button>
      </aside>

      {activeView === "feed" ? (
        <FeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : activeView === "explore" ? (
        <ExplorePanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : activeView === "communities" ? (
        <CommunityPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : activeView === "articles" ? (
        <ArticlesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : activeView === "creator" ? (
        <CreatorDashboard accessToken={accessToken} onUnauthorized={handleSessionExpired} />
      ) : activeView === "messages" ? (
        <MessagesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : activeView === "stories" ? (
        <StoriesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : activeView === "videos" ? (
        <VideoFeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : activeView === "hashtags" ? (
        <HashtagPanel accessToken={accessToken} initialTag={selectedHashtag} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : activeView === "search" ? (
        <SearchPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : activeView === "notifications" ? (
        <NotificationsPanel
          accessToken={accessToken}
          onUnauthorized={handleSessionExpired}
          onUnreadCountChange={setUnreadNotificationCount}
          onViewProfile={viewProfile}
        />
      ) : activeView === "profile" ? (
        <ProfilePanel accessToken={accessToken} onUnauthorized={handleSessionExpired} username={profileUsername} />
      ) : (
      <section className="chat-panel">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h1>{selectedConversation.title}</h1>
              </div>
              <div className="conversation-actions">
                <button onClick={renameConversation} type="button">Rename</button>
                <button className="danger-button" onClick={deleteConversation} type="button">Delete</button>
              </div>
            </header>

            <div className="messages" aria-live="polite">
              {isLoadingHistory ? (
                <p className="muted-text">Loading messages…</p>
              ) : sortedMessages.length === 0 ? (
                <div className="empty-conversation">
                  <span className="brand-mark">
                    <Image alt="AbhiAI" height={56} src="/abhiai-logo.png" width={56} />
                  </span>
                  <h2>What would you like to explore?</h2>
                  <p>Ask a question, brainstorm an idea, or start building something new.</p>
                </div>
              ) : (
                sortedMessages.map((message) => (
                  <MessageBubble
                    copied={copiedMessageId === message.id}
                    key={message.id}
                    message={message}
                    onCopy={copyMessage}
                  />
                ))
              )}
              {isSending && <div className="assistant-status">AbhiAI is thinking…</div>}
              <div aria-hidden="true" ref={latestMessageRef} />
            </div>

            {chatError && <p className="chat-error">{chatError}</p>}
            <form className="composer" onSubmit={sendMessage}>
              {chatAttachments.length > 0 && (
                <div className="chat-attachments">
                  {chatAttachments.map((attachment) => (
                    <span key={attachment.id}>
                      <strong>{attachment.kind === "IMAGE" ? "Image" : "PDF"}</strong>
                      {attachment.filename}
                      <small>{attachment.processingStatus.toLowerCase()}</small>
                      <button
                        aria-label={`Remove ${attachment.filename}`}
                        onClick={() => void removeChatAttachment(attachment)}
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <label className="chat-attachment-picker" title="Attach image or PDF">
                <span aria-hidden="true">＋</span>
                <input
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  disabled={isSending || isUploadingAttachment || chatAttachments.length >= 5}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadChatAttachment(file);
                  }}
                  type="file"
                />
              </label>
              <textarea
                aria-label="Message AbhiAI"
                disabled={isSending}
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Message AbhiAI…"
                rows={1}
                value={messageDraft}
              />
              {isSending ? (
                <button aria-label="Stop generating" className="stop-button" onClick={stopGeneration} type="button">■</button>
              ) : (
                <button
                  aria-label="Send message"
                  disabled={!messageDraft.trim() || isUploadingAttachment}
                  type="submit"
                >
                  ↑
                </button>
              )}
            </form>
            <div className="chat-consent-controls">
              {chatAttachments.length > 0 && (
                <label>
                  <input
                    checked={externalProcessingAllowed}
                    onChange={(event) => setExternalProcessingAllowed(event.target.checked)}
                    type="checkbox"
                  />
                  Send selected attachment content to {process.env.NEXT_PUBLIC_AI_PROVIDER_NAME ?? "the configured AI provider"}
                </label>
              )}
              <label>
                <input
                  checked={webSearchAllowed}
                  onChange={(event) => setWebSearchAllowed(event.target.checked)}
                  type="checkbox"
                />
                Allow web search for this message
              </label>
            </div>
            <p className="composer-note">AbhiAI can make mistakes. Verify important information.</p>
          </>
        ) : (
          <div className="no-conversation">
            <span className="brand-mark">
              <Image alt="AbhiAI" height={56} src="/abhiai-logo.png" width={56} />
            </span>
            <h1>Ready when you are.</h1>
            <p>Create a new conversation to start chatting with AbhiAI.</p>
            <button className="primary-button" disabled={isCreatingConversation} onClick={createConversation} type="button">
              New chat
            </button>
          </div>
        )}
      </section>
      )}
    </main>
    </>
  );
}

function MessageBubble({
  copied,
  message,
  onCopy,
}: {
  copied: boolean;
  message: ChatMessage;
  onCopy: (message: ChatMessage) => void;
}) {
  const isUser = message.role === "USER";
  return (
    <article className={isUser ? "message user-message" : "message assistant-message"}>
      <div className="message-avatar">{isUser ? "You" : "A"}</div>
      <div className="message-body">
        <div className="message-meta">
          <p className="message-role">{isUser ? "You" : "AbhiAI"}</p>
          <button
            aria-label={`Copy ${isUser ? "your" : "AbhiAI"} message`}
            className="copy-message-button"
            onClick={() => void onCopy(message)}
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="message-content">{message.content}</p>
      </div>
    </article>
  );
}
