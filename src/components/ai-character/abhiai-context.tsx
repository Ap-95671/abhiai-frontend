"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { boundedContext, currentDocumentContext, selectedContextText, type AbhiAIPageContext } from "./context-types";

type Entry = { context: AbhiAIPageContext; priority: number; scope: string };
type ContextState = {
  assistantOpen: boolean; setAssistantOpen(value: boolean): void;
  page: AbhiAIPageContext | null; enabled: boolean; setEnabled(value: boolean): void;
  register(id: string, context: AbhiAIPageContext, priority: number): () => void;
  draft: string; takeDraft(): void; openComposer(text: string): void; selectDocument(context: AbhiAIPageContext): void;
  contextError: string; talkAboutCurrent(): void; clearSelection(): void;
};
const Context = createContext<ContextState | null>(null);
export function AbhiAIContextProvider({ children, base, userId, token, onOpenComposer }: {
  children: ReactNode; base: AbhiAIPageContext; userId: string; token?: string; onOpenComposer(): void;
}) {
  const scope = `${userId}:${base.route}:${base.pageType}:${base.entityId ?? ""}`;
  const [assistantOpen,setAssistantOpen] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [enabled, updateEnabled] = useState(false);
  const [selection, setSelection] = useState({ scope: "", entity: "", text: "" });
  const [documentContext, setDocumentContext] = useState<Entry | null>(null);
  const [contextError, setContextError] = useState("");
  const [draft, setDraft] = useState("");
  const takeDraft = useCallback(() => setDraft(""), []);
  useEffect(() => { queueMicrotask(() => {
    setSelection({ scope: "", entity: "", text: "" });
    setDocumentContext(null); setDraft(""); setContextError("");
    try { updateEnabled(localStorage.getItem(`abhiai.assistant.page-context.${userId}`) !== "off"); } catch { updateEnabled(true); }
  }); }, [userId]);
  const setEnabled = useCallback((value: boolean) => {
    updateEnabled(value); if(!value)setSelection({ scope: "", entity: "", text: "" });
    try { localStorage.setItem(`abhiai.assistant.page-context.${userId}`, value ? "on" : "off"); } catch {}
  }, [userId]);
  const register = useCallback((id: string, context: AbhiAIPageContext, priority: number) => {
    setEntries(current => ({ ...current, [id]: { context: boundedContext(context), priority, scope } }));
    return () => setEntries(current => { const next = { ...current }; delete next[id]; return next; });
  }, [scope]);
  const candidates = Object.values(entries).filter(entry => entry.scope === scope);
  const focused = candidates.sort((a,b) => b.priority-a.priority)[0]?.context;
  const registered = { ...base, ...focused, route: focused?.route ?? base.route,
    currentSection: focused?.currentSection ?? base.currentSection };
  const current = currentDocumentContext(registered, documentContext?.scope === scope ? documentContext.context : null);
  const entity = `${current.pageType}:${current.entityId ?? ""}`;
  useEffect(() => {
    if (!enabled) return;
    const capture = () => {
      const text = selectedContextText(window.getSelection());
      if (text) setSelection({ scope, entity, text });
    };
    document.addEventListener("mouseup",capture); document.addEventListener("keyup",capture);
    return () => { document.removeEventListener("mouseup",capture); document.removeEventListener("keyup",capture); };
  }, [enabled, scope, entity]);
  const page = enabled ? boundedContext({ ...current, selectedText: selection.scope === scope && selection.entity === entity ? selection.text : undefined }) : null;
  return <Context.Provider value={{ assistantOpen, setAssistantOpen, page, enabled, setEnabled, register, draft, takeDraft,
    openComposer: text => { setDraft(text.slice(0,1000)); onOpenComposer(); },
    selectDocument: context => { setDocumentContext({ context: boundedContext(context), priority: 30, scope }); openAssistant(); },
    contextError,
    talkAboutCurrent: () => {
      setContextError("");
      void (async () => {
        try {
          if (token) { const prefs = await api.assistantPreferences(token); if (!prefs.pageContext) await api.updateAssistantPreferences(token, { ...prefs, pageContext: true }); }
          setEnabled(true);
          window.dispatchEvent(new Event("abhiai:context-enabled"));
        } catch { setContextError("Page context could not be enabled. Retry the page context control in Assistant settings."); }
        openAssistant();
      })();
    },
    clearSelection: () => { setSelection({ scope: "", entity: "", text: "" }); setDocumentContext(null); },
  }}>{children}</Context.Provider>;
}
export function useAbhiAIContext() { return useContext(Context); }
export function usePageContext(context: AbhiAIPageContext | null, priority = 10) {
  const register = useContext(Context)?.register;
  const serialized = JSON.stringify(context);
  const stable = useMemo(() => JSON.parse(serialized) as AbhiAIPageContext | null, [serialized]);
  useEffect(() => {
    if (!stable || !register) return;
    return register(crypto.randomUUID(), stable, priority);
  }, [register, stable, priority]);
}
export function openAssistant() { window.dispatchEvent(new Event("abhiai:open-assistant")); }
export function AssistantDocumentButton({ id, conversationId, title, allowed }: { id: string; conversationId: string; title: string; allowed: boolean }) {
  const context = useAbhiAIContext();
  return <button type="button" title="Use an extracted document excerpt with Gemini"
    onClick={() => { if (allowed || window.confirm("Allow AbhiAI Assistant to send a limited extracted excerpt of this document to Gemini?")) context?.selectDocument({ pageType:"document", entityId:id, parentId:conversationId, title, externalProcessingAllowed:true }); }}>Ask about document</button>;
}
