"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { PostAttachment } from "@/components/post-attachment";
import { RichPostText } from "@/components/rich-post-text";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api, ApiError, Hashtag, PageResponse, PostSearchResult } from "@/lib/api";

type HashtagPanelProps = {
  accessToken: string;
  initialTag?: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

function relativeDate(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function HashtagPanel({ accessToken, initialTag, onUnauthorized, onViewProfile }: HashtagPanelProps) {
  const [trending, setTrending] = useState<Hashtag[]>([]);
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [postPage, setPostPage] = useState<PageResponse<PostSearchResult> | null>(null);
  const [query, setQuery] = useState(initialTag ?? "");
  const [selectedTag, setSelectedTag] = useState(initialTag?.replace(/^#/, "") ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState("");

  const handleError = useCallback((loadError: unknown, fallback: string) => {
    if (loadError instanceof ApiError && loadError.status === 401) {
      onUnauthorized();
      return;
    }
    setError(loadError instanceof Error ? loadError.message : fallback);
  }, [onUnauthorized]);

  const loadTag = useCallback(async (tag: string, page = 0, append = false) => {
    const normalized = tag.trim().replace(/^#/, "");
    if (!normalized) return;
    setIsLoadingPosts(true);
    setError("");
    try {
      const result = await api.getHashtagPosts(accessToken, normalized, page);
      setSelectedTag(normalized);
      setQuery(`#${normalized}`);
      setPosts((current) => append ? [...current, ...result.content] : result.content);
      setPostPage(result);
    } catch (loadError) {
      handleError(loadError, "Posts for this hashtag could not be loaded.");
    } finally {
      setIsLoadingPosts(false);
    }
  }, [accessToken, handleError]);

  useEffect(() => {
    let active = true;
    void api.getTrendingHashtags(accessToken).then((result) => {
      if (active) setTrending(result.content);
    }).catch((loadError: unknown) => {
      if (active) handleError(loadError, "Trending hashtags could not be loaded.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [accessToken, handleError]);

  useEffect(() => {
    if (!initialTag) return;
    queueMicrotask(() => void loadTag(initialTag));
  }, [initialTag, loadTag]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadTag(query);
  }

  return (
    <section className="workspace-view" aria-labelledby="hashtags-title">
      <header className="workspace-header"><div><p className="eyebrow">Discover topics</p><h1 id="hashtags-title">Hashtags</h1><p>Find active conversations across the AbhiAI community.</p></div></header>
      <div className="workspace-content hashtag-workspace">
        <form className="search-form hashtag-search" onSubmit={search}><span className="search-icon">#</span><input aria-label="Hashtag" maxLength={51} onChange={(event) => setQuery(event.target.value)} placeholder="#AI, #Java, #AbhiAI" value={query} /><button disabled={!query.trim() || isLoadingPosts} type="submit">Explore</button></form>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <section className="trending-tags" aria-labelledby="trending-title"><div className="section-heading"><div><p className="eyebrow">Now on AbhiAI</p><h2 id="trending-title">Trending hashtags</h2></div><span>Ranked by active posts</span></div>{isLoading ? <div className="feed-loading">Loading trends…</div> : trending.length === 0 ? <p className="hashtag-empty">No hashtags are trending yet. Add one to a post from the Home feed.</p> : <div className="hashtag-grid">{trending.map((tag, index) => <button key={tag.id} onClick={() => void loadTag(tag.normalizedTag)} type="button"><span>{index + 1}</span><strong>#{tag.displayTag}</strong><small>{tag.postCount} {tag.postCount === 1 ? "post" : "posts"}</small></button>)}</div>}</section>
        {selectedTag && <section className="hashtag-results" aria-labelledby="selected-tag-title"><div className="section-heading"><div><p className="eyebrow">Topic feed</p><h2 id="selected-tag-title">#{selectedTag}</h2></div><span>{postPage?.totalElements ?? 0} posts</span></div>{isLoadingPosts && posts.length === 0 ? <div className="feed-loading">Loading posts…</div> : posts.length === 0 ? <p className="hashtag-empty">No visible posts use this hashtag.</p> : <div className="hashtag-post-list">{posts.map((post) => <article className="post-card" key={post.id}><div className="post-author-row"><UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={post.author.displayName} profileMediaId={post.author.profileMediaId} profilePicture={post.author.profilePicture}/><div><button className="inline-author-button" onClick={() => onViewProfile(post.author.username)} type="button">{post.author.displayName}</button><p>@{post.author.username} · {relativeDate(post.createdAt)}</p></div></div><RichPostText className="post-content" onViewHashtag={(tag) => void loadTag(tag)} onViewProfile={onViewProfile} text={post.textContent} />{post.media.length > 0 && <div className={`post-media-grid count-${post.media.length}`}>{post.media.map((media) => <PostAttachment accessToken={accessToken} asset={media} key={media.id} />)}</div>}<div className="post-metrics"><span>{post.likeCount} likes</span><span>{post.replyCount} replies</span><span>{post.repostCount} reposts</span></div></article>)}</div>}{postPage && !postPage.last && <button className="load-more-button" disabled={isLoadingPosts} onClick={() => void loadTag(selectedTag, postPage.page + 1, true)} type="button">{isLoadingPosts ? "Loading…" : "Load more posts"}</button>}</section>}
      </div>
    </section>
  );
}
