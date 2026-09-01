"use client";

import { FormEvent, useState } from "react";

import { PostAttachment } from "@/components/post-attachment";
import { RichPostText } from "@/components/rich-post-text";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  api,
  ApiError,
  Hashtag,
  PageResponse,
  PostSearchFilters,
  PostSearchResult,
  SearchSort,
  UserSearchResult,
} from "@/lib/api";

type SearchKind = "users" | "posts" | "hashtags";

type SearchPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(value));
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Search could not be completed.";
}

export function SearchPanel({
  accessToken,
  onUnauthorized,
  onViewHashtag,
  onViewProfile,
}: SearchPanelProps) {
  const [kind, setKind] = useState<SearchKind>("users");
  const [draft, setDraft] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [page, setPage] = useState<PageResponse<unknown> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [author, setAuthor] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"any" | "with" | "without">("any");
  const [sort, setSort] = useState<SearchSort>("RELEVANCE");

  function postFilters(): PostSearchFilters {
    return {
      user: author.trim() || undefined,
      from: fromDate ? new Date(`${fromDate}T00:00:00.000Z`).toISOString() : undefined,
      to: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
      hasMedia: mediaFilter === "any" ? undefined : mediaFilter === "with",
      sort,
    };
  }

  async function runSearch(nextPage: number, append: boolean, nextKind = kind) {
    const query = append ? submittedQuery : draft.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters to search.");
      return;
    }
    if (nextKind === "posts" && fromDate && toDate && fromDate > toDate) {
      setError("The start date must not be after the end date.");
      return;
    }

    setIsSearching(true);
    setError("");
    setSubmittedQuery(query);

    try {
      if (nextKind === "users") {
        const result = await api.searchUsers(accessToken, query, nextPage);
        setUsers((current) => append ? [...current, ...result.content] : result.content);
        setPosts([]); setHashtags([]); setPage(result);
      } else if (nextKind === "posts") {
        const result = await api.searchPosts(accessToken, query, postFilters(), nextPage);
        setPosts((current) => append ? [...current, ...result.content] : result.content);
        setUsers([]); setHashtags([]); setPage(result);
      } else {
        const result = await api.searchHashtags(accessToken, query, nextPage);
        setHashtags((current) => append ? [...current, ...result.content] : result.content);
        setUsers([]); setPosts([]); setPage(result);
      }
    } catch (searchError) {
      if (searchError instanceof ApiError && searchError.status === 401) return onUnauthorized();
      setError(messageFor(searchError));
    } finally {
      setIsSearching(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(0, false);
  }

  function changeKind(nextKind: SearchKind) {
    if (nextKind === kind) return;
    setKind(nextKind);
    setUsers([]); setPosts([]); setHashtags([]); setPage(null);
    setSubmittedQuery(""); setError("");
  }

  const resultCount = kind === "users" ? users.length : kind === "posts" ? posts.length : hashtags.length;
  const placeholder = kind === "users"
    ? "Search people by name or username"
    : kind === "posts"
      ? "Search posts by topic or keyword"
      : "Search hashtags like #AbhiAI";

  return (
    <section className="workspace-view" aria-labelledby="search-title">
      <header className="workspace-header"><div><p className="eyebrow">Discover</p><h1 id="search-title">Search AbhiAI</h1><p>Find people, posts, and topics across the social network.</p></div></header>
      <div className="workspace-content search-workspace">
        <form className="search-form" onSubmit={submit} role="search">
          <span aria-hidden="true" className="search-icon">⌕</span>
          <input aria-label={`Search ${kind}`} maxLength={100} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} value={draft} />
          <button disabled={isSearching || draft.trim().length < 2} type="submit">{isSearching ? "Searching…" : "Search"}</button>
        </form>

        <div className="segmented-control search-categories" role="tablist" aria-label="Search category">
          {(["users", "posts", "hashtags"] as SearchKind[]).map((item) => <button aria-selected={kind === item} className={kind === item ? "active" : ""} key={item} onClick={() => changeKind(item)} role="tab" type="button">{item === "users" ? "People" : item === "posts" ? "Posts" : "Hashtags"}</button>)}
        </div>

        {kind === "posts" && <div className="search-filter-panel" aria-label="Post search filters">
          <label>Author<input onChange={(event) => setAuthor(event.target.value)} placeholder="@username" value={author} /></label>
          <label>From<input onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} /></label>
          <label>To<input onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} /></label>
          <label>Media<select onChange={(event) => setMediaFilter(event.target.value as typeof mediaFilter)} value={mediaFilter}><option value="any">Any</option><option value="with">With media</option><option value="without">Without media</option></select></label>
          <label>Sort<select onChange={(event) => setSort(event.target.value as SearchSort)} value={sort}><option value="RELEVANCE">Relevance</option><option value="RECENT">Most recent</option><option value="POPULAR">Most popular</option></select></label>
        </div>}

        {error && <p className="inline-error" role="alert">{error}</p>}
        {!submittedQuery && !isSearching && <div className="feature-empty-state"><span aria-hidden="true" className="empty-state-icon">⌕</span><h2>Explore the network</h2><p>Search for a person, an idea, or a topic you want to follow.</p></div>}
        {submittedQuery && !isSearching && resultCount === 0 && !error && <div className="feature-empty-state compact"><h2>No results found</h2><p>Try a different spelling or broader search filters.</p></div>}

        {resultCount > 0 && <div className="search-results" aria-live="polite">
          <div className="results-summary"><p>Results for <strong>“{submittedQuery}”</strong></p><span>{page?.totalElements ?? resultCount} found</span></div>
          {kind === "users" ? <div className="people-grid">{users.map((user) => <article className="person-card" key={user.id}><UserAvatar accessToken={accessToken} className="profile-avatar" displayName={user.displayName} profileMediaId={user.profileMediaId} profilePicture={user.profilePicture}/><div className="person-copy"><h2>{user.displayName}{user.verifiedStatus !== "NONE" && <span className="verified-badge" title={user.verifiedStatus}>✓</span>}</h2><p className="username">@{user.username}</p><p className="bio">{user.bio || "Exploring and building with AbhiAI."}</p><p className="follower-count">{formatCount(user.followerCount)} followers</p><button className="profile-link-button" onClick={() => onViewProfile(user.username)} type="button">View profile</button></div></article>)}</div>
          : kind === "posts" ? <div className="post-results">{posts.map((post) => <article className="post-card" key={post.id}><div className="post-author-row"><UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={post.author.displayName} profileMediaId={post.author.profileMediaId} profilePicture={post.author.profilePicture}/><div><button className="inline-author-button" onClick={() => onViewProfile(post.author.username)} type="button">{post.author.displayName}</button><p>@{post.author.username} · {formatDate(post.createdAt)}</p></div><span className="visibility-pill">{post.visibility.toLowerCase()}</span></div><RichPostText className="post-content" onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} text={post.textContent} />{post.media.length > 0 && <div className={`post-media-grid count-${post.media.length}`}>{post.media.map((media) => <PostAttachment accessToken={accessToken} asset={media} key={media.id} />)}</div>}<div className="post-metrics" aria-label="Post activity"><span>♡ {formatCount(post.likeCount)}</span><span>↩ {formatCount(post.replyCount)}</span><span>↻ {formatCount(post.repostCount)}</span><span>◉ {formatCount(post.viewCount)}</span></div></article>)}</div>
          : <div className="hashtag-search-results">{hashtags.map((tag) => <button key={tag.id} onClick={() => onViewHashtag(tag.normalizedTag)} type="button"><strong>#{tag.displayTag}</strong><span>{formatCount(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}</span></button>)}</div>}
          {page && !page.last && <button className="load-more-button" disabled={isSearching} onClick={() => void runSearch(page.page + 1, true)} type="button">{isSearching ? "Loading…" : "Load more"}</button>}
        </div>}
      </div>
    </section>
  );
}
