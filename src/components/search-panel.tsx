"use client";

import { FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";

import { NewsImage } from "@/components/news/news-image";
import { PostCard } from "@/components/social/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  api,
  ApiError,
  ConversationSummary,
  Hashtag,
  NewsArticle,
  NewsPage,
  PageResponse,
  PostSearchFilters,
  PostSearchResult,
  SearchSort,
  UserSearchResult,
} from "@/lib/api";

type SearchKind = "all" | "conversations" | "users" | "posts" | "news" | "hashtags";

type SearchPanelProps = {
  accessToken: string;
  currentUserId?: string;
  initialKind?: string;
  initialQuery?: string;
  onUnauthorized: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenNews: (articleId: string) => void;
  onOpenPost: (postId: string) => void;
  onSearchStateChange?: (query: string, kind: SearchKind) => void;
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

function localDayBoundary(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  const date = endOfDay
    ? new Date(year, month - 1, day + 1, 0, 0, 0, -1)
    : new Date(year, month - 1, day);
  return date.toISOString();
}

export function SearchPanel({
  accessToken,
  currentUserId,
  initialKind,
  initialQuery,
  onUnauthorized,
  onOpenConversation,
  onOpenNews,
  onOpenPost,
  onSearchStateChange,
  onViewHashtag,
  onViewProfile,
}: SearchPanelProps) {
  const supportedKinds: SearchKind[] = ["all", "conversations", "users", "posts", "news", "hashtags"];
  const restoredKind = supportedKinds.includes(initialKind as SearchKind) ? initialKind as SearchKind : "all";
  const restoredQuery = initialQuery?.trim().slice(0, 100) ?? "";
  const [kind, setKind] = useState<SearchKind>(restoredKind);
  const [draft, setDraft] = useState(restoredQuery);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [page, setPage] = useState<PageResponse<unknown> | null>(null);
  const [newsPage, setNewsPage] = useState<NewsPage | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [author, setAuthor] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"any" | "with" | "without">("any");
  const [sort, setSort] = useState<SearchSort>("RELEVANCE");
  const initialSearchStarted = useRef(false);

  function postFilters(): PostSearchFilters {
    return {
      user: author.trim() || undefined,
      from: fromDate ? localDayBoundary(fromDate, false) : undefined,
      to: toDate ? localDayBoundary(toDate, true) : undefined,
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
    onSearchStateChange?.(query, nextKind);

    try {
      if (nextKind === "all") {
        const results = await Promise.allSettled([
          api.searchConversations(accessToken, query, 0, 5),
          api.searchUsers(accessToken, query, 0, 5),
          api.searchPosts(accessToken, query, {}, 0, 5),
          api.getNews(accessToken, { query, category: "latest", region: "global", page: 0, limit: 5 }),
          api.searchHashtags(accessToken, query, 0, 5),
        ] as const);
        const rejected = results.filter((result) => result.status === "rejected");
        const unauthorized = rejected.some((result) => result.reason instanceof ApiError && result.reason.status === 401);
        if (unauthorized) return onUnauthorized();
        const [chatResult, userResult, postResult, newsResult, hashtagResult] = results;
        setConversations(chatResult.status === "fulfilled" ? chatResult.value.content : []);
        setUsers(userResult.status === "fulfilled" ? userResult.value.content : []);
        setPosts(postResult.status === "fulfilled" ? postResult.value.content : []);
        setNews(newsResult.status === "fulfilled" ? newsResult.value.content : []);
        setHashtags(hashtagResult.status === "fulfilled" ? hashtagResult.value.content : []);
        setPage(null); setNewsPage(null);
        if (rejected.length > 0) setError(rejected.length === results.length ? "Search is temporarily unavailable." : "Some result groups could not be loaded. Available results are shown below.");
      } else if (nextKind === "users") {
        const result = await api.searchUsers(accessToken, query, nextPage);
        setUsers((current) => append ? [...current, ...result.content] : result.content);
        setPosts([]); setHashtags([]); setConversations([]); setNews([]); setPage(result); setNewsPage(null);
      } else if (nextKind === "posts") {
        const result = await api.searchPosts(accessToken, query, postFilters(), nextPage);
        setPosts((current) => append ? [...current, ...result.content] : result.content);
        setUsers([]); setHashtags([]); setConversations([]); setNews([]); setPage(result); setNewsPage(null);
      } else if (nextKind === "hashtags") {
        const result = await api.searchHashtags(accessToken, query, nextPage);
        setHashtags((current) => append ? [...current, ...result.content] : result.content);
        setUsers([]); setPosts([]); setConversations([]); setNews([]); setPage(result); setNewsPage(null);
      } else if (nextKind === "conversations") {
        const result = await api.searchConversations(accessToken, query, nextPage);
        setConversations((current) => append ? [...current, ...result.content] : result.content);
        setUsers([]); setPosts([]); setHashtags([]); setNews([]); setPage(result); setNewsPage(null);
      } else {
        const result = await api.getNews(accessToken, { query, category: "latest", region: "global", page: nextPage, limit: 10 });
        setNews((current) => append ? [...current, ...result.content.filter((article) => !current.some((existing) => existing.id === article.id))] : result.content);
        setUsers([]); setPosts([]); setHashtags([]); setConversations([]); setPage(null); setNewsPage(result);
      }
    } catch (searchError) {
      if (searchError instanceof ApiError && searchError.status === 401) return onUnauthorized();
      setError(messageFor(searchError));
    } finally {
      setIsSearching(false);
    }
  }

  const runInitialSearch = useEffectEvent((nextKind: SearchKind) => {
    void runSearch(0, false, nextKind);
  });

  useEffect(() => {
    if (initialSearchStarted.current || restoredQuery.length < 2) return;
    initialSearchStarted.current = true;
    queueMicrotask(() => runInitialSearch(restoredKind));
  }, [restoredKind, restoredQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(0, false);
  }

  function changeKind(nextKind: SearchKind) {
    if (nextKind === kind) return;
    const shouldRefresh = Boolean(submittedQuery);
    setKind(nextKind);
    setUsers([]); setPosts([]); setHashtags([]); setConversations([]); setNews([]); setPage(null); setNewsPage(null);
    setSubmittedQuery(""); setError("");
    if (shouldRefresh) queueMicrotask(() => void runSearch(0, false, nextKind));
  }

  const resultCount = kind === "all"
    ? users.length + posts.length + hashtags.length + conversations.length + news.length
    : kind === "users" ? users.length : kind === "posts" ? posts.length : kind === "hashtags" ? hashtags.length : kind === "news" ? news.length : conversations.length;
  const placeholder = kind === "all"
    ? "Search across AbhiAI"
    : kind === "users"
    ? "Search people by name or username"
    : kind === "posts"
      ? "Search posts by topic or keyword"
      : kind === "hashtags"
        ? "Search hashtags like #AbhiAI"
        : kind === "news"
          ? "Search international news"
          : "Search your AI conversation history";

  const conversationResults = (items: ConversationSummary[]) => <div className="conversation-search-results">{items.map((conversation) => <button key={conversation.id} onClick={() => onOpenConversation(conversation.id)} type="button"><span aria-hidden="true" className="conversation-search-icon">✦</span><span><strong>{conversation.title}</strong><small>Updated {formatDate(conversation.updatedAt)} · {conversation.modelSelectionMode === "AUTO" ? "Smart routing" : "Manual model"}</small></span><b aria-hidden="true">›</b></button>)}</div>;
  const newsResults = (items: NewsArticle[]) => <div className="universal-news-results">{items.map((article) => <button key={article.id} onClick={() => onOpenNews(article.id)} type="button"><NewsImage alt="" className="universal-news-image" src={article.imageUrl}/><span><small>{article.category.toUpperCase()} · {formatDate(article.publishedAt)}</small><strong>{article.title}</strong><span>{article.sourceName}</span></span><b aria-hidden="true">›</b></button>)}</div>;

  return (
    <section className="workspace-view" aria-labelledby="search-title">
      <header className="workspace-header"><div><p className="eyebrow">Discover</p><h1 id="search-title">Search AbhiAI</h1><p>Find AI chats, people, posts, global news, and topics from one private search.</p></div></header>
      <div className="workspace-content search-workspace">
        <form className="search-form" onSubmit={submit} role="search">
          <span aria-hidden="true" className="search-icon">⌕</span>
          <input aria-label={`Search ${kind}`} maxLength={100} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} value={draft} />
          <button disabled={isSearching || draft.trim().length < 2} type="submit">{isSearching ? "Searching…" : "Search"}</button>
        </form>

        <div className="segmented-control search-categories" role="tablist" aria-label="Search category">
          {(["all", "conversations", "users", "posts", "news", "hashtags"] as SearchKind[]).map((item) => <button aria-selected={kind === item} className={kind === item ? "active" : ""} key={item} onClick={() => changeKind(item)} role="tab" type="button">{item === "all" ? "All" : item === "users" ? "People" : item === "posts" ? "Posts" : item === "news" ? "News" : item === "hashtags" ? "Hashtags" : "AI chats"}</button>)}
        </div>

        {kind === "posts" && <div className="search-filter-panel" aria-label="Post search filters">
          <label>Author<input onChange={(event) => setAuthor(event.target.value)} placeholder="@username" value={author} /></label>
          <label>From<input onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} /></label>
          <label>To<input onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} /></label>
          <label>Media<select onChange={(event) => setMediaFilter(event.target.value as typeof mediaFilter)} value={mediaFilter}><option value="any">Any</option><option value="with">With media</option><option value="without">Without media</option></select></label>
          <label>Sort<select onChange={(event) => setSort(event.target.value as SearchSort)} value={sort}><option value="RELEVANCE">Relevance</option><option value="RECENT">Most recent</option><option value="POPULAR">Most popular</option></select></label>
        </div>}

        {error && <p className="inline-error" role="alert">{error}</p>}
        {!submittedQuery && !isSearching && <EmptyState description="Search for a person, an idea, or a topic you want to follow." icon="search" title="Explore the network" />}
        {submittedQuery && !isSearching && resultCount === 0 && !error && <EmptyState compact description="Try a different spelling or broader search filters." icon="search" title={`No ${kind === "all" ? "results" : kind} found for “${submittedQuery}”`} />}

        {resultCount > 0 && <div className="search-results" aria-live="polite">
          <div className="results-summary"><p>Results for <strong>“{submittedQuery}”</strong></p><span>{page?.totalElements ?? resultCount} found</span></div>
          {kind === "all" ? <div className="universal-search-groups">
            {conversations.length > 0 && <section><header><h2>AI chats</h2><button onClick={() => changeKind("conversations")} type="button">See all</button></header>{conversationResults(conversations)}</section>}
            {users.length > 0 && <section><header><h2>People</h2><button onClick={() => changeKind("users")} type="button">See all</button></header><div className="people-grid">{users.map((user) => <article className="person-card" key={user.id}><UserAvatar accessToken={accessToken} className="profile-avatar" displayName={user.displayName} profileMediaId={user.profileMediaId} profilePicture={user.profilePicture}/><div className="person-copy"><h2>{user.displayName}{user.verifiedStatus !== "NONE" && <span className="verified-badge" title={user.verifiedStatus}>✓</span>}</h2><p className="username">@{user.username}</p><button className="profile-link-button" onClick={() => onViewProfile(user.username)} type="button">View profile</button></div></article>)}</div></section>}
            {posts.length > 0 && <section><header><h2>Posts</h2><button onClick={() => changeKind("posts")} type="button">See all</button></header><div className="post-results">{posts.map((post) => <PostCard accessToken={accessToken} compact currentUserId={currentUserId} key={post.id} onError={setError} onOpen={() => onOpenPost(post.id)} onUnauthorized={onUnauthorized} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post}/>)}</div></section>}
            {news.length > 0 && <section><header><h2>Global news</h2><button onClick={() => changeKind("news")} type="button">See all</button></header>{newsResults(news)}</section>}
            {hashtags.length > 0 && <section><header><h2>Hashtags</h2><button onClick={() => changeKind("hashtags")} type="button">See all</button></header><div className="hashtag-search-results">{hashtags.map((tag) => <button key={tag.id} onClick={() => onViewHashtag(tag.normalizedTag)} type="button"><strong>#{tag.displayTag}</strong><span>{formatCount(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}</span></button>)}</div></section>}
          </div>
          : kind === "users" ? <div className="people-grid">{users.map((user) => <article className="person-card" key={user.id}><UserAvatar accessToken={accessToken} className="profile-avatar" displayName={user.displayName} profileMediaId={user.profileMediaId} profilePicture={user.profilePicture}/><div className="person-copy"><h2>{user.displayName}{user.verifiedStatus !== "NONE" && <span className="verified-badge" title={user.verifiedStatus}>✓</span>}</h2><p className="username">@{user.username}</p><p className="bio">{user.bio || "Exploring and building with AbhiAI."}</p><p className="follower-count">{formatCount(user.followerCount)} followers</p><button className="profile-link-button" onClick={() => onViewProfile(user.username)} type="button">View profile</button></div></article>)}</div>
          : kind === "posts" ? <div className="post-results">{posts.map((post) => <PostCard accessToken={accessToken} currentUserId={currentUserId} key={post.id} onError={setError} onOpen={() => onOpenPost(post.id)} onUnauthorized={onUnauthorized} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} post={post}/>)}</div>
          : kind === "hashtags" ? <div className="hashtag-search-results">{hashtags.map((tag) => <button key={tag.id} onClick={() => onViewHashtag(tag.normalizedTag)} type="button"><strong>#{tag.displayTag}</strong><span>{formatCount(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}</span></button>)}</div>
          : kind === "news" ? newsResults(news)
          : conversationResults(conversations)}
          {((page && !page.last) || (newsPage?.hasMore && kind === "news")) && <button className="load-more-button" disabled={isSearching} onClick={() => void runSearch(kind === "news" ? (newsPage?.page ?? 0) + 1 : (page?.page ?? 0) + 1, true)} type="button">{isSearching ? "Loading…" : "Load more"}</button>}
        </div>}
      </div>
    </section>
  );
}
