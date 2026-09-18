import type { AssistantExpression } from "./assistant-state";
export type AssistantToolResult = {
  tool: string; kind: "cards" | "draft" | "memory" | "expression" | "context" | "notice" | "artifact" | "forget";
  title: string; text: string; cards: { title?: string; text?: string; href?: string; source?: string; [key: string]: unknown }[];
  draft?: string; memoryCategory?: string; expression?: AssistantExpression;
};
export type AssistantEvent = { status?: string; notice?: string; expression?: AssistantExpression; result?: AssistantToolResult };
export const toolLabels: Record<string, string> = {
  SEARCH_ABHIAI: "Searching AbhiAI…", GET_SAVED_CONTENT: "Finding saved posts…", CREATE_POST_DRAFT: "Preparing your draft…",
  PROPOSE_MEMORY: "Preparing a memory for review…", GET_ASSISTANT_CONTEXT: "Reading current context…",
};
export function safeToolHref(href: unknown): string | undefined {
  return typeof href === "string" && /^\/(?:$|news(?:#|$)|social(?:[?#]|$))/.test(href) && !/[\\\s]/.test(href) ? href : undefined;
}
