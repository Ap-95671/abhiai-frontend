"use client";

import { useCallback, useEffect, useState } from "react";

import { PostAttachment } from "@/components/post-attachment";
import { RichPostText } from "@/components/rich-post-text";
import {
  api,
  ApiError,
  ExploreResult,
  PostSearchResult,
} from "@/lib/api";

type ExplorePanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function ExplorePost({
  accessToken,
  post,
  onViewHashtag,
  onViewProfile,
  mediaFirst = false,
}: {
  accessToken: string;
  post: PostSearchResult;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
  mediaFirst?: boolean;
}) {
  const attachments = post.media.length > 0 && (
    <div className={`post-media-grid count-${post.media.length}`}>
      {post.media.map((media) => (
        <PostAttachment accessToken={accessToken} asset={media} key={media.id} />
      ))}
    </div>
  );

  return (
    <article className="explore-post-card">
      {mediaFirst && attachments}
      <div className="post-author-row">
        <div className="profile-avatar small-avatar" aria-hidden="true">{initials(post.author.displayName)}</div>
        <div>
          <button className="inline-author-button" onClick={() => onViewProfile(post.author.username)} type="button">
            {post.author.displayName}
          </button>
          <p>@{post.author.username} · {formatDate(post.createdAt)}</p>
        </div>
      </div>
      <RichPostText className="post-content" onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} text={post.textContent} />
      {!mediaFirst && attachments}
      <div className="post-metrics" aria-label="Post activity">
        <span>♡ {formatCount(post.likeCount)}</span>
        <span>↩ {formatCount(post.replyCount)}</span>
        <span>↻ {formatCount(post.repostCount)}</span>
        <span>◉ {formatCount(post.viewCount)}</span>
      </div>
    </article>
  );
}

export function ExplorePanel({
  accessToken,
  onUnauthorized,
  onViewHashtag,
  onViewProfile,
}: ExplorePanelProps) {
  const [explore, setExplore] = useState<ExploreResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadExplore = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setExplore(await api.getExplore(accessToken));
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "Explore could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void loadExplore());
  }, [loadExplore]);

  return (
    <section className="workspace-view" aria-labelledby="explore-title">
      <header className="workspace-header explore-header">
        <div>
          <p className="eyebrow">Discover</p>
          <h1 id="explore-title">Explore what&apos;s happening</h1>
          <p>Fresh public conversations, topics, creators, and media from across AbhiAI.</p>
        </div>
        <button className="secondary-button" disabled={isLoading} onClick={() => void loadExplore()} type="button">
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="workspace-content explore-workspace">
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && !explore && <div className="explore-loading" aria-label="Loading Explore"><span /><span /><span /></div>}

        {explore && <>
          <aside className="ranking-note">
            <span aria-hidden="true">✦</span>
            <p><strong>How Explore is ranked</strong>{explore.rankingSummary} Window: {explore.rankingWindowDays} days.</p>
          </aside>

          <div className="explore-overview-grid">
            <section className="explore-section explore-topic-section" aria-labelledby="trending-topics-title">
              <div className="section-heading"><div><p className="eyebrow">Topics</p><h2 id="trending-topics-title">Trending hashtags</h2></div></div>
              <div className="explore-topic-list">
                {explore.trendingHashtags.map((tag, index) => (
                  <button key={tag.id} onClick={() => onViewHashtag(tag.normalizedTag)} type="button">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>#{tag.displayTag}</strong>
                    <small>{formatCount(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}</small>
                  </button>
                ))}
                {explore.trendingHashtags.length === 0 && <p className="explore-empty">Topics will appear as public posts use hashtags.</p>}
              </div>
            </section>

            <section className="explore-section" aria-labelledby="people-to-follow-title">
              <div className="section-heading"><div><p className="eyebrow">Community</p><h2 id="people-to-follow-title">People to discover</h2></div></div>
              <div className="explore-people-list">
                {explore.suggestedAccounts.map((user) => (
                  <button key={user.id} onClick={() => onViewProfile(user.username)} type="button">
                    <span className="profile-avatar small-avatar" aria-hidden="true">{initials(user.displayName)}</span>
                    <span><strong>{user.displayName}</strong><small>@{user.username} · {formatCount(user.followerCount)} followers</small></span>
                    <b aria-hidden="true">›</b>
                  </button>
                ))}
                {explore.suggestedAccounts.length === 0 && <p className="explore-empty">You have discovered everyone currently on AbhiAI.</p>}
              </div>
            </section>
          </div>

          <section className="explore-section explore-featured" aria-labelledby="trending-posts-title">
            <div className="section-heading"><div><p className="eyebrow">Now</p><h2 id="trending-posts-title">Trending posts</h2></div><span>{explore.trendingPosts.length} stories</span></div>
            <div className="explore-post-grid">
              {explore.trendingPosts.map((post) => <ExplorePost accessToken={accessToken} key={post.id} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post} />)}
              {explore.trendingPosts.length === 0 && <p className="explore-empty wide">Create a public post to start the conversation.</p>}
            </div>
          </section>

          <div className="explore-lower-grid">
            <section className="explore-section" aria-labelledby="popular-discussions-title">
              <div className="section-heading"><div><p className="eyebrow">Discussed</p><h2 id="popular-discussions-title">Popular discussions</h2></div></div>
              <div className="explore-stack">
                {explore.popularDiscussions.map((post) => <ExplorePost accessToken={accessToken} key={post.id} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post} />)}
                {explore.popularDiscussions.length === 0 && <p className="explore-empty">Posts with replies will appear here.</p>}
              </div>
            </section>

            <section className="explore-section" aria-labelledby="recommended-media-title">
              <div className="section-heading"><div><p className="eyebrow">Watch & view</p><h2 id="recommended-media-title">Recommended media</h2></div></div>
              <div className="explore-stack">
                {explore.recommendedMedia.map((post) => <ExplorePost accessToken={accessToken} key={post.id} mediaFirst onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post} />)}
                {explore.recommendedMedia.length === 0 && <p className="explore-empty">Popular public images and videos will appear here.</p>}
              </div>
            </section>
          </div>
        </>}
      </div>
    </section>
  );
}
