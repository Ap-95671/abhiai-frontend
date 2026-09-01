"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError, PageResponse, SocialNotification } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { UserAvatar } from "@/components/ui/user-avatar";

type NotificationsPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onUnreadCountChange: (count: number) => void;
  onViewProfile: (username: string) => void;
};

const notificationIcon: Record<SocialNotification["type"], AppIconName> = {
  NEW_FOLLOWER: "profile",
  POST_LIKE: "heart",
  POST_REPLY: "reply",
  POST_REPOST: "repost",
  MENTION: "message",
};

const notificationVerb = {
  NEW_FOLLOWER: "started following you",
  POST_LIKE: "liked your post",
  POST_REPLY: "replied to your post",
  POST_REPOST: "reposted your post",
  MENTION: "mentioned you in a post",
} as const;

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function NotificationsPanel({
  accessToken,
  onUnauthorized,
  onUnreadCountChange,
  onViewProfile,
}: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [page, setPage] = useState<PageResponse<SocialNotification> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(async (nextPage: number, append: boolean) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await api.getNotifications(accessToken, nextPage, 20, filter === "unread");
      setNotifications((current) => append ? [...current, ...result.content] : result.content);
      setPage(result);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Notifications could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, filter, onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void loadNotifications(0, false));
  }, [loadNotifications]);

  async function markRead(notification: SocialNotification) {
    if (notification.read || pendingIds.has(notification.id)) return;
    setPendingIds((current) => new Set(current).add(notification.id));
    setError("");
    try {
      const updated = await api.markNotificationRead(accessToken, notification.id);
      setNotifications((current) => filter === "unread"
        ? current.filter((item) => item.id !== updated.id)
        : current.map((item) => item.id === updated.id ? updated : item));
      const { unreadCount } = await api.getUnreadNotificationCount(accessToken);
      onUnreadCountChange(unreadCount);
    } catch (markError) {
      if (markError instanceof ApiError && markError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(markError instanceof Error ? markError.message : "The notification could not be updated.");
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    }
  }

  async function markAllRead() {
    setIsMarkingAll(true);
    setError("");
    try {
      await api.markAllNotificationsRead(accessToken);
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read: true, readAt: item.readAt ?? readAt })));
      onUnreadCountChange(0);
    } catch (markError) {
      if (markError instanceof ApiError && markError.status === 401) {
        onUnauthorized();
        return;
      }
      setError(markError instanceof Error ? markError.message : "Notifications could not be updated.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  const unreadOnPage = notifications.filter((item) => !item.read).length;

  return (
    <section className="workspace-view" aria-labelledby="notifications-title">
      <header className="workspace-header notification-header">
        <div>
          <p className="eyebrow">Activity</p>
          <h1 id="notifications-title">Notifications</h1>
          <p>Keep up with the people and posts connected to you.</p>
        </div>
        <button
          className="secondary-button"
          disabled={isMarkingAll || unreadOnPage === 0}
          onClick={() => void markAllRead()}
          type="button"
        >
          {isMarkingAll ? "Updating…" : "Mark all as read"}
        </button>
      </header>

      <div className="workspace-content notifications-workspace">
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="notification-filters" role="tablist" aria-label="Notification filter">
          <button aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} role="tab" type="button">All</button>
          <button aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")} role="tab" type="button">Unread</button>
        </div>
        {isLoading && notifications.length === 0 && (
          <div className="notification-skeletons" aria-label="Loading notifications">
            <div /><div /><div />
          </div>
        )}
        {!isLoading && notifications.length === 0 && !error && (
          <EmptyState description={filter === "unread" ? "You have read every notification." : "New follows, likes, replies, reposts, and mentions will appear here."} icon="bell" title={filter === "unread" ? "No unread notifications" : "You’re all caught up"} />
        )}

        {notifications.length > 0 && (
          <div className="notification-list" aria-live="polite">
            {notifications.map((notification) => (
              <article
                className={notification.read ? "notification-item" : "notification-item unread"}
                key={notification.id}
              >
                <button className="notification-avatar" aria-label={`View ${notification.actor.displayName}'s profile`} onClick={() => onViewProfile(notification.actor.username)} type="button">
                  <UserAvatar accessToken={accessToken} className="notification-avatar-visual" displayName={notification.actor.displayName} profileMediaId={notification.actor.profileMediaId} profilePicture={notification.actor.profilePicture}/>
                  <span className={`notification-type ${notification.type.toLowerCase()}`}>
                    <AppIcon filled={notification.type === "POST_LIKE"} name={notificationIcon[notification.type]} />
                  </span>
                </button>
                <div className="notification-copy">
                  <p>
                    <button className="notification-actor" onClick={() => onViewProfile(notification.actor.username)} type="button"><strong>{notification.actor.displayName}</strong></button>{" "}
                    {notificationVerb[notification.type]}
                  </p>
                  <span>@{notification.actor.username} · {formatRelativeDate(notification.createdAt)}</span>
                </div>
                {!notification.read && (
                  <button
                    aria-label={`Mark notification from ${notification.actor.displayName} as read`}
                    className="mark-read-button"
                    disabled={pendingIds.has(notification.id)}
                    onClick={() => void markRead(notification)}
                    type="button"
                  >
                    <span aria-hidden="true" />
                    Mark read
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {page && !page.last && (
          <button
            className="load-more-button"
            disabled={isLoading}
            onClick={() => void loadNotifications(page.page + 1, true)}
            type="button"
          >
            {isLoading ? "Loading…" : "Load earlier notifications"}
          </button>
        )}
      </div>
    </section>
  );
}
