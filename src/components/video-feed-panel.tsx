"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  api,
  ApiError,
  MediaAsset,
  PageResponse,
  PostReply,
  PostSearchResult,
} from "@/lib/api";
import { UserAvatar } from "@/components/ui/user-avatar";

type VideoFeedPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

export function VideoFeedPanel({ accessToken, onUnauthorized, onViewProfile }: VideoFeedPanelProps) {
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [page, setPage] = useState<PageResponse<PostSearchResult> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (pageNumber: number, append: boolean) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await api.getVideoFeed(accessToken, pageNumber);
      setPosts((current) => append ? [...current, ...result.content] : result.content);
      setPage(result);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "The video feed could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void load(0, false));
  }, [load]);

  return (
    <section className="workspace-view video-workspace-view" aria-labelledby="video-feed-title">
      <header className="workspace-header video-feed-header">
        <div>
          <p className="eyebrow">Short video</p>
          <h1 id="video-feed-title">Videos</h1>
          <p>Discover clips from people you follow and the public AbhiAI network.</p>
        </div>
      </header>
      <div className="video-feed-workspace">
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && posts.length === 0 && <div className="feed-loading">Loading videos…</div>}
        {!isLoading && posts.length === 0 && !error && (
          <div className="feature-empty-state compact video-empty-state">
            <span className="empty-state-icon" aria-hidden="true">▶</span>
            <h2>Your video feed is ready</h2>
            <p>Upload an MP4 or WebM from the Home feed to publish the first short video.</p>
          </div>
        )}
        <div className="vertical-video-feed">
          {posts.map((post) => (
            <VideoPost
              accessToken={accessToken}
              key={post.id}
              onError={setError}
              onUnauthorized={onUnauthorized}
              onViewProfile={onViewProfile}
              post={post}
            />
          ))}
        </div>
        {page && !page.last && (
          <button className="load-more-button" disabled={isLoading} onClick={() => void load(page.page + 1, true)} type="button">
            {isLoading ? "Loading…" : "Load more videos"}
          </button>
        )}
      </div>
    </section>
  );
}

