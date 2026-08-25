"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { BrandIntro } from "@/components/branding/brand-intro";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { ToolMenu, UploadPurpose } from "@/components/chat/tool-menu";
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
  ModelOption,
} from "@/lib/api";

const TOKEN_STORAGE_KEY = "abhiai.access-token";
const SESSION_TOKEN_STORAGE_KEY = "abhiai.session-access-token";

type AuthMode = "login" | "register";
type GuestView = "landing" | "auth";
type ActiveView = "chat" | "feed" | "explore" | "communities" | "articles" | "creator" | "messages" | "stories" | "videos" | "hashtags" | "search" | "notifications" | "profile";
type ComposerMode = "chat" | "image";
type AttachmentUploadState = {
  filename: string;
  label: string;
};

function errorMessage(error: unknown) {
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return "Unable to reach the AbhiAI backend. Check the API URL, CORS settings, and your connection.";
  }
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [guestView, setGuestView] = useState<GuestView>(pathname === "/login" ? "auth" : "landing");
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
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isChangingModel, setIsChangingModel] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [composerMode, setComposerMode] = useState<ComposerMode>("chat");
  const [isSending, setIsSending] = useState(false);
  const [hasStartedResponding, setHasStartedResponding] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [chatAttachments, setChatAttachments] = useState<ConversationAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentUpload, setAttachmentUpload] = useState<AttachmentUploadState | null>(null);
  const [externalProcessingAllowed, setExternalProcessingAllowed] = useState(false);
  const [webSearchAllowed, setWebSearchAllowed] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const streamAbortController = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<string | undefined>(undefined);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  const conversationId = selectedConversation?.id;
  const socialWorkspace = pathname === "/social";
  const sortedMessages = useMemo(
    () => selectedConversation?.messages ?? [],
    [selectedConversation],
  );

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

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
    setComposerMode("chat");
    setChatAttachments([]);
    setAttachmentUpload(null);
    setIsUploadingAttachment(false);
    setExternalProcessingAllowed(false);
    setWebSearchAllowed(false);
    setActiveView("chat");
    setUnreadNotificationCount(0);
    setAuthError(message);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setGuestView("auth");
    expireSession("Your session has expired. Please sign in again.");
    router.replace(`/login?next=${encodeURIComponent(pathname === "/social" ? "/social" : "/chat")}`);
  }, [expireSession, pathname, router]);

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
    if (!sessionResolved) return;
    queueMicrotask(() => {
      if (accessToken) {
        if (pathname === "/" || pathname === "/login") {
          router.replace("/chat");
          return;
        }
        if (pathname === "/social") {
          setActiveView((current) => current === "chat" ? "feed" : current);
        } else if (pathname === "/chat") {
          setActiveView("chat");
        }
        return;
      }

      if (pathname === "/login") {
        setGuestView("auth");
      } else if (pathname === "/chat" || pathname === "/social") {
        setGuestView("auth");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setGuestView("landing");
      }
    });
  }, [accessToken, pathname, router, sessionResolved]);

  useEffect(() => {
    if (!accessToken) return;

    let active = true;
    api.getModels(accessToken)
      .then((items) => { if (active) setModels(items); })
      .catch((error: unknown) => {
        if (active && error instanceof ApiError && error.status === 401) handleSessionExpired();
      });
    return () => { active = false; };
  }, [accessToken, handleSessionExpired]);

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

  async function changeConversationModel(value: string) {
    if (!accessToken || !selectedConversation || isChangingModel) return;
    const selectionMode = value === "AUTO" ? "AUTO" : "MANUAL";
    const selectedModelId = selectionMode === "AUTO" ? null : value;
    setChatError("");
    setIsChangingModel(true);
    try {
      const updated = await api.updateConversationModel(accessToken, selectedConversation.id, selectionMode, selectedModelId);
      setSelectedConversation((current) => current && current.id === updated.id ? { ...current, ...updated } : current);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      handleAuthenticatedError(error);
    } finally {
      setIsChangingModel(false);
    }
  }

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
    activeConversationIdRef.current = id;
    setIsLoadingHistory(true);
    setChatError("");
    setChatAttachments([]);
    setAttachmentUpload(null);
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
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      router.replace(requestedPath === "/social" ? "/social" : "/chat");
    } catch (error) {
      setAuthError(errorMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  function signOut() {
    expireSession();
    setGuestView("auth");
    router.replace("/login");
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
    if (composerMode === "image") {
      await generateImage(content);
      return;
    }
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
    setHasStartedResponding(false);
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
          setHasStartedResponding(true);
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
      setHasStartedResponding(false);
      setIsSending(false);
    }
  }

  async function generateImage(prompt: string) {
    if (!accessToken || !conversationId) return;
    setChatError("");
    setIsSending(true);
    setHasStartedResponding(false);
    setMessageDraft("");
    const abortController = new AbortController();
    streamAbortController.current = abortController;
    const pendingTimestamp = new Date().toISOString();
    const pendingUserMessage: ChatMessage = {
      id: `pending-image-user-${pendingTimestamp}`,
      role: "USER",
      content: prompt,
      createdAt: pendingTimestamp,
    };
    setSelectedConversation((current) => current && current.id === conversationId
      ? { ...current, messages: [...current.messages, pendingUserMessage] }
      : current);
    try {
      const exchange = await api.generateImage(accessToken, conversationId, prompt, abortController.signal);
      setSelectedConversation((current) => current && current.id === conversationId
        ? {
            ...current,
            title: exchange.conversation.title,
            updatedAt: exchange.assistantMessage.createdAt,
            messages: [
              ...current.messages.filter((message) => message.id !== pendingUserMessage.id),
              exchange.userMessage,
              exchange.assistantMessage,
            ],
          }
        : current);
      setConversations((current) => current
        .map((item) => item.id === conversationId ? exchange.conversation : item)
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
      setComposerMode("chat");
    } catch (error) {
      setMessageDraft(prompt);
      setSelectedConversation((current) => current && current.id === conversationId
        ? { ...current, messages: current.messages.filter((message) => message.id !== pendingUserMessage.id) }
        : current);
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatError("Image generation stopped.");
      } else {
        handleAuthenticatedError(error);
      }
    } finally {
      streamAbortController.current = null;
      setIsSending(false);
    }
  }

  async function uploadChatAttachment(file: File, purpose: UploadPurpose) {
    if (!accessToken || !conversationId || isUploadingAttachment) return;
    const targetConversationId = conversationId;
    const normalizedType = file.type.toLowerCase();
    const allowed = purpose === "image"
      ? ["image/jpeg", "image/png", "image/webp"]
      : purpose === "pdf"
        ? ["application/pdf"]
        : ["text/plain"];
    if (!allowed.includes(normalizedType)) {
      setChatError(purpose === "image"
        ? "Choose a JPEG, PNG, or WebP image."
        : purpose === "pdf"
          ? "Choose a PDF document."
          : "Choose a plain-text document.");
      return;
    }
    const sizeLimit = purpose === "image" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > sizeLimit) {
      setChatError(`This ${purpose === "image" ? "image" : "document"} exceeds the ${sizeLimit / 1024 / 1024} MB limit.`);
      return;
    }
    setIsUploadingAttachment(true);
    setAttachmentUpload({
      filename: file.name,
      label: purpose === "image" ? "Image" : purpose === "pdf" ? "PDF" : "Text",
    });
    setChatError("");
    try {
      const attachment = await api.uploadConversationAttachment(accessToken, targetConversationId, file);
      if (activeConversationIdRef.current !== targetConversationId) {
        await api.deleteConversationAttachment(accessToken, targetConversationId, attachment.id).catch(() => undefined);
        return;
      }
      setChatAttachments((current) => [...current, attachment]);
      if (attachment.processingStatus === "FAILED") {
        setChatError(attachment.processingError ?? "Attachment processing failed.");
      }
    } catch (error) {
      handleAuthenticatedError(error);
    } finally {
      setIsUploadingAttachment(false);
      setAttachmentUpload(null);
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
        {pathname === "/" && <BrandIntro />}
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
            router.push("/login");
          }}
          onStart={(prompt) => {
            if (prompt) setMessageDraft(prompt);
            setAuthMode("register");
            setGuestView("auth");
            router.push("/login");
          }}
        />
      </>
    );
  }

  if (!accessToken) {
    return (
      <>
        <AuthScreen
          authError={authError}
          displayName={displayName}
          email={email}
          isAuthenticating={isAuthenticating}
          mode={authMode}
          onBack={() => {
            setGuestView("landing");
            router.push("/");
          }}
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
    <main className="app-shell">
      <aside className={socialWorkspace ? "sidebar social-sidebar" : "sidebar"}>
        <div className="sidebar-header">
          <div className="brand-lockup">
            <span className="brand-mark small">
              <Image alt="" height={40} priority src="/abhiai-logo.png" width={40} />
            </span>
            AbhiAI
          </div>
          {!socialWorkspace && (
            <button className="new-chat-button" disabled={isCreatingConversation} onClick={createConversation} type="button">
              <span>＋</span> New chat
            </button>
          )}
        </div>

        <div aria-label="Choose workspace" className="workspace-switcher" role="navigation">
          <button
            aria-current={!socialWorkspace ? "page" : undefined}
            className={!socialWorkspace ? "active" : ""}
            onClick={() => { setActiveView("chat"); router.push("/chat"); }}
            type="button"
          >
            <span aria-hidden="true">✦</span> AbhiAI
          </button>
          <button
            aria-current={socialWorkspace ? "page" : undefined}
            className={socialWorkspace ? "active" : ""}
            onClick={() => { setActiveView("feed"); router.push("/social"); }}
            type="button"
          >
            <span aria-hidden="true">◎</span> Social
          </button>
        </div>

        <nav className="primary-navigation" aria-label="Workspace">
          {!socialWorkspace ? (
            <button aria-current="page" className="active" onClick={() => setActiveView("chat")} type="button">
              <span aria-hidden="true">◇</span> AI Chat
            </button>
          ) : (<>
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
          </>)}
        </nav>

        <nav className={!socialWorkspace ? "conversation-list" : "conversation-list hidden"} aria-label="Conversations">
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

      {socialWorkspace && activeView === "feed" ? (
        <FeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "explore" ? (
        <ExplorePanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "communities" ? (
        <CommunityPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "articles" ? (
        <ArticlesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "creator" ? (
        <CreatorDashboard accessToken={accessToken} onUnauthorized={handleSessionExpired} />
      ) : socialWorkspace && activeView === "messages" ? (
        <MessagesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "stories" ? (
        <StoriesPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "videos" ? (
        <VideoFeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "hashtags" ? (
        <HashtagPanel accessToken={accessToken} initialTag={selectedHashtag} onUnauthorized={handleSessionExpired} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "search" ? (
        <SearchPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "notifications" ? (
        <NotificationsPanel
          accessToken={accessToken}
          onUnauthorized={handleSessionExpired}
          onUnreadCountChange={setUnreadNotificationCount}
          onViewProfile={viewProfile}
        />
      ) : socialWorkspace && activeView === "profile" ? (
        <ProfilePanel accessToken={accessToken} onUnauthorized={handleSessionExpired} username={profileUsername} />
      ) : socialWorkspace ? (
        <FeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : (
      <section className="chat-panel">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <div>
                <p className="eyebrow">Conversation</p>
                <h1>{selectedConversation.title}</h1>
              </div>
              <label className="model-selector">
                <span>Model</span>
                <select
                  aria-label="AI model"
                  disabled={isChangingModel || isSending}
                  onChange={(event) => void changeConversationModel(event.target.value)}
                  value={selectedConversation.modelSelectionMode === "MANUAL" ? selectedConversation.preferredModelId ?? "AUTO" : "AUTO"}
                >
                  <option value="AUTO">✦ AbhiAI Auto</option>
                  {models.map((model) => (
                    <option
                      disabled={model.status === "UNAVAILABLE" || model.status === "RATE_LIMITED" || model.status === "COMING_SOON" || !model.configured}
                      key={model.id}
                      value={model.id}
                    >
                      {model.displayName} · {model.provider}{model.status === "COMING_SOON" ? " — Coming soon" : model.status === "RATE_LIMITED" ? " — Rate limited" : !model.configured ? " — Not configured" : ""}
                    </option>
                  ))}
                </select>
              </label>
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
                    accessToken={accessToken}
                    copied={copiedMessageId === message.id}
                    key={message.id}
                    message={message}
                    onCopy={copyMessage}
                  />
                ))
              )}
              {isSending && !hasStartedResponding && <ThinkingIndicator />}
              <div aria-hidden="true" ref={latestMessageRef} />
            </div>

            {chatError && <p className="chat-error">{chatError}</p>}
            <form className="composer" onSubmit={sendMessage}>
              {composerMode === "image" && (
                <div className="composer-mode">
                  <span><b>✦</b> Image generation</span>
                  <button aria-label="Exit image generation mode" onClick={() => setComposerMode("chat")} type="button">×</button>
                </div>
              )}
              {(attachmentUpload || chatAttachments.length > 0) && (
                <div aria-live="polite" className="chat-attachments">
                  {attachmentUpload && (
                    <span className="uploading-attachment" role="status">
                      <i aria-hidden="true" className="attachment-spinner" />
                      <strong>{attachmentUpload.label}</strong>
                      <b title={attachmentUpload.filename}>{attachmentUpload.filename}</b>
                      <small>uploading…</small>
                    </span>
                  )}
                  {chatAttachments.map((attachment) => (
                    <span key={attachment.id}>
                      {attachment.kind === "IMAGE" && (
                        <AuthenticatedImage accessToken={accessToken} alt={attachment.filename} className="chat-attachment-thumbnail" mediaId={attachment.mediaId} thumbnail />
                      )}
                      <strong>{attachment.kind === "IMAGE" ? "Image" : attachment.contentType === "text/plain" ? "Text" : "PDF"}</strong>
                      <b title={attachment.filename}>{attachment.filename}</b>
                      <small>
                        {attachment.processingStatus === "READY"
                          ? `ready · ${formatFileSize(attachment.byteSize)}`
                          : attachment.processingStatus.toLowerCase()}
                      </small>
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
              <ToolMenu
                disabled={isSending || isUploadingAttachment || chatAttachments.length >= 5}
                onGenerateImage={() => {
                  setChatAttachments([]);
                  setExternalProcessingAllowed(false);
                  setComposerMode("image");
                  setChatError("");
                }}
                onUpload={(file, purpose) => void uploadChatAttachment(file, purpose)}
              />
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
                placeholder={composerMode === "image" ? "Describe the image you want to create…" : "Message AbhiAI…"}
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
                <label className={!externalProcessingAllowed ? "required-consent" : undefined}>
                  <input
                    checked={externalProcessingAllowed}
                    onChange={(event) => setExternalProcessingAllowed(event.target.checked)}
                    type="checkbox"
                  />
                  Allow AbhiAI to send this attachment to {process.env.NEXT_PUBLIC_AI_PROVIDER_NAME ?? "the configured AI provider"}
                  {!externalProcessingAllowed && <strong>Required</strong>}
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
  accessToken,
  copied,
  message,
  onCopy,
}: {
  accessToken: string;
  copied: boolean;
  message: ChatMessage;
  onCopy: (message: ChatMessage) => void;
}) {
  const isUser = message.role === "USER";
  return (
    <article className={isUser ? "message user-message" : "message assistant-message"}>
      <div className="message-avatar">
        {isUser ? "You" : <Image alt="AbhiAI" height={32} src="/abhiai-logo.png" width={32} />}
      </div>
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
        {!isUser && message.model && (
          <p className="model-attribution">
            Answered using {providerLabel(message.provider)} · {message.model}{message.fallbackUsed ? " · fallback used" : ""}
          </p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => attachment.kind === "IMAGE" ? (
              <AuthenticatedImage
                accessToken={accessToken}
                alt={attachment.filename}
                className="generated-chat-image"
                key={attachment.id}
                mediaId={attachment.mediaId}
              />
            ) : (
              <span className="message-document" key={attachment.id}>▤ {attachment.filename}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function providerLabel(provider?: string | null) {
  const labels: Record<string, string> = {
    openai: "OpenAI", gemini: "Google Gemini", groq: "Groq", ollama: "Local / Ollama",
    anthropic: "Anthropic", xai: "xAI", deepseek: "DeepSeek", mistral: "Mistral",
    cohere: "Cohere", openrouter: "OpenRouter", abhena: "Abhena",
  };
  return provider ? labels[provider] ?? provider : "AbhiAI";
}
