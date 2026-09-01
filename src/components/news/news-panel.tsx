"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const SAVED_NEWS_STORAGE_KEY = "abhiai.saved-news-article-ids";

function validExternalUrl(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch { return ""; }
}

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

function NewsCard({ article, onAsk, onOpen, onSave, saved }: { article: NewsArticle; onAsk: (article: NewsArticle) => void; onOpen: (article: NewsArticle) => void; onSave: (article: NewsArticle) => void; saved: boolean }) {
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
    <article className="news-story-card" onClick={(event) => { if (!(event.target as HTMLElement).closest("button, a")) onOpen(article); }}>
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
        <button aria-pressed={saved} className={saved ? "selected" : ""} onClick={() => onSave(article)} type="button"><AppIcon name="bookmark"/> {saved ? "Saved" : "Save"}</button>
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
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(window.localStorage.getItem(SAVED_NEWS_STORAGE_KEY) ?? "[]") as string[]); }
    catch { return new Set(); }
  });
  const requestId = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalReturnFocus = useRef<HTMLElement | null>(null);
  const articlesRef = useRef<NewsArticle[]>([]);
  const openingId = useRef("");

  useEffect(() => { articlesRef.current = articles; }, [articles]);

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
      if (!append && articlesRef.current.length === 0) setArticles([]);
    } finally {
      if (currentRequest === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [accessToken, category, onUnauthorized, query, region]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const syncStoryFromLocation = useCallback(async () => {
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
    if (!id) { setSelected(null); openingId.current = ""; return; }
    if (openingId.current === id) return;
    openingId.current = id;
    const match = articlesRef.current.find((article) => article.id === id);
    try { setSelected(match ?? await api.getNewsArticle(accessToken, id)); }
    catch { setSelected(null); }
    finally { openingId.current = ""; }
  }, [accessToken]);

  useEffect(() => {
    queueMicrotask(() => void syncStoryFromLocation());
    window.addEventListener("popstate", syncStoryFromLocation);
    return () => window.removeEventListener("popstate", syncStoryFromLocation);
  }, [syncStoryFromLocation]);

  const closeStory = useCallback(() => {
    setSelected(null);
    setShareLabel("Share");
    if (window.history.state?.abhiaiNewsArticle) window.history.back();
    else window.history.replaceState(window.history.state, "", "/news");
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
    if (selected?.id === article.id || openingId.current === article.id) return;
    modalReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openingId.current = article.id;
    setSelected(article);
    window.history.pushState({ ...(window.history.state ?? {}), abhiaiNewsArticle: true }, "", `/news#${encodeURIComponent(article.id)}`);
    openingId.current = "";
  }

  function toggleSaved(article: NewsArticle) {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(article.id)) next.delete(article.id); else next.add(article.id);
      try { window.localStorage.setItem(SAVED_NEWS_STORAGE_KEY, JSON.stringify([...next])); }
      catch { setError("This browser could not save the story."); return current; }
      return next;
    });
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
    <section aria-labelledby="news-page-title" className="workspace-view news-workspace-view">
      <div aria-hidden={selected ? true : undefined} inert={selected ? true : undefined}>
      <header className="workspace-header news-page-header">
        <div><p className="eyebrow">AbhiAI Social · Global</p><h1 id="news-page-title">Global News</h1><p>Stay informed without leaving AbhiAI.</p></div>
        <button aria-label="Refresh news" className="news-refresh-button" disabled={loading} onClick={() => void load(0, false, true)} type="button"><AppIcon name="repost"/> Refresh</button>
      </header>
      <div className="workspace-content news-workspace">
        <label className="news-search"><AppIcon name="search"/><span className="sr-only">Search news</span><input maxLength={100} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search international news…" type="search" value={searchDraft}/>{searchDraft && <button aria-label="Clear search" onClick={() => setSearchDraft("")} type="button">×</button>}</label>
        <span aria-live="polite" className="sr-only">{loading ? "Updating news results" : `${articles.length} stories loaded`}</span>
        <div className="news-filter-bar">
          <nav aria-label="News categories" className="news-chip-row">
            {categories.map(([value, label]) => <button aria-current={category === value ? "page" : undefined} className={category === value ? "active" : ""} key={value} onClick={() => setCategory(value)} type="button">{label}</button>)}
          </nav>
          <label className="news-filter-select news-category-select"><span>Category</span><select aria-label="News category" onChange={(event) => setCategory(event.target.value)} value={category}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="news-filter-select"><span>Region</span><select aria-label="News region" onChange={(event) => setRegion(event.target.value)} value={region}>{regions.map(([value, label]) => <option key={value} value={value}>{label.replace("🌍 ", "")}</option>)}</select></label>
        </div>

        {loading && articles.length === 0 && <div aria-label="Loading global news" className="news-page-skeleton" role="status"><span className="featured"/><span/><span/><span/><span/></div>}
        {error && articles.length === 0 && <div className="news-state-card" role="alert"><AppIcon name="globe"/><h2>News is temporarily unavailable</h2><p>We could not load the latest stories. Your social feed and chat are still available.</p><button onClick={() => void load()} type="button">Try again</button></div>}
        {!loading && !error && articles.length === 0 && <div className="news-state-card"><AppIcon name="search"/><h2>No stories found for this topic</h2><p>Try another search, category, or region.</p><button onClick={() => { setSearchDraft(""); setCategory("latest"); setRegion("global"); }} type="button">Explore Latest News</button></div>}

        {featured && (
          <article className="news-featured" onClick={(event) => { if (!(event.target as HTMLElement).closest("button, a")) openStory(featured); }}>
            <NewsImage alt={featured.title} className="news-featured-image" src={featured.imageUrl}/>
            <div className="news-featured-copy"><p>{featured.category.toUpperCase()} · {relativeTime(featured.publishedAt)}</p><h2>{featured.title}</h2>{featured.description && <span>{featured.description}</span>}<small>Source: {featured.sourceName}{featured.relatedStoryCount > 1 ? ` · Reported by ${featured.relatedStoryCount} sources` : ""}</small><div><button onClick={() => openStory(featured)} type="button">Read Story</button><button onClick={() => askAbhiAI(featured)} type="button"><AppIcon name="ai"/> Ask AbhiAI</button></div></div>
          </article>
        )}
        {standardStories.length > 0 && <><div className="news-section-heading"><div><p className="eyebrow">Latest stories</p><h2>{query ? `Results for “${query}”` : `${regions.find(([value]) => value === region)?.[1]} briefing`}</h2></div>{page && <small>{page.stale ? "Showing cached stories" : `Updated ${relativeTime(page.updatedAt)}`}</small>}</div><div className="news-story-grid">{standardStories.map((article) => <NewsCard article={article} key={article.id} onAsk={askAbhiAI} onOpen={openStory} onSave={toggleSaved} saved={savedIds.has(article.id)}/>)}</div></>}
        {page?.hasMore && <button className="load-more-button news-load-more" disabled={loadingMore} onClick={() => void load(page.page + 1, true)} type="button">{loadingMore ? "Loading stories…" : "Load more stories"}</button>}
      </div>
      </div>

      {selected && createPortal(<div className="news-detail-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeStory(); }} role="presentation"><article aria-labelledby="news-detail-title" aria-modal="true" className="news-detail" ref={dialogRef} role="dialog"><button aria-label="Close article" className="news-detail-close" onClick={closeStory} ref={closeButtonRef} type="button">×</button><NewsImage alt={selected.title} className="news-detail-image" src={selected.imageUrl}/><div className="news-detail-content"><p className="eyebrow">{selected.category} · {relativeTime(selected.publishedAt)}</p><h2 id="news-detail-title">{selected.title}</h2><p className="news-detail-source">Reported by <strong>{selected.sourceName}</strong>{selected.author ? ` · ${selected.author}` : ""}</p>{selected.description ? <p className="news-detail-description">{selected.description}</p> : <p className="news-detail-description muted">The publisher did not provide a description. Open the original story for full context.</p>}{selected.sources.length > 1 && <div className="news-related-sources"><strong>Also reported by</strong><p>{selected.sources.map((source) => source.name).join(" · ")}</p></div>}<div className="news-detail-actions">{validExternalUrl(selected.articleUrl) && <a href={validExternalUrl(selected.articleUrl)} rel="noopener noreferrer" target="_blank">Read Original <span aria-hidden="true">↗</span></a>}<button onClick={() => askAbhiAI(selected)} type="button"><AppIcon name="ai"/> Ask AbhiAI</button><button onClick={() => void shareSelected()} type="button"><AppIcon name="share"/> {shareLabel}</button><button aria-pressed={savedIds.has(selected.id)} className={savedIds.has(selected.id) ? "selected" : ""} onClick={() => toggleSaved(selected)} type="button"><AppIcon name="bookmark"/> {savedIds.has(selected.id) ? "Saved" : "Save"}</button></div><p className="news-copyright-note">AbhiAI displays publisher-provided metadata only. Read the original for the complete reporting.</p></div></article></div>, document.body)}
    </section>
  );
}
