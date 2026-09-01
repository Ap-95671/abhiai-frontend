"use client";

import { CSSProperties, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { BrandIntro } from "@/components/branding/brand-intro";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { MessageContent } from "@/components/chat/message-content";
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
import { NewsPanel } from "@/components/news/news-panel";
import { AppIcon, AppIconName } from "@/components/ui/app-icon";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

import {
  api,
  ApiError,
  ChatMessage,
  ConversationAttachment,
  ConversationDetail,
  ConversationSummary,
  ModelOption,
  UserProfile,
} from "@/lib/api";
import { NEWS_CHAT_PROMPT_STORAGE_KEY } from "@/lib/news";

const TOKEN_STORAGE_KEY = "abhiai.access-token";
const SESSION_TOKEN_STORAGE_KEY = "abhiai.session-access-token";
const SIDEBAR_STORAGE_KEY = "abhiai.sidebar-collapsed";
const ACTIVE_CONVERSATION_STORAGE_KEY = "abhiai.active-conversation-id";

type AuthMode = "login" | "register";
type GuestView = "landing" | "auth";
type ActiveView = "chat" | "feed" | "news" | "explore" | "communities" | "articles" | "creator" | "messages" | "stories" | "videos" | "hashtags" | "search" | "notifications" | "profile";
type ComposerMode = "chat" | "image";
type AttachmentUploadState = {
  filename: string;
  label: string;
};

type ToastMessage = { id: number; message: string; tone?: "default" | "error" };
type ConversationGroup = { label: string; items: ConversationSummary[] };

const socialNavigation: Array<{ view: ActiveView; label: string; icon: AppIconName }> = [
  { view: "feed", label: "Feed", icon: "feed" },
  { view: "explore", label: "Explore", icon: "explore" },
  { view: "news", label: "News", icon: "globe" },
  { view: "communities", label: "Communities", icon: "community" },
  { view: "articles", label: "Articles", icon: "article" },
  { view: "creator", label: "Creator Studio", icon: "create" },
  { view: "messages", label: "Messages", icon: "message" },
  { view: "stories", label: "Stories", icon: "story" },
  { view: "videos", label: "Videos", icon: "video" },
  { view: "hashtags", label: "Tags", icon: "hash" },
  { view: "search", label: "Search", icon: "search" },
  { view: "notifications", label: "Notifications", icon: "bell" },
  { view: "profile", label: "Profile", icon: "profile" },
];

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

function groupConversations(items: ConversationSummary[]): ConversationGroup[] {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const groups = [
    { label: "Today", min: startToday },
    { label: "Yesterday", min: startToday - day },
    { label: "Previous 7 days", min: startToday - 7 * day },
    { label: "Older", min: Number.NEGATIVE_INFINITY },
  ];
  return groups.map((group, index) => ({
    label: group.label,
    items: items.filter((item) => {
      const value = new Date(item.updatedAt).getTime();
      const max = index === 0 ? Number.POSITIVE_INFINITY : groups[index - 1].min;
      return value >= group.min && value < max;
    }),
  })).filter((group) => group.items.length > 0);
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
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [conversationDialog, setConversationDialog] = useState<"rename" | "delete" | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [conversationStateResolved, setConversationStateResolved] = useState(false);
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
  const [showLatest, setShowLatest] = useState(false);
  const streamAbortController = useRef<AbortController | null>(null);
  const createConversationLockRef = useRef(false);
  const activeConversationIdRef = useRef<string | undefined>(undefined);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const accountControlRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [accountMenuStyle, setAccountMenuStyle] = useState<CSSProperties>();
  const shouldFollowStreamRef = useRef(true);
  const pendingNewsPromptStartedRef = useRef(false);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMobileSidebarOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); };
  }, [mobileSidebarOpen]);

  const conversationId = selectedConversation?.id;
  const socialWorkspace = pathname === "/social" || pathname === "/news";
  const sortedMessages = useMemo(
    () => selectedConversation?.messages ?? [],
    [selectedConversation],
  );
  const conversationGroups = useMemo(() => groupConversations(conversations), [conversations]);

  const showToast = useCallback((message: string, tone: ToastMessage["tone"] = "default") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    activeConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    queueMicrotask(() => setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const closeAccountMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!accountControlRef.current?.contains(target) && !accountMenuRef.current?.contains(target)) {
        setAccountMenuOpen(false);
      }
      if (!(event.target as Element).closest?.(".conversation-row")) setConversationMenuId(null);
    };
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, []);

  useEffect(() => {
    const closeOverlays = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (accountMenuRef.current) accountTriggerRef.current?.focus();
      setAccountMenuOpen(false);
      setMobileSidebarOpen(false);
      setConversationDialog(null);
      setConversationMenuId(null);
    };
    document.addEventListener("keydown", closeOverlays);
    return () => document.removeEventListener("keydown", closeOverlays);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const positionAccountMenu = () => {
      const trigger = accountTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = sidebarCollapsed ? 220 : Math.max(210, rect.width);
      const preferredLeft = sidebarCollapsed ? rect.right + 10 : rect.left;
      setAccountMenuStyle({
        bottom: Math.max(12, window.innerHeight - rect.top + 8),
        left: Math.min(Math.max(12, preferredLeft), window.innerWidth - menuWidth - 12),
        width: menuWidth,
      });
    };

    positionAccountMenu();
    const focusTimer = window.setTimeout(() => accountMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(), 0);
    window.addEventListener("resize", positionAccountMenu);
    window.addEventListener("scroll", positionAccountMenu, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", positionAccountMenu);
      window.removeEventListener("scroll", positionAccountMenu, true);
    };
  }, [accountMenuOpen, sidebarCollapsed]);

  useEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [messageDraft, conversationId]);

  const expireSession = useCallback((message = "") => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    setAccessToken(null);
    setEmail("");
    setPassword("");
    setConversations([]);
    setSelectedConversation(null);
    setConversationStateResolved(false);
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
    setCurrentUser(null);
    setMobileSidebarOpen(false);
    setAccountMenuOpen(false);
    setAuthError(message);
  }, []);

  const handleSessionExpired = useCallback(() => {
    setGuestView("auth");
    expireSession("Your session has expired. Please sign in again.");
    router.replace(`/login?next=${encodeURIComponent(pathname === "/news" ? "/news" : pathname === "/social" ? "/social" : "/chat")}`);
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
        } else if (pathname === "/news") {
          setActiveView("news");
        } else if (pathname === "/chat") {
          setActiveView("chat");
        }
        return;
      }

      if (pathname === "/login") {
        setGuestView("auth");
      } else if (pathname === "/chat" || pathname === "/social" || pathname === "/news") {
        setGuestView("auth");
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setGuestView("landing");
      }
    });
  }, [accessToken, pathname, router, sessionResolved]);

  useEffect(() => {
    if (!accessToken || socialWorkspace) return;

    let active = true;
    api.getModels(accessToken)
      .then((items) => { if (active) setModels(items); })
      .catch((error: unknown) => {
        if (active && error instanceof ApiError && error.status === 401) handleSessionExpired();
      });
    return () => { active = false; };
  }, [accessToken, handleSessionExpired, socialWorkspace]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    api.getCurrentProfile(accessToken)
      .then((profile) => { if (active) setCurrentUser(profile); })
      .catch((error: unknown) => {
        if (active && error instanceof ApiError && error.status === 401) handleSessionExpired();
      });
    return () => { active = false; };
  }, [accessToken, handleSessionExpired]);

  useEffect(() => {
    if (!accessToken || socialWorkspace) return;

    let isCurrent = true;
    queueMicrotask(() => {
      if (isCurrent) {
        setIsLoadingConversations(true);
        setConversationStateResolved(false);
        setChatError("");
      }
    });

    api
      .getConversations(accessToken)
      .then(async (items) => {
        if (!isCurrent) return;
        setConversations(items);

        const storedConversationId = window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
        const storedConversation = storedConversationId
          ? items.find((item) => item.id === storedConversationId)
          : undefined;

        if (!storedConversation) {
          if (storedConversationId) window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
          setSelectedConversation(null);
          return;
        }

        setIsLoadingHistory(true);
        const conversation = await api.getConversation(accessToken, storedConversation.id);
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
          setConversationStateResolved(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [accessToken, handleSessionExpired, socialWorkspace]);

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
    if (!accessToken || !socialWorkspace) return;

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
  }, [accessToken, handleSessionExpired, socialWorkspace]);

  useEffect(() => {
    if (!shouldFollowStreamRef.current) return;
    latestMessageRef.current?.scrollIntoView({ behavior: isSending ? "smooth" : "auto", block: "end" });
  }, [isSending, sortedMessages]);

  function handleMessageScroll() {
    const container = messagesRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    shouldFollowStreamRef.current = nearBottom;
    setShowLatest(!nearBottom);
  }

  function scrollToLatest() {
    shouldFollowStreamRef.current = true;
    setShowLatest(false);
    latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  function navigateWorkspace(view: ActiveView, workspace: "chat" | "social" = "social") {
    setActiveView(view);
    setMobileSidebarOpen(false);
    if (workspace === "chat") {
      activeConversationIdRef.current = undefined;
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      setSelectedConversation(null);
      setConversationStateResolved(true);
      setChatError("");
    }
    router.push(workspace === "chat" ? "/chat" : view === "news" ? "/news" : "/social");
  }

  async function selectConversation(token: string, id: string) {
    activeConversationIdRef.current = id;
    shouldFollowStreamRef.current = true;
    setShowLatest(false);
    setIsLoadingHistory(true);
    setChatError("");
    setChatAttachments([]);
    setAttachmentUpload(null);
    setExternalProcessingAllowed(false);
    setWebSearchAllowed(false);
    try {
      const conversation = await api.getConversation(token, id);
      setSelectedConversation(conversation);
      window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, id);
      setConversationStateResolved(true);
      return conversation;
    } catch (error) {
      handleAuthenticatedError(error);
      return null;
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
      router.replace(requestedPath === "/social" || requestedPath === "/news" ? requestedPath : "/chat");
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

  async function createConversation(): Promise<ConversationDetail | null> {
    if (!accessToken || createConversationLockRef.current) return null;

    createConversationLockRef.current = true;
    setIsCreatingConversation(true);
    setChatError("");
    try {
      const conversation = await api.createConversation(accessToken);
      setActiveView("chat");
      setConversations((current) => [conversation, ...current]);
      const selected = await selectConversation(accessToken, conversation.id);
      setMobileSidebarOpen(false);
      return selected;
    } catch (error) {
      handleAuthenticatedError(error);
      return null;
    } finally {
      createConversationLockRef.current = false;
      setIsCreatingConversation(false);
    }
  }

  async function openConversationAction(conversation: ConversationSummary, action: "rename" | "delete") {
    if (!accessToken) return;
    if (selectedConversation?.id !== conversation.id && !await selectConversation(accessToken, conversation.id)) return;
    setRenameDraft(conversation.title);
    setConversationMenuId(null);
    setConversationDialog(action);
  }

  async function startQuickAction(
    mode: ComposerMode,
    draft: string,
    allowWebSearch = false,
    sendImmediately = false,
  ) {
    const content = draft.trim();
    setComposerMode(mode);
    setMessageDraft(draft);
    setWebSearchAllowed(allowWebSearch);
    const conversation = await createConversation();
    if (!conversation) return;
    if (sendImmediately && mode === "chat" && content) {
      await sendTextMessage(conversation, content, allowWebSearch);
      return;
    }
    composerTextareaRef.current?.focus();
  }

  useEffect(() => {
    if (!accessToken || socialWorkspace || !conversationStateResolved || pendingNewsPromptStartedRef.current) return;
    const prompt = window.sessionStorage.getItem(NEWS_CHAT_PROMPT_STORAGE_KEY);
    if (!prompt) return;
    pendingNewsPromptStartedRef.current = true;
    window.sessionStorage.removeItem(NEWS_CHAT_PROMPT_STORAGE_KEY);
    queueMicrotask(() => {
      void startQuickAction("chat", prompt, false, true).finally(() => {
        pendingNewsPromptStartedRef.current = false;
      });
    });
    // startQuickAction is a function declaration tied to this mounted workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, conversationStateResolved, socialWorkspace]);

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function sendTextMessage(
    targetConversation: ConversationDetail,
    content: string,
    allowWebSearch = webSearchAllowed,
  ) {
    const targetConversationId = targetConversation.id;
    if (!accessToken || !content || isSending || isUploadingAttachment) return;
    if (chatAttachments.some((attachment) => attachment.processingStatus !== "READY")) {
      setChatError("Remove failed attachments or wait until processing completes.");
      return;
    }
    if (chatAttachments.length > 0 && !externalProcessingAllowed) {
      setChatError("Confirm external AI processing for the selected attachments.");
      return;
    }

    const existingPendingUserMessage = targetConversation.messages.at(-1);
    const shouldReusePendingUser = Boolean(
      existingPendingUserMessage
      && existingPendingUserMessage.role === "USER"
      && existingPendingUserMessage.id.startsWith("pending-user-")
      && existingPendingUserMessage.content === content,
    );

    setChatError("");
    setIsSending(true);
    setHasStartedResponding(false);
    setMessageDraft("");
    const abortController = new AbortController();
    streamAbortController.current = abortController;

    const pendingTimestamp = new Date().toISOString();
    const pendingUserMessage: ChatMessage = shouldReusePendingUser && existingPendingUserMessage
      ? existingPendingUserMessage
      : {
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
      current && current.id === targetConversationId
        ? {
            ...current,
            messages: shouldReusePendingUser
              ? [...current.messages, pendingAssistantMessage]
              : [...current.messages, pendingUserMessage, pendingAssistantMessage],
          }
        : current,
    );

    try {
      const exchange = await api.sendMessageStream(
        accessToken,
        targetConversationId,
        content,
        (chunk) => {
          setHasStartedResponding(true);
          setSelectedConversation((current) =>
            current && current.id === targetConversationId
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
          webSearchAllowed: allowWebSearch,
          selectionMode: targetConversation.modelSelectionMode,
          selectedModelId: targetConversation.preferredModelId,
          fallbackAllowed: targetConversation.modelSelectionMode === "AUTO",
        },
      );
      setChatAttachments([]);
      setExternalProcessingAllowed(false);
      setSelectedConversation((current) =>
        current && current.id === targetConversationId
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
          .map((item) => item.id === targetConversationId ? exchange.conversation : item)
          .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
      );
    } catch (error) {
      setMessageDraft(content);
      setSelectedConversation((current) =>
        current && current.id === targetConversationId
          ? {
              ...current,
              messages: current.messages.filter((item) => item.id !== pendingAssistantMessage.id),
            }
          : current,
      );
      if (error instanceof DOMException && error.name === "AbortError") {
        setChatError("Generation stopped. Your message is ready to retry.");
      } else {
        handleAuthenticatedError(error);
        void api.getModels(accessToken)
          .then(setModels)
          .catch((catalogError: unknown) => {
            if (catalogError instanceof ApiError && catalogError.status === 401) {
              handleSessionExpired();
            }
          });
      }
    } finally {
      streamAbortController.current = null;
      setHasStartedResponding(false);
      setIsSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!accessToken || !selectedConversation || !content || isSending || isUploadingAttachment) return;
    if (composerMode === "image") {
      await generateImage(content);
      return;
    }
    await sendTextMessage(selectedConversation, content);
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
      showToast(`${file.name} is ready`);
      if (attachment.processingStatus === "FAILED") {
        setChatError(attachment.processingError ?? "Attachment processing failed.");
      }
    } catch (error) {
      showToast("Upload failed", "error");
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
      showToast("Copied to clipboard");
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setChatError("Unable to copy this message. Please select the text manually.");
    }
  }

  async function renameConversation() {
    if (!accessToken || !selectedConversation) return;
    const title = renameDraft.trim();
    if (!title || title === selectedConversation.title) return;

    try {
      const updated = await api.renameConversation(accessToken, selectedConversation.id, title);
      setSelectedConversation((current) => (current ? { ...current, ...updated } : current));
      setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setConversationDialog(null);
      showToast("Conversation renamed");
    } catch (error) {
      handleAuthenticatedError(error);
    }
  }

  async function deleteConversation() {
    if (!accessToken || !selectedConversation) return;

    try {
      await api.deleteConversation(accessToken, selectedConversation.id);
      const remaining = conversations.filter((item) => item.id !== selectedConversation.id);
      setConversations(remaining);
      setSelectedConversation(null);
      activeConversationIdRef.current = undefined;
      window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
      setConversationDialog(null);
      showToast("Conversation deleted");
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
    <main className={sidebarCollapsed ? "app-shell sidebar-is-collapsed" : "app-shell"}>
      <button
        aria-controls="app-sidebar"
        aria-expanded={mobileSidebarOpen}
        aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
        className="mobile-sidebar-trigger"
        onClick={() => setMobileSidebarOpen((current) => !current)}
        type="button"
      >
        <AppIcon name={mobileSidebarOpen ? "chevron-left" : "menu"} />
      </button>
      {mobileSidebarOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setMobileSidebarOpen(false)} type="button" />}
      <aside aria-label={socialWorkspace ? "Social navigation" : "AI navigation"} className={`${socialWorkspace ? "sidebar social-sidebar" : "sidebar"}${mobileSidebarOpen ? " mobile-open" : ""}`} id="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-row">
          <div className="brand-lockup" title="AbhiAI">
            <span className="brand-mark small">
              <Image alt="" height={40} priority src="/abhiai-logo.png" width={40} />
            </span>
            <span className="sidebar-label">AbhiAI</span>
          </div>
          <button
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sidebar-collapse-button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            <AppIcon name={sidebarCollapsed ? "chevron-right" : "chevron-left"} />
          </button>
          </div>
          {!socialWorkspace && (
            <button aria-label="New conversation" className="new-chat-button" disabled={isCreatingConversation} onClick={() => { setMobileSidebarOpen(false); void createConversation(); }} title="New conversation" type="button">
              <AppIcon name="plus" /> <span className="sidebar-label">New conversation</span>
            </button>
          )}
        </div>

        <div aria-label="Choose workspace" className="workspace-switcher" role="navigation">
          <button
            aria-current={!socialWorkspace ? "page" : undefined}
            className={!socialWorkspace ? "active" : ""}
            onClick={() => navigateWorkspace("chat", "chat")}
            title="AbhiAI"
            type="button"
          >
            <AppIcon name="ai" /> <span className="sidebar-label">AbhiAI</span>
          </button>
          <button
            aria-current={socialWorkspace ? "page" : undefined}
            className={socialWorkspace ? "active" : ""}
            onClick={() => navigateWorkspace("feed")}
            title="Social"
            type="button"
          >
            <AppIcon name="social" /> <span className="sidebar-label">Social</span>
          </button>
        </div>

        <nav className="primary-navigation" aria-label="Workspace">
          {!socialWorkspace ? (
            <button aria-current="page" className="active" onClick={() => navigateWorkspace("chat", "chat")} title="AI Chat" type="button">
              <AppIcon name="ai" /> <span className="sidebar-label">AI Chat</span>
            </button>
          ) : (<>
          {socialNavigation.map((item) => (
            <button
              aria-current={activeView === item.view ? "page" : undefined}
              className={activeView === item.view ? "active" : ""}
              key={item.view}
              onClick={() => item.view === "news" ? navigateWorkspace("news") : item.view === "hashtags" ? (viewHashtag(), setMobileSidebarOpen(false)) : item.view === "profile" ? (viewProfile(), setMobileSidebarOpen(false)) : (setActiveView(item.view), setMobileSidebarOpen(false))}
              title={item.label}
              type="button"
            >
              <AppIcon name={item.icon} /> <span className="sidebar-label">{item.label}</span>
              {item.view === "notifications" && unreadNotificationCount > 0 && (
                <strong className="notification-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </strong>
              )}
            </button>
          ))}
          </>)}
        </nav>

        <nav className={!socialWorkspace ? "conversation-list" : "conversation-list hidden"} aria-label="Conversations">
          <p className="list-label">Recent chats</p>
          {isLoadingConversations && <div aria-label="Loading conversations" className="conversation-skeletons" role="status"><i/><i/><i/></div>}
          {!isLoadingConversations && conversations.length === 0 && (
            <p className="muted-text">Start a new chat to begin.</p>
          )}
          {conversationGroups.map((group) => <div className="conversation-group" key={group.label}>
            <p className="conversation-group-label">{group.label}</p>
            {group.items.map((conversation) => (
            <div className="conversation-row" key={conversation.id}>
            <button
              className={conversation.id === conversationId ? "conversation-item selected" : "conversation-item"}
              onClick={() => { setConversationMenuId(null); setMobileSidebarOpen(false); void selectConversation(accessToken, conversation.id); }}
              title={conversation.title}
              type="button"
            >
              <span>{conversation.title}</span>
              <small>{formatDate(conversation.updatedAt)}</small>
            </button>
            <button aria-expanded={conversationMenuId === conversation.id} aria-haspopup="menu" aria-label={`Actions for ${conversation.title}`} className="conversation-more-button" onClick={() => setConversationMenuId((current) => current === conversation.id ? null : conversation.id)} type="button"><AppIcon name="more"/></button>
            {conversationMenuId === conversation.id && <div className="conversation-menu" role="menu"><button onClick={() => void openConversationAction(conversation, "rename")} role="menuitem" type="button">Rename</button><button className="danger-menu-item" onClick={() => void openConversationAction(conversation, "delete")} role="menuitem" type="button">Delete</button></div>}
            </div>
            ))}
          </div>)}
        </nav>

        <div className="account-control" ref={accountControlRef}>
          <button
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            className="account-trigger"
            onClick={() => setAccountMenuOpen((current) => !current)}
            ref={accountTriggerRef}
            title={sidebarCollapsed ? "Account menu" : currentUser?.displayName ?? "Account menu"}
            type="button"
          >
            <UserAvatar accessToken={accessToken} className="account-avatar" displayName={currentUser?.displayName ?? "AbhiAI"} profileMediaId={currentUser?.profileMediaId} profilePicture={currentUser?.profilePicture}/>
            <span className="account-copy sidebar-label"><strong>{currentUser?.displayName ?? "Your account"}</strong><small>{currentUser ? `@${currentUser.username}` : "Profile and sign out"}</small></span>
            <AppIcon className="sidebar-label" name="more" />
          </button>
        </div>
      </aside>

      {socialWorkspace && activeView === "feed" ? (
        <FeedPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "explore" ? (
        <ExplorePanel accessToken={accessToken} onUnauthorized={handleSessionExpired} onViewHashtag={viewHashtag} onViewProfile={viewProfile} />
      ) : socialWorkspace && activeView === "news" ? (
        <NewsPanel accessToken={accessToken} onUnauthorized={handleSessionExpired} />
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
        {!conversationStateResolved ? (
          <div aria-label="Loading your AI workspace" className="ai-home ai-home-loading" role="status">
            <span className="brand-mark ai-home-logo"><Image alt="" height={64} src="/abhiai-logo.png" width={64} /></span>
            <p>Restoring your workspace…</p>
          </div>
        ) : selectedConversation ? (
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
                  <option value="AUTO">✦ AbhiAI Auto · smart routing</option>
                  {models.map((model) => (
                    <option
                      disabled={model.status === "UNAVAILABLE" || model.status === "RATE_LIMITED" || model.status === "COMING_SOON" || !model.configured}
                      key={model.id}
                      value={model.id}
                    >
                      {model.displayName} · {model.provider}{model.status === "COMING_SOON" ? " — Coming soon" : model.status === "RATE_LIMITED" ? " — Rate limited" : model.status === "UNAVAILABLE" ? " — Unavailable" : model.status === "DEGRADED" ? " — Degraded" : !model.configured ? " — Not configured" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="conversation-actions">
                <button onClick={() => { setRenameDraft(selectedConversation.title); setConversationDialog("rename"); }} type="button">Rename</button>
                <button className="danger-button" onClick={() => setConversationDialog("delete")} type="button">Delete</button>
              </div>
            </header>

            <div className="messages" aria-live="polite" onScroll={handleMessageScroll} ref={messagesRef}>
              {isLoadingHistory ? (
                <div aria-label="Loading messages" className="message-skeletons" role="status"><i/><i/><i/></div>
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

            {showLatest && <button className="latest-message-button" onClick={scrollToLatest} type="button">↓ Latest</button>}

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
                onKeyDown={handleComposerKeyDown}
                placeholder={composerMode === "image" ? "Describe the image you want to create…" : "Message AbhiAI…"}
                ref={composerTextareaRef}
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
                  <AppIcon name="send" />
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
          <div className="ai-home">
            <div className="ai-home-intro">
              <span className="brand-mark ai-home-logo"><Image alt="AbhiAI" height={64} src="/abhiai-logo.png" width={64} /></span>
              <p className="eyebrow">AbhiAI</p>
              <h1>What can I help you with?</h1>
              <p>Ask a question, explore an idea, work with a document, or create something new.</p>
            </div>
            <form className="home-composer" onSubmit={(event) => { event.preventDefault(); if (messageDraft.trim()) void startQuickAction("chat", messageDraft, false, true); }}>
              <textarea
                aria-label="Start a conversation with AbhiAI"
                onChange={(event) => setMessageDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask AbhiAI anything…"
                rows={2}
                value={messageDraft}
              />
              <div><span>Start a new conversation</span><button aria-label="Start chat" disabled={isCreatingConversation || !messageDraft.trim()} type="submit"><AppIcon name="send" /></button></div>
            </form>
            <div aria-label="Quick actions" className="quick-actions">
              <button disabled={isCreatingConversation} onClick={() => void startQuickAction("image", "Create an image of ")} type="button"><AppIcon name="image"/><span><strong>Create image</strong><small>Generate from a prompt</small></span></button>
              <button disabled={isCreatingConversation} onClick={() => void startQuickAction("chat", "Summarize and analyze this PDF: ")} type="button"><AppIcon name="article"/><span><strong>Analyze PDF</strong><small>Upload after opening chat</small></span></button>
              <button disabled={isCreatingConversation} onClick={() => void startQuickAction("chat", "Research the latest information about ", true)} type="button"><AppIcon name="search"/><span><strong>Research</strong><small>Use supported web search</small></span></button>
            </div>
          </div>
        )}
      </section>
      )}
      {toast && <div className={toast.tone === "error" ? "app-toast error" : "app-toast"} key={toast.id} role="status">{toast.message}</div>}
      {conversationDialog && selectedConversation && (
        <div aria-labelledby="conversation-dialog-title" aria-modal="true" className="app-dialog-backdrop" role="dialog">
          <form className="app-dialog" onSubmit={(event) => { event.preventDefault(); if (conversationDialog === "rename") void renameConversation(); }}>
            <p className="eyebrow">Conversation</p>
            <h2 id="conversation-dialog-title">{conversationDialog === "rename" ? "Rename conversation" : "Delete conversation?"}</h2>
            {conversationDialog === "rename" ? (
              <label>Title<input autoFocus maxLength={120} onChange={(event) => setRenameDraft(event.target.value)} value={renameDraft}/></label>
            ) : <p>This permanently removes “{selectedConversation.title}” and its messages.</p>}
            <div className="app-dialog-actions">
              <button className="secondary-button" onClick={() => setConversationDialog(null)} type="button">Cancel</button>
              {conversationDialog === "rename"
                ? <button className="primary-button" disabled={!renameDraft.trim() || renameDraft.trim() === selectedConversation.title} type="submit">Save name</button>
                : <button className="dialog-danger-button" onClick={() => void deleteConversation()} type="button">Delete</button>}
            </div>
          </form>
        </div>
      )}
    </main>
    {accountMenuOpen && accountMenuStyle && createPortal(
      <div className="account-menu account-menu-portal" ref={accountMenuRef} role="menu" style={accountMenuStyle}>
        <button onClick={() => { viewProfile(); router.push("/social"); setAccountMenuOpen(false); setMobileSidebarOpen(false); }} role="menuitem" type="button"><AppIcon name="profile"/> Profile</button>
        <ThemeToggle menuItem />
        <button className="danger-menu-item" onClick={signOut} role="menuitem" type="button">Sign out</button>
      </div>,
      document.body,
    )}
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
        {isUser ? <p className="message-content">{message.content}</p> : <MessageContent content={message.content} />}
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
