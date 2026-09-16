export type PageType = "news" | "post" | "profile" | "feed" | "search" | "conversation" | "document" | "other";
export type AbhiAIPageContext = {
  pageType: PageType; route?: string; entityId?: string; parentId?: string; title?: string;
  selectedText?: string; externalProcessingAllowed?: boolean;
};
export const contextLabels: Record<PageType, string> = {
  news: "News article", post: "Current post", profile: "Profile", feed: "Feed", search: "Search",
  conversation: "Current AI chat", document: "Document excerpt", other: "Current page",
};
export function boundedContext(context: AbhiAIPageContext): AbhiAIPageContext {
  return { pageType: context.pageType, route: context.route?.slice(0,240), entityId: context.entityId?.slice(0,160),
    parentId: context.parentId?.slice(0,160), title: context.title?.slice(0,240), selectedText: context.selectedText?.slice(0,2000),
    externalProcessingAllowed: context.externalProcessingAllowed === true };
}
/** A document selection belongs only to the chat that owns its attachment. */
export function currentDocumentContext(page: AbhiAIPageContext, document: AbhiAIPageContext | null): AbhiAIPageContext {
  return document?.pageType === "document" && page.pageType === "conversation" && !!page.entityId
    && document.parentId === page.entityId ? document : page;
}
/** Only selections within one explicitly registered read-only content surface are eligible. */
export function selectedContextText(selection: Selection | null): string {
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return "";
  const element = (node: Node) => node.nodeType === 1 ? node as Element : node.parentElement;
  const anchor = element(selection.anchorNode), focus = element(selection.focusNode);
  const forbidden = 'input, textarea, select, [contenteditable], [data-assistant-private], [data-assistant-panel]';
  if (anchor?.closest(forbidden) || focus?.closest(forbidden)) return "";
  const surface = anchor?.closest('[data-assistant-context]');
  if (!surface || surface !== focus?.closest('[data-assistant-context]')) return "";
  const range = selection.getRangeAt(0);
  if (range.cloneContents().querySelector(forbidden)) return "";
  return selection.toString().trim().slice(0,2000);
}
