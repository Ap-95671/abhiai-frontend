import type { NewsArticle } from "@/lib/api";

export const NEWS_CHAT_PROMPT_STORAGE_KEY = "abhiai.pending-news-prompt";

export function buildNewsChatPrompt(article: NewsArticle) {
  // The normal message API accepts 10,000 characters. Keep identifying metadata
  // even for an unusually long provider description, and be explicit about limits.
  const clipped = (value: string | null | undefined, max: number) => {
    if (!value) return "Not provided";
    return value.length > max ? `${value.slice(0, max)}… [truncated]` : value;
  };
  return [
    "Explain this article and why it matters. Do not search the web. Use only the supplied article metadata as confirmed facts, clearly label uncertainty, and do not invent details.",
    `Article ID: ${clipped(article.id, 160)}`,
    `Headline: ${clipped(article.title, 500)}`,
    article.description ? `Description: ${clipped(article.description, 6000)}` : "Description: Not provided by the publisher.",
    `Source: ${clipped(article.sourceName, 200)}`,
    `Published: ${clipped(article.publishedAt, 80)}`,
    `Original article: ${clipped(article.articleUrl, 2000)}`,
  ].join("\n");
}
