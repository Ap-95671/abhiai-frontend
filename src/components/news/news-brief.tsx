"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppIcon } from "@/components/ui/app-icon";
import { api, ApiError, NewsArticle, NewsPage } from "@/lib/api";
import { NewsImage } from "@/components/news/news-image";

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

export function NewsBrief({ accessToken, onUnauthorized }: { accessToken: string; onUnauthorized: () => void }) {
  const router = useRouter();
  const [page, setPage] = useState<NewsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPage(await api.getTopNews(accessToken, "global", 5));
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError("News is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, onUnauthorized]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  function openStory(article: NewsArticle) {
    router.push(`/news#${encodeURIComponent(article.id)}`);
  }

  return (
    <aside aria-labelledby="news-brief-title" className="news-brief-rail">
      <div className="news-brief-card">
        <header>
          <div><span aria-hidden="true">🌍</span><h2 id="news-brief-title">Today&apos;s Brief</h2></div>
          <button onClick={() => router.push("/news")} type="button">View all <span aria-hidden="true">→</span></button>
        </header>
        {loading && !page && <div aria-label="Loading today's news" className="news-brief-skeleton" role="status"><i/><i/><i/><i/></div>}
        {error && !page && <div className="news-brief-error" role="alert"><p>{error}</p><button onClick={() => void load()} type="button"><AppIcon name="repost"/> Try again</button></div>}
        {page && page.content.length === 0 && <p className="news-brief-empty">No global stories are available right now.</p>}
        {page && page.content.length > 0 && (
          <div className="news-brief-list">
            {page.content.map((article, index) => (
              <button className={index === 0 ? "news-brief-story featured" : "news-brief-story"} key={article.id} onClick={() => openStory(article)} type="button">
                <span className="news-brief-copy">
                  <small>{article.category.toUpperCase()} · {relativeTime(article.publishedAt)}</small>
                  <strong>{article.title}</strong>
                  <span>{article.sourceName}{article.relatedStoryCount > 1 ? ` · ${article.relatedStoryCount} sources` : ""}</span>
                </span>
                {index === 0 && <NewsImage alt="" className="news-brief-image" src={article.imageUrl} />}
              </button>
            ))}
          </div>
        )}
        {page && <footer>{page.stale ? "Showing cached stories" : `Updated ${relativeTime(page.updatedAt)}`}</footer>}
      </div>
    </aside>
  );
}
