"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { api, ApiError, PageResponse, Poll, PostReply, PostSearchResult, PostVisibility, UserProfile } from "@/lib/api";
import { PostAttachment } from "@/components/post-attachment";
import { RichPostText } from "@/components/rich-post-text";
import { ReportButton } from "@/components/report-button";

type FeedPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

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

export function FeedPanel({ accessToken, onUnauthorized, onViewHashtag, onViewProfile }: FeedPanelProps) {
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [page, setPage] = useState<PageResponse<PostSearchResult> | null>(null);
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollChoices, setPollChoices] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);

  const loadFeed = useCallback(async (nextPage: number, append: boolean) => {
    setIsLoading(true);
    setError("");
    try {
      const [feed, currentProfile] = await Promise.all([
        api.getFeed(accessToken, nextPage),
        api.getCurrentProfile(accessToken),
      ]);
      setPosts((current) => append ? [...current, ...feed.content] : feed.content);
      setPage(feed);
      setProfile(currentProfile);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "The feed could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void loadFeed(0, false));
  }, [loadFeed]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isPublishing) return;
    setIsPublishing(true);
    setError("");
    const uploadedIds: string[] = [];
    try {
      for (const file of attachments) uploadedIds.push((await api.uploadAttachment(accessToken, file)).id);
      const choices = pollChoices.map((choice) => choice.trim()).filter(Boolean);
      if (pollEnabled && (choices.length < 2 || new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length)) throw new Error("Add at least two unique poll choices.");
      const post = await api.createPost(accessToken, content, visibility, uploadedIds, pollEnabled ? { choices, durationHours: pollDuration } : undefined);
      setPosts((current) => [post, ...current]);
      setDraft("");
      setAttachments([]);
      setPollEnabled(false); setPollChoices(["", ""]); setPollDuration(24);
      setProfile((current) => current ? { ...current, postCount: current.postCount + 1 } : current);
    } catch (publishError) {
      await Promise.allSettled(uploadedIds.map((id) => api.deleteMedia(accessToken, id)));
      if (publishError instanceof ApiError && publishError.status === 401) return onUnauthorized();
      setError(publishError instanceof Error ? publishError.message : "Your post could not be published.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function removePost(postId: string) {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.deletePost(accessToken, postId);
      setPosts((current) => current.filter((post) => post.id !== postId));
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.status === 401) return onUnauthorized();
      setError(deleteError instanceof Error ? deleteError.message : "The post could not be deleted.");
    }
  }

  return (
    <section className="workspace-view" aria-labelledby="feed-title">
      <header className="workspace-header">
        <div><p className="eyebrow">Social</p><h1 id="feed-title">Home feed</h1><p>Share ideas and see what your network is building.</p></div>
      </header>
      <div className="workspace-content feed-workspace">
        <form className="post-composer" onSubmit={publish}>
          <div className="profile-avatar" aria-hidden="true">{profile ? initials(profile.displayName) : "A"}</div>
          <textarea maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder="What are you exploring?" rows={3} value={draft} />
          {attachments.length > 0 && <div className="composer-image-list">{attachments.map((file,index)=><div key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={()=>setAttachments((items)=>items.filter((_,i)=>i!==index))} type="button">×</button></div>)}</div>}
          {pollEnabled && <div className="poll-composer">{pollChoices.map((choice, index) => <div key={index}><input aria-label={`Poll choice ${index + 1}`} maxLength={100} onChange={(event) => setPollChoices((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Choice ${index + 1}`} required value={choice}/>{pollChoices.length > 2 && <button aria-label={`Remove poll choice ${index + 1}`} onClick={() => setPollChoices((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button">×</button>}</div>)}<div className="poll-composer-settings">{pollChoices.length < 4 && <button onClick={() => setPollChoices((items) => [...items, ""])} type="button">＋ Add choice</button>}<label>Duration<select onChange={(event) => setPollDuration(Number(event.target.value))} value={pollDuration}><option value={1}>1 hour</option><option value={24}>1 day</option><option value={72}>3 days</option><option value={168}>7 days</option></select></label></div></div>}
          <div className="post-composer-footer">
            <label className="image-picker">＋ Media<input accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf" disabled={attachments.length>=4||isPublishing} multiple onChange={(event)=>{const selected=Array.from(event.target.files ?? []);if([...attachments,...selected].length>4){setError("A post can contain at most 4 attachments.");return;}setAttachments((items)=>[...items,...selected]);event.target.value="";}} type="file"/></label>
            <button className={pollEnabled ? "composer-tool active" : "composer-tool"} onClick={() => setPollEnabled((enabled) => !enabled)} type="button">▥ Poll</button>
            <select aria-label="Post visibility" onChange={(event) => setVisibility(event.target.value as PostVisibility)} value={visibility}>
              <option value="PUBLIC">Public</option><option value="FOLLOWERS">Followers</option><option value="PRIVATE">Only me</option>
            </select>
            <span>{draft.length}/1000</span>
            <button disabled={!draft.trim() || isPublishing} type="submit">{isPublishing ? "Publishing…" : "Post"}</button>
          </div>
        </form>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && posts.length === 0 && <div className="feed-loading">Loading your feed…</div>}
        {!isLoading && posts.length === 0 && !error && <div className="feature-empty-state compact"><h2>Your feed is ready</h2><p>Create a post or follow people from Search to bring your network to life.</p></div>}
        <div className="social-feed">
          {posts.map((post) => <FeedPost accessToken={accessToken} currentUserId={profile?.id} key={post.id} onDelete={removePost} onError={setError} onUnauthorized={onUnauthorized} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post} />)}
        </div>
        {page && !page.last && <button className="load-more-button" disabled={isLoading} onClick={() => void loadFeed(page.page + 1, true)} type="button">{isLoading ? "Loading…" : "Load more posts"}</button>}
      </div>
    </section>
  );
}

function FeedPost({ accessToken, currentUserId, onDelete, onError, onUnauthorized, onViewHashtag, onViewProfile, post }: {
  accessToken: string; currentUserId?: string; onDelete: (id: string) => void; onError: (message: string) => void;
  onUnauthorized: () => void; onViewHashtag: (tag: string) => void; onViewProfile: (username: string) => void; post: PostSearchResult;
}) {
  const [liked, setLiked] = useState(false); const [reposted, setReposted] = useState(false); const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount); const [repostCount, setRepostCount] = useState(post.repostCount); const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replies, setReplies] = useState<PostReply[]>([]); const [replyDraft, setReplyDraft] = useState(""); const [showReplies, setShowReplies] = useState(false); const [busy, setBusy] = useState("");
  const [poll, setPoll] = useState<Poll | null>(post.poll);

  useEffect(() => {
    queueMicrotask(() => void Promise.all([api.getLikeStatus(accessToken, post.id), api.getRepostStatus(accessToken, post.id), api.getBookmarkStatus(accessToken, post.id)])
      .then(([like, repost, bookmark]) => { setLiked(like.liked); setReposted(repost.reposted); setBookmarked(bookmark.bookmarked); })
      .catch((statusError) => { if (statusError instanceof ApiError && statusError.status === 401) onUnauthorized(); }));
  }, [accessToken, onUnauthorized, post.id]);

  useEffect(() => {
    if (!post.poll) return;
    queueMicrotask(() => void api.getPoll(accessToken, post.id).then(setPoll)
      .catch((pollError) => { if (pollError instanceof ApiError && pollError.status === 401) onUnauthorized(); }));
  }, [accessToken, onUnauthorized, post.id, post.poll]);

  useEffect(() => {
    if (!currentUserId || currentUserId === post.author.id) return;
    const key = `abhiai.impression.${currentUserId}.${post.id}`;
    if (window.sessionStorage.getItem(key)) return;
    queueMicrotask(() => void api.recordPostImpression(accessToken, post.id)
      .then(() => window.sessionStorage.setItem(key, "1"))
      .catch((impressionError) => { if (impressionError instanceof ApiError && impressionError.status === 401) onUnauthorized(); }));
  }, [accessToken, currentUserId, onUnauthorized, post.author.id, post.id]);

  async function vote(choiceId: string) {
    if (!poll || poll.expired || poll.selectedChoiceId) return;
    setBusy("poll"); onError("");
    try { setPoll(await api.voteInPoll(accessToken, post.id, choiceId)); }
    catch (voteError) { if (voteError instanceof ApiError && voteError.status === 401) return onUnauthorized(); onError(voteError instanceof Error ? voteError.message : "Your vote could not be recorded."); }
    finally { setBusy(""); }
  }

  async function toggle(kind: "like" | "repost" | "bookmark") {
    setBusy(kind); onError("");
    try {
      if (kind === "like") { await api.setLike(accessToken, post.id, !liked); setLiked(!liked); setLikeCount((n) => n + (liked ? -1 : 1)); }
      if (kind === "repost") { await api.setRepost(accessToken, post.id, !reposted); setReposted(!reposted); setRepostCount((n) => n + (reposted ? -1 : 1)); }
      if (kind === "bookmark") { await api.setBookmark(accessToken, post.id, !bookmarked); setBookmarked(!bookmarked); }
    } catch (actionError) { if (actionError instanceof ApiError && actionError.status === 401) return onUnauthorized(); onError(actionError instanceof Error ? actionError.message : "The action could not be completed."); }
    finally { setBusy(""); }
  }

  async function openReplies() {
    const next = !showReplies; setShowReplies(next); if (!next || replies.length) return;
    try { const result = await api.getReplies(accessToken, post.id); setReplies(result.content); }
    catch (replyError) { if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized(); onError(replyError instanceof Error ? replyError.message : "Replies could not be loaded."); }
  }

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const content = replyDraft.trim(); if (!content) return; setBusy("reply");
    try { const created = await api.createReply(accessToken, post.id, content); setReplies((items) => [created, ...items]); setReplyCount((n) => n + 1); setReplyDraft(""); }
    catch (replyError) { if (replyError instanceof ApiError && replyError.status === 401) return onUnauthorized(); onError(replyError instanceof Error ? replyError.message : "Your reply could not be posted."); }
    finally { setBusy(""); }
  }

  return <article className="social-post">
    <div className="social-post-head"><button className="avatar-button" onClick={() => onViewProfile(post.author.username)} type="button"><span className="profile-avatar small-avatar">{initials(post.author.displayName)}</span></button><button className="author-button" onClick={() => onViewProfile(post.author.username)} type="button"><strong>{post.author.displayName}</strong><span>@{post.author.username} · {relativeDate(post.createdAt)}</span></button><span className="visibility-pill">{post.visibility.toLowerCase()}</span>{currentUserId === post.author.id ? <button className="post-delete" onClick={() => onDelete(post.id)} type="button">Delete</button> : <ReportButton accessToken={accessToken} className="post-delete" onUnauthorized={onUnauthorized} targetId={post.id} targetType="POST"/>}</div>
    <RichPostText className="social-post-content" onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} text={post.textContent} />
    {post.media?.length > 0 && <div className={`post-media-grid count-${post.media.length}`}>{post.media.map((media)=><PostAttachment accessToken={accessToken} asset={media} key={media.id}/>)}</div>}
    {poll && <div className="post-poll" aria-label="Poll">{poll.choices.map((choice) => { const percent = poll.totalVotes ? Math.round(choice.voteCount * 100 / poll.totalVotes) : 0; return <button className={poll.selectedChoiceId === choice.id ? "selected" : ""} disabled={busy === "poll" || poll.expired || Boolean(poll.selectedChoiceId)} key={choice.id} onClick={() => void vote(choice.id)} type="button"><span className="poll-fill" style={{ width: `${percent}%` }}/><strong>{choice.text}</strong><small>{poll.selectedChoiceId || poll.expired ? `${percent}%` : "Vote"}</small></button>; })}<p>{poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} · {poll.expired ? "Ended" : `Ends ${pollTimeLeft(poll.expiresAt)}`}</p></div>}
    <div className="social-actions">
      <button className={liked ? "selected like" : ""} disabled={busy === "like"} onClick={() => void toggle("like")} type="button">♡ <span>{likeCount}</span></button>
      <button className={showReplies ? "selected" : ""} onClick={() => void openReplies()} type="button">↩ <span>{replyCount}</span></button>
      <button className={reposted ? "selected repost" : ""} disabled={busy === "repost"} onClick={() => void toggle("repost")} type="button">↻ <span>{repostCount}</span></button>
      <button aria-label="Bookmark post" className={bookmarked ? "selected bookmark" : ""} disabled={busy === "bookmark"} onClick={() => void toggle("bookmark")} type="button">♢</button>
    </div>
    {showReplies && <div className="replies-panel"><form className="reply-form" onSubmit={reply}><input aria-label="Write a reply" maxLength={1000} onChange={(event) => setReplyDraft(event.target.value)} placeholder="Write a reply…" value={replyDraft}/><button disabled={!replyDraft.trim() || busy === "reply"} type="submit">Reply</button></form>{replies.length === 0 ? <p className="no-replies">No replies yet.</p> : replies.map((item) => <div className="reply-item" key={item.id}><strong>{item.author.displayName}</strong><span>@{item.author.username} · {relativeDate(item.createdAt)}</span>{currentUserId!==item.author.id&&<ReportButton accessToken={accessToken} onUnauthorized={onUnauthorized} targetContext="POST_REPLY" targetId={item.id} targetType="COMMENT"/>}<p>{item.textContent}</p></div>)}</div>}
  </article>;
}
