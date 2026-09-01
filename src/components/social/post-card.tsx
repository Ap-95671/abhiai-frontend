"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";

import { PostAttachment } from "@/components/post-attachment";
import { ReportButton } from "@/components/report-button";
import { RichPostText } from "@/components/rich-post-text";
import { AppIcon } from "@/components/ui/app-icon";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api, ApiError, Poll, PostReply, PostSearchResult } from "@/lib/api";

type PostCardProps = {
  accessToken: string;
  compact?: boolean;
  currentUserId?: string;
  detail?: boolean;
  onDelete?: (id: string) => void;
  onError: (message: string) => void;
  onOpen?: (post: PostSearchResult) => void;
  onPin?: (post: PostSearchResult) => void;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
  pinBusy?: boolean;
  post: PostSearchResult;
};

function relativeDate(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function pollTimeLeft(value: string) {
  const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.ceil(hours / 24)}d`;
}

export function PostCard(props: PostCardProps) {
  return <PostCardContent key={props.post.id} {...props} />;
}

function PostCardContent({ accessToken, compact = false, currentUserId, detail = false, onDelete, onError, onOpen, onPin, onUnauthorized, onViewHashtag, onViewProfile, pinBusy = false, post }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [repostCount, setRepostCount] = useState(post.repostCount);
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replies, setReplies] = useState<PostReply[]>([]);
  const [replyDraft, setReplyDraft] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const [busy, setBusy] = useState("");
  const [poll, setPoll] = useState<Poll | null>(post.poll);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const postMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!postMenuOpen) return;
    const close = (event: PointerEvent | globalThis.KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && postMenuRef.current?.contains(event.target as Node)) return;
      setPostMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [postMenuOpen]);

  useEffect(() => {
    queueMicrotask(() => void Promise.all([
      api.getLikeStatus(accessToken, post.id),
      api.getRepostStatus(accessToken, post.id),
      api.getBookmarkStatus(accessToken, post.id),
    ]).then(([like, repost, bookmark]) => {
      setLiked(like.liked);
      setReposted(repost.reposted);
      setBookmarked(bookmark.bookmarked);
    }).catch((statusError) => {
      if (statusError instanceof ApiError && statusError.status === 401) onUnauthorized();
    }));
  }, [accessToken, onUnauthorized, post.id]);

  useEffect(() => {
    if (!post.poll) return;
    queueMicrotask(() => void api.getPoll(accessToken, post.id).then(setPoll).catch((pollError) => {
      if (pollError instanceof ApiError && pollError.status === 401) onUnauthorized();
    }));
  }, [accessToken, onUnauthorized, post.id, post.poll]);

  useEffect(() => {
    if (!currentUserId || currentUserId === post.author.id) return;
    const key = `abhiai.impression.${currentUserId}.${post.id}`;
    if (window.sessionStorage.getItem(key)) return;
    queueMicrotask(() => void api.recordPostImpression(accessToken, post.id)
      .then(() => window.sessionStorage.setItem(key, "1"))
      .catch((impressionError) => {
        if (impressionError instanceof ApiError && impressionError.status === 401) onUnauthorized();
      }));
  }, [accessToken, currentUserId, onUnauthorized, post.author.id, post.id]);

  async function vote(choiceId: string) {
    if (!poll || poll.expired || poll.selectedChoiceId) return;
    setBusy("poll");
    onError("");
    try {
      setPoll(await api.voteInPoll(accessToken, post.id, choiceId));
    } catch (voteError) {
      if (voteError instanceof ApiError && voteError.status === 401) return onUnauthorized();
      onError(voteError instanceof Error ? voteError.message : "Your vote could not be recorded.");
    } finally {
      setBusy("");
    }
  }

  async function toggle(kind: "like" | "repost" | "bookmark") {
    setBusy(kind);
    onError("");
    const previousLiked = liked;
    const previousReposted = reposted;
    const previousBookmarked = bookmarked;
    const previousLikeCount = likeCount;
    const previousRepostCount = repostCount;
    if (kind === "like") {
      setLiked(!liked);
      setLikeCount((count) => Math.max(0, count + (liked ? -1 : 1)));
    }
    if (kind === "repost") {
      setReposted(!reposted);
      setRepostCount((count) => Math.max(0, count + (reposted ? -1 : 1)));
    }
    if (kind === "bookmark") setBookmarked(!bookmarked);
    try {
      if (kind === "like") await api.setLike(accessToken, post.id, !previousLiked);
      if (kind === "repost") await api.setRepost(accessToken, post.id, !previousReposted);
      if (kind === "bookmark") await api.setBookmark(accessToken, post.id, !previousBookmarked);
    } catch (actionError) {
      setLiked(previousLiked);
      setReposted(previousReposted);
      setBookmarked(previousBookmarked);
      setLikeCount(previousLikeCount);
      setRepostCount(previousRepostCount);
      if (actionError instanceof ApiError && actionError.status === 401) return onUnauthorized();
      onError(actionError instanceof Error ? actionError.message : "The action could not be completed.");
    } finally {
      setBusy("");
    }
  }

  async function sharePost() {
    const url = `${window.location.origin}/social#post-${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.displayName} on AbhiAI`, text: post.textContent, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
        window.setTimeout(() => setShareStatus("idle"), 1800);
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      onError("This post link could not be shared. Please try again.");
    }
  }

  async function openReplies() {
    const next = !showReplies;
    setShowReplies(next);
    if (!next || replies.length) return;
    try {
      const result = await api.getReplies(accessToken, post.id);
      setReplies(result.content);
    } catch (replyError) {
      if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized();
      onError(replyError instanceof Error ? replyError.message : "Replies could not be loaded.");
    }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = replyDraft.trim();
    if (!content) return;
    setBusy("reply");
    try {
      const created = await api.createReply(accessToken, post.id, content);
      setReplies((items) => [created, ...items]);
      setReplyCount((count) => count + 1);
      setReplyDraft("");
    } catch (replyError) {
      if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized();
      onError(replyError instanceof Error ? replyError.message : "Your reply could not be posted.");
    } finally {
      setBusy("");
    }
  }

  function openFromCard(event: MouseEvent<HTMLElement>) {
    if (detail || !onOpen || (event.target as HTMLElement).closest("button,a,input,select,textarea,[role=button]")) return;
    onOpen(post);
  }

  return (
    <article className={`social-post${detail ? " post-detail-card" : " clickable-post"}${compact ? " compact-post-card" : ""}${post.pinned ? " pinned-profile-post" : ""}`} id={detail ? undefined : `post-${post.id}`} onClick={openFromCard}>
      {post.pinned && <p className="pinned-label">◆ Pinned post</p>}
      <div className="social-post-head">
        <button aria-label={`View ${post.author.displayName}'s profile`} className="avatar-button" onClick={() => onViewProfile(post.author.username)} type="button"><UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={post.author.displayName} profileMediaId={post.author.profileMediaId} profilePicture={post.author.profilePicture}/></button>
        <button className="author-button" onClick={() => onViewProfile(post.author.username)} type="button"><strong>{post.author.displayName}</strong><span>@{post.author.username} · {relativeDate(post.createdAt)}</span></button>
        <span className="visibility-pill">{post.visibility.toLowerCase()}</span>
        {onPin && <button className="profile-pin-button" disabled={pinBusy} onClick={() => onPin(post)} type="button">{post.pinned ? "Unpin" : "Pin"}</button>}
        {!detail && onOpen && <button aria-label={`Open post by ${post.author.displayName}`} className="post-open-button" onClick={() => onOpen(post)} title="Open post" type="button"><AppIcon name="chevron-right"/></button>}
        <div className="post-options" ref={postMenuRef}>
          <button aria-expanded={postMenuOpen} aria-haspopup="menu" aria-label="Post options" className="post-options-trigger" onClick={() => setPostMenuOpen((open) => !open)} title="Post options" type="button"><AppIcon name="more"/></button>
          {postMenuOpen && <div className="post-options-menu" role="menu">
            {currentUserId === post.author.id && onDelete
              ? <button className="danger-menu-item" onClick={() => { setPostMenuOpen(false); onDelete(post.id); }} role="menuitem" type="button">Delete post</button>
              : currentUserId !== post.author.id
                ? <ReportButton accessToken={accessToken} className="post-report-option" onUnauthorized={onUnauthorized} targetId={post.id} targetType="POST"/>
                : <span className="post-menu-note">No additional actions</span>}
          </div>}
        </div>
      </div>
      <RichPostText className="social-post-content" onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} text={post.textContent}/>
      {post.media?.length > 0 && <div className={`post-media-grid count-${post.media.length}`}>{post.media.map((media) => <PostAttachment accessToken={accessToken} asset={media} key={media.id}/>)}</div>}
      {poll && <div className="post-poll" aria-label="Poll">{poll.choices.map((choice) => { const percent = poll.totalVotes ? Math.round(choice.voteCount * 100 / poll.totalVotes) : 0; return <button className={poll.selectedChoiceId === choice.id ? "selected" : ""} disabled={busy === "poll" || poll.expired || Boolean(poll.selectedChoiceId)} key={choice.id} onClick={() => void vote(choice.id)} type="button"><span className="poll-fill" style={{ width: `${percent}%` }}/><strong>{choice.text}</strong><small>{poll.selectedChoiceId || poll.expired ? `${percent}%` : "Vote"}</small></button>; })}<p>{poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} · {poll.expired ? "Ended" : `Ends ${pollTimeLeft(poll.expiresAt)}`}</p></div>}
      <div className="social-actions">
        <button aria-label={`${liked ? "Unlike" : "Like"} post`} aria-pressed={liked} className={liked ? "selected like" : ""} disabled={busy === "like"} onClick={() => void toggle("like")} title="Like" type="button"><AppIcon filled={liked} name="heart"/><span>Like <small>{likeCount}</small></span></button>
        <button aria-label="View comments" aria-pressed={showReplies} className={showReplies ? "selected comment" : ""} onClick={() => void openReplies()} title="Comment" type="button"><AppIcon name="reply"/><span>Comment <small>{replyCount}</small></span></button>
        <button aria-label={`${reposted ? "Undo repost" : "Repost"}`} aria-pressed={reposted} className={reposted ? "selected repost" : ""} disabled={busy === "repost"} onClick={() => void toggle("repost")} title="Repost" type="button"><AppIcon name="repost"/><span>Repost <small>{repostCount}</small></span></button>
        <button aria-label="Share post" onClick={() => void sharePost()} title="Share" type="button"><AppIcon name="share"/><span>{shareStatus === "copied" ? "Copied" : "Share"}</span></button>
        <button aria-label={`${bookmarked ? "Remove bookmark" : "Bookmark post"}`} aria-pressed={bookmarked} className={bookmarked ? "selected bookmark" : ""} disabled={busy === "bookmark"} onClick={() => void toggle("bookmark")} title="Bookmark" type="button"><AppIcon filled={bookmarked} name="bookmark"/><span>Save</span></button>
      </div>
      {showReplies && <div className="replies-panel"><form className="reply-form" onSubmit={reply}><input aria-label="Write a reply" maxLength={1000} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Write a reply…" value={replyDraft}/><button disabled={!replyDraft.trim() || busy === "reply"} type="submit">Reply</button></form>{replies.length === 0 ? <p className="no-replies">No replies yet.</p> : replies.map((item) => <div className="reply-item" key={item.id}><UserAvatar accessToken={accessToken} className="reply-avatar" displayName={item.author.displayName} profileMediaId={item.author.profileMediaId} profilePicture={item.author.profilePicture}/><div><strong>{item.author.displayName}</strong><span>@{item.author.username} · {relativeDate(item.createdAt)}</span>{currentUserId !== item.author.id && <ReportButton accessToken={accessToken} onUnauthorized={onUnauthorized} targetContext="POST_REPLY" targetId={item.id} targetType="COMMENT"/>}<p>{item.textContent}</p></div></div>)}</div>}
    </article>
  );
}