function VideoPost({ accessToken, onError, onUnauthorized, onViewProfile, post }: {
  accessToken: string;
  onError: (message: string) => void;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
  post: PostSearchResult;
}) {
  const video = post.media.find((asset) => asset.kind === "VIDEO");
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [viewCount, setViewCount] = useState(post.viewCount);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replyDraft, setReplyDraft] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    queueMicrotask(() => void Promise.all([
      api.getLikeStatus(accessToken, post.id),
      api.getRepostStatus(accessToken, post.id),
      api.getBookmarkStatus(accessToken, post.id),
    ]).then(([like, repost, bookmark]) => {
      setLiked(like.liked);
      setReposted(repost.reposted);
      setBookmarked(bookmark.bookmarked);
    }).catch((statusError: unknown) => {
      if (statusError instanceof ApiError && statusError.status === 401) onUnauthorized();
    }));
  }, [accessToken, onUnauthorized, post.id]);

  async function recordView() {
    try {
      const result = await api.recordVideoView(accessToken, post.id);
      setViewCount(result.viewCount);
    } catch (viewError) {
      if (viewError instanceof ApiError && viewError.status === 401) onUnauthorized();
    }
  }

  async function toggle(kind: "like" | "repost" | "bookmark") {
    setBusy(kind);
    onError("");
    try {
      if (kind === "like") {
        await api.setLike(accessToken, post.id, !liked);
        setLiked(!liked);
        setLikeCount((count) => count + (liked ? -1 : 1));
      } else if (kind === "repost") {
        await api.setRepost(accessToken, post.id, !reposted);
        setReposted(!reposted);
        setRepostCount((count) => count + (reposted ? -1 : 1));
      } else {
        await api.setBookmark(accessToken, post.id, !bookmarked);
        setBookmarked(!bookmarked);
      }
    } catch (actionError) {
      if (actionError instanceof ApiError && actionError.status === 401) return onUnauthorized();
      onError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function toggleReplies() {
    const shouldOpen = !showReplies;
    setShowReplies(shouldOpen);
    if (!shouldOpen || replies.length > 0) return;
    try {
      const result = await api.getReplies(accessToken, post.id);
      setReplies(result.content);
    } catch (replyError) {
      if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized();
      onError(replyError instanceof Error ? replyError.message : "Replies could not be loaded.");
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = replyDraft.trim();
    if (!content) return;
    setBusy("reply");
    try {
      const reply = await api.createReply(accessToken, post.id, content);
      setReplies((current) => [reply, ...current]);
      setReplyCount((count) => count + 1);
      setReplyDraft("");
    } catch (replyError) {
      if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized();
      onError(replyError instanceof Error ? replyError.message : "Your reply could not be posted.");
    } finally {
      setBusy("");
    }
  }

  if (!video) return null;

  return (
    <article className="video-post">
      <VideoPlayer accessToken={accessToken} asset={video} onViewed={recordView} />
      <div className="video-gradient" aria-hidden="true" />
      <div className="video-caption">
        <button className="video-author" onClick={() => onViewProfile(post.author.username)} type="button">
          <UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={post.author.displayName} profileMediaId={post.author.profileMediaId} profilePicture={post.author.profilePicture}/>
          <span><strong>{post.author.displayName}</strong><small>@{post.author.username}</small></span>
        </button>
        <p>{post.textContent}</p>
        <span className="video-views">{viewCount.toLocaleString()} views</span>
      </div>
      <div className="video-actions" aria-label="Video actions">
        <button className={liked ? "selected" : ""} disabled={busy === "like"} onClick={() => void toggle("like")} type="button"><span>♡</span><small>{likeCount}</small></button>
        <button className={showReplies ? "selected" : ""} onClick={() => void toggleReplies()} type="button"><span>↩</span><small>{replyCount}</small></button>
        <button className={reposted ? "selected" : ""} disabled={busy === "repost"} onClick={() => void toggle("repost")} type="button"><span>↻</span><small>{repostCount}</small></button>
        <button aria-label="Save video" className={bookmarked ? "selected" : ""} disabled={busy === "bookmark"} onClick={() => void toggle("bookmark")} type="button"><span>♢</span><small>Save</small></button>
      </div>
      {showReplies && (
        <div className="video-replies">
          <form onSubmit={submitReply}>
            <input aria-label="Write a video reply" maxLength={1000} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Add a reply…" value={replyDraft} />
            <button disabled={!replyDraft.trim() || busy === "reply"} type="submit">Post</button>
          </form>
          <div className="video-reply-list">
            {replies.length === 0 ? <p>No replies yet.</p> : replies.map((reply) => (
              <div key={reply.id}><UserAvatar accessToken={accessToken} className="reply-avatar" displayName={reply.author.displayName} profileMediaId={reply.author.profileMediaId} profilePicture={reply.author.profilePicture}/><div><strong>{reply.author.displayName}</strong><span>@{reply.author.username}</span><p>{reply.textContent}</p></div></div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function VideoPlayer({ accessToken, asset, onViewed }: {
  accessToken: string;
  asset: MediaAsset;
  onViewed: () => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void api.getMediaBlob(accessToken, asset.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [accessToken, asset.id]);

  useEffect(() => {
    const container = containerRef.current;
    const player = videoRef.current;
    if (!container || !player || !source) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
        void player.play().catch(() => undefined);
      } else {
        player.pause();
      }
    }, { threshold: [0, 0.7, 1] });
    observer.observe(container);
    return () => observer.disconnect();
  }, [source]);

  function handlePlay() {
    if (viewedRef.current) return;
    viewedRef.current = true;
    void onViewed();
  }

  return (
    <div className="video-player" ref={containerRef}>
      {source ? (
        <video controls loop muted onPlay={handlePlay} playsInline preload="metadata" ref={videoRef} src={source} />
      ) : (
        <div className="video-loading">Loading video…</div>
      )}
    </div>
  );
}
