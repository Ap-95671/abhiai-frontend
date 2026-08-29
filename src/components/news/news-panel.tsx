"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { NewsImage } from "@/components/news/news-image";
import { AppIcon } from "@/components/ui/app-icon";
import { api, ApiError, NewsArticle, NewsPage } from "@/lib/api";
import { buildNewsChatPrompt, NEWS_CHAT_PROMPT_STORAGE_KEY } from "@/lib/news";

const categories = [
  ["for-you", "For You"], ["latest", "Latest"], ["world", "World"], ["ai-tech", "AI & Tech"],
  ["business", "Business"], ["science", "Science"], ["politics", "Politics"], ["sports", "Sports"],
  ["entertainment", "Entertainment"],
] as const;
const regions = [
  ["global", "🌍 Global"], ["india", "India"], ["us", "US"], ["europe", "Europe"], ["asia", "Asia"],
  ["middle-east", "Middle East"], ["africa", "Africa"], ["americas", "Americas"],
] as const;

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}

function NewsCard({ article, onAsk, onOpen }: { article: NewsArticle; onAsk: (article: NewsArticle) => void; onOpen: (article: NewsArticle) => void }) {
  const [shareLabel, setShareLabel] = useState("Share");
  async function share() {
    const url = `${window.location.origin}/news#${encodeURIComponent(article.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: article.title, text: `Via ${article.sourceName}`, url });
      else { await navigator.clipboard.writeText(url); setShareLabel("Copied"); window.setTimeout(() => setShareLabel("Share"), 1600); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareLabel("Try again");
    }
  }
  return (
    <article className="news-story-card">
      <button aria-label={`Preview ${article.title}`} className="news-story-open" onClick={() => onOpen(article)} type="button">
        <NewsImage alt="" className="news-story-image" src={article.imageUrl} />
        <span className="news-story-body">
          <small>{article.category.toUpperCase()} · {relativeTime(article.publishedAt)}</small>
          <strong>{article.title}</strong>
          {article.description && <span className="news-story-description">{article.description}</span>}
          <span className="news-story-source">{article.sourceName}{article.relatedStoryCount > 1 ? ` · Reported by ${article.relatedStoryCount} sources` : ""}</span>
        </span>
      </button>
      <div className="news-story-actions">
        <button onClick={() => onAsk(article)} type="button"><AppIcon name="ai"/> Ask AbhiAI</button>
        <button onClick={() => void share()} type="button"><AppIcon name="share"/> {shareLabel}</button>
        <button aria-label="Save story (coming soon)" disabled title="Save is coming soon" type="button"><AppIcon name="bookmark"/> Save</button>
      </div>
    </article>
  );
}

export function NewsPanel({ accessToken, onUnauthorized }: { accessToken: string; onUnauthorized: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState("latest");
  const [region, setRegion] = useState("global");
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [page, setPage] = useState<NewsPage | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [shareLabel, setShareLabel] = useState("Share");
  const requestId = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalReturnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchDraft.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const load = useCallback(async (nextPage = 0, append = false, refresh = false) => {
    const currentRequest = ++requestId.current;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const result = await api.getNews(accessToken, { category, region, query, page: nextPage, limit: 10, refresh });
      if (currentRequest !== requestId.current) return;
      setPage(result);
      setArticles((current) => append ? [...current, ...result.content.filter((item) => !current.some((existing) => existing.id === item.id))] : result.content);
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError("News is temporarily unavailable.");
      if (!append) setArticles([]);
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [accessToken, category, onUnauthorized, query, region]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  useEffect(() => {
    if (!articles.length || selected || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const match = articles.find((article) => article.id === id);
    if (match) queueMicrotask(() => setSelected(match));
    else void api.getNewsArticle(accessToken, id).then(setSelected).catch(() => undefined);
  }, [accessToken, articles, selected]);

  const closeStory = useCallback(() => {
    setSelected(null);
    setShareLabel("Share");
    window.history.replaceState(null, "", "/news");
    queueMicrotask(() => modalReturnFocus.current?.focus());
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeStory();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeStory, selected]);

  const featured = articles[0];
  const standardStories = useMemo(() => articles.slice(1), [articles]);

  function openStory(article: NewsArticle) {
    modalReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(article);
    window.history.replaceState(null, "", `/news#${encodeURIComponent(article.id)}`);
  }

  function askAbhiAI(article: NewsArticle) {
    window.sessionStorage.setItem(NEWS_CHAT_PROMPT_STORAGE_KEY, buildNewsChatPrompt(article));
    router.push("/chat");
  }

  async function shareSelected() {
    if (!selected) return;
    const url = `${window.location.origin}/news#${encodeURIComponent(selected.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: selected.title, text: `Via ${selected.sourceName}`, url });
      else { await navigator.clipboard.writeText(url); setShareLabel("Link copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareLabel("Try again");
    }
  }

  return (
    <section aria-hidden={selected ? true : undefined} aria-labelledby="news-page-title" className="workspace-view news-workspace-view" inert={selected ? true : undefined}>
      <header className="workspace-header news-page-header">
        <div><p className="eyebrow">AbhiAI Social · Global</p><h1 id="news-page-title">Global News</h1><p>Stay informed without leaving AbhiAI.</p></div>
        <button aria-label="Refresh news" className="news-refresh-button" disabled={loading} onClick={() => void load(0, false, true)} type="button"><AppIcon name="repost"/> Refresh</button>
      </header>
      <div className="workspace-content news-workspace">
        <label className="news-search"><AppIcon name="search"/><span className="sr-only">Search news</span><input maxLength={100} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search international news…" type="search" value={searchDraft}/>{searchDraft && <button aria-label="Clear search" onClick={() => setSearchDraft("")} type="button">×</button>}</label>
        <span aria-live="polite" className="sr-only">{loading ? "Updating news results" : `${articles.length} stories loaded`}</span>
        <nav aria-label="News categories" className="news-chip-row">
          {categories.map(([value, label]) => <button aria-current={category === value ? "page" : undefined} className={category === value ? "active" : ""} key={value} onClick={() => setCategory(value)} type="button">{label}</button>)}
        </nav>
        <div aria-label="News region" className="news-region-row" role="group">
          {regions.map(([value, label]) => <button aria-pressed={region === value} className={region === value ? "active" : ""} key={value} onClick={() => setRegion(value)} type="button">{label}</button>)}
        </div>

        {loading && articles.length === 0 && <div aria-label="Loading global news" className="news-page-skeleton" role="status"><span className="featured"/><span/><span/><span/><span/></div>}
        {error && articles.length === 0 && <div className="news-state-card" role="alert"><AppIcon name="globe"/><h2>News is temporarily unavailable</h2><p>We could not load the latest stories. Your social feed and chat are still available.</p><button onClick={() => void load()} type="button">Try again</button></div>}
        {!loading && !error && articles.length === 0 && <div className="news-state-card"><AppIcon name="search"/><h2>No stories found for this topic</h2><p>Try another search, category, or region.</p><button onClick={() => { setSearchDraft(""); setCategory("latest"); setRegion("global"); }} type="button">Explore Latest News</button></div>}

        {featured && (
          <article className="news-featured">
            <NewsImage alt={featured.title} className="news-featured-image" src={featured.imageUrl}/>
            <div className="news-featured-copy"><p>{featured.category.toUpperCase()} · {relativeTime(featured.publishedAt)}</p><h2>{featured.title}</h2>{featured.description && <span>{featured.description}</span>}<small>Source: {featured.sourceName}{featured.relatedStoryCount > 1 ? ` · Reported by ${featured.relatedStoryCount} sources` : ""}</small><div><button onClick={() => openStory(featured)} type="button">Read Story</button><button onClick={() => askAbhiAI(featured)} type="button"><AppIcon name="ai"/> Ask AbhiAI</button></div></div>
          </article>
        )}
        {standardStories.length > 0 && <><div className="news-section-heading"><div><p className="eyebrow">Latest stories</p><h2>{query ? `Results for “${query}”` : `${regions.find(([value]) => value === region)?.[1]} briefing`}</h2></div>{page && <small>{page.stale ? "Showing cached stories" : `Updated ${relativeTime(page.updatedAt)}`}</small>}</div><div className="news-story-grid">{standardStories.map((article) => <NewsCard article={article} key={article.id} onAsk={askAbhiAI} onOpen={openStory}/>)}</div></>}
        {page?.hasMore && <button className="load-more-button news-load-more" disabled={loadingMore} onClick={() => void load(page.page + 1, true)} type="button">{loadingMore ? "Loading stories…" : "Load more stories"}</button>}
      </div>

      {selected && <div className="news-detail-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeStory(); }} role="presentation"><article aria-labelledby="news-detail-title" aria-modal="true" className="news-detail" ref={dialogRef} role="dialog"><button aria-label="Close story preview" className="news-detail-close" onClick={closeStory} ref={closeButtonRef} type="button">×</button><NewsImage alt={selected.title} className="news-detail-image" src={selected.imageUrl}/><div className="news-detail-content"><p className="eyebrow">{selected.category} · {relativeTime(selected.publishedAt)}</p><h2 id="news-detail-title">{selected.title}</h2><p className="news-detail-source">Reported by <strong>{selected.sourceName}</strong>{selected.author ? ` · ${selected.author}` : ""}</p>{selected.description ? <p className="news-detail-description">{selected.description}</p> : <p className="news-detail-description muted">The publisher did not provide a description. Open the original story for full context.</p>}{selected.sources.length > 1 && <div className="news-related-sources"><strong>Also reported by</strong><p>{selected.sources.map((source) => source.name).join(" · ")}</p></div>}<div className="news-detail-actions"><a href={selected.articleUrl} rel="noopener noreferrer" target="_blank">Read Original <span aria-hidden="true">↗</span></a><button onClick={() => askAbhiAI(selected)} type="button"><AppIcon name="ai"/> Ask AbhiAI</button><button onClick={() => void shareSelected()} type="button"><AppIcon name="share"/> {shareLabel}</button><button aria-label="Save story (coming soon)" disabled title="Save is coming soon" type="button"><AppIcon name="bookmark"/> Save</button></div><p className="news-copyright-note">AbhiAI displays publisher-provided metadata only. Read the original for the complete reporting.</p></div></article></div>}
    </section>
  );
}
