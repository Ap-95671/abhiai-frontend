"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, ApiError, PageResponse, PostSearchResult, PostVisibility, UserProfile } from "@/lib/api";
import { AppIcon } from "@/components/ui/app-icon";
import { NewsBrief } from "@/components/news/news-brief";
import { PostCard } from "@/components/social/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";

type FeedPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

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
  const [selectedPost, setSelectedPost] = useState<PostSearchResult | null>(null);
  const postDetailClose = useRef<HTMLButtonElement | null>(null);
  const postDetailDialog = useRef<HTMLElement | null>(null);
  const postReturnFocus = useRef<HTMLElement | null>(null);

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

  const closePost = useCallback(() => {
    setSelectedPost(null);
    if (window.history.state?.abhiaiPostDetail) window.history.back();
    else window.history.replaceState(window.history.state, "", "/social");
    queueMicrotask(() => postReturnFocus.current?.focus());
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const match = window.location.hash.match(/^#post-(.+)$/);
      if (!match) setSelectedPost(null);
      else {
        const id = decodeURIComponent(match[1]);
        const loadedPost = posts.find((post) => post.id === id);
        if (loadedPost) setSelectedPost(loadedPost);
        else try { const fetched = await api.getPost(accessToken, id); if (active) setSelectedPost(fetched); }
        catch (postError) { if (postError instanceof ApiError && postError.status === 401) onUnauthorized(); }
      }
    };
    const handlePopState = () => void sync();
    queueMicrotask(handlePopState);
    window.addEventListener("popstate", handlePopState);
    return () => { active = false; window.removeEventListener("popstate", handlePopState); };
  }, [accessToken, onUnauthorized, posts]);

  useEffect(() => {
    if (!selectedPost) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => postDetailClose.current?.focus());
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") return closePost();
      if (event.key !== "Tab") return;
      const focusable = Array.from(postDetailDialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return event.preventDefault();
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKeyDown); };
  }, [closePost, selectedPost]);

  function openPost(post: PostSearchResult) {
    if (selectedPost?.id === post.id) return;
    postReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedPost(post);
    window.history.pushState({ ...(window.history.state ?? {}), abhiaiPostDetail: true }, "", `/social#post-${encodeURIComponent(post.id)}`);
  }

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
      <div className="workspace-content feed-hub">
        <div className="feed-workspace">
        <form className="post-composer" onSubmit={publish}>
          <UserAvatar accessToken={accessToken} className="profile-avatar" displayName={profile?.displayName ?? "AbhiAI"} profileMediaId={profile?.profileMediaId} profilePicture={profile?.profilePicture}/>
          <textarea aria-label="Create a social post" maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder="Share an idea, update, or question…" rows={3} value={draft} />
          {attachments.length > 0 && <div className="composer-image-list">{attachments.map((file,index)=><div key={`${file.name}-${file.lastModified}`}><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={()=>setAttachments((items)=>items.filter((_,i)=>i!==index))} type="button">×</button></div>)}</div>}
          {pollEnabled && <div className="poll-composer">{pollChoices.map((choice, index) => <div key={index}><input aria-label={`Poll choice ${index + 1}`} maxLength={100} onChange={(event) => setPollChoices((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Choice ${index + 1}`} required value={choice}/>{pollChoices.length > 2 && <button aria-label={`Remove poll choice ${index + 1}`} onClick={() => setPollChoices((items) => items.filter((_, itemIndex) => itemIndex !== index))} type="button">×</button>}</div>)}<div className="poll-composer-settings">{pollChoices.length < 4 && <button onClick={() => setPollChoices((items) => [...items, ""])} type="button">＋ Add choice</button>}<label>Duration<select onChange={(event) => setPollDuration(Number(event.target.value))} value={pollDuration}><option value={1}>1 hour</option><option value={24}>1 day</option><option value={72}>3 days</option><option value={168}>7 days</option></select></label></div></div>}
          <div className="post-composer-footer">
            <div className="composer-tools" aria-label="Post tools">
              <label className="image-picker" title="Add media"><AppIcon name="image"/><span>Media</span><input accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf" disabled={attachments.length>=4||isPublishing} multiple onChange={(event)=>{const selected=Array.from(event.target.files ?? []);if([...attachments,...selected].length>4){setError("A post can contain at most 4 attachments.");return;}setAttachments((items)=>[...items,...selected]);event.target.value="";}} type="file"/></label>
              <button aria-pressed={pollEnabled} className={pollEnabled ? "composer-tool active" : "composer-tool"} onClick={() => setPollEnabled((enabled) => !enabled)} title="Add poll" type="button"><AppIcon name="poll"/><span>Poll</span></button>
              <label className="visibility-control" title="Choose who can see this post"><AppIcon name="globe"/><select aria-label="Post visibility" onChange={(event) => setVisibility(event.target.value as PostVisibility)} value={visibility}>
                <option value="PUBLIC">Public</option><option value="FOLLOWERS">Followers</option><option value="PRIVATE">Only me</option>
              </select></label>
            </div>
            <span className={draft.length > 900 ? "composer-count near-limit" : "composer-count"}>{draft.length}/1000</span>
            <button className="publish-post-button" disabled={!draft.trim() || isPublishing} type="submit">{isPublishing ? "Publishing…" : "Post"}</button>
          </div>
        </form>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && posts.length === 0 && <div aria-label="Loading your feed" className="feed-loading" role="status"><span/><span/><span/></div>}
        {!isLoading && posts.length === 0 && !error && <EmptyState compact description="Create a post or follow people from Search to bring your network to life." icon="feed" title="Your feed is ready" />}
        <div className="social-feed">
          {posts.map((post) => <PostCard accessToken={accessToken} currentUserId={profile?.id} key={post.id} onDelete={removePost} onError={setError} onOpen={openPost} onUnauthorized={onUnauthorized} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post} />)}
        </div>
        {page && !page.last && <button className="load-more-button" disabled={isLoading} onClick={() => void loadFeed(page.page + 1, true)} type="button">{isLoading ? "Loading…" : "Load more posts"}</button>}
        </div>
        <NewsBrief accessToken={accessToken} onUnauthorized={onUnauthorized} />
      </div>
      {selectedPost && createPortal(<div className="post-detail-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closePost(); }} role="presentation"><section aria-labelledby="post-detail-title" aria-modal="true" className="post-detail-dialog" ref={postDetailDialog} role="dialog"><header><h2 id="post-detail-title">Post</h2><button aria-label="Close post detail" onClick={closePost} ref={postDetailClose} type="button">×</button></header><PostCard accessToken={accessToken} currentUserId={profile?.id} detail onDelete={removePost} onError={setError} onUnauthorized={onUnauthorized} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={selectedPost}/></section></div>, document.body)}
    </section>
  );
}
