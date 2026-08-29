import type { NewsArticle } from "@/lib/api";

export const NEWS_CHAT_PROMPT_STORAGE_KEY = "abhiai.pending-news-prompt";

export function buildNewsChatPrompt(article: NewsArticle) {
  return [
    "Explain this news story and why it matters. Use only the supplied story metadata as confirmed facts, clearly label uncertainty, and do not invent details.",
    `Headline: ${article.title}`,
    article.description ? `Description: ${article.description}` : "Description: Not provided by the publisher.",
    `Source: ${article.sourceName}`,
    `Published: ${article.publishedAt}`,
    `Original article: ${article.articleUrl}`,
  ].join("\n");
}
