"use client";

import { SelectControl } from "@/components/chat/tool-menu";
import { useState } from "react";
import { api, type MemoryCategory } from "@/lib/api";
import { useAbhiAIContext } from "./abhiai-context";
import { safeToolHref, type AssistantToolResult } from "./tool-types";
import styles from "./assistant.module.css";
export function AssistantToolResults({ results, token, onNavigate }: { results: AssistantToolResult[]; token: string; onNavigate(): void }) {
  return <div className={styles.toolResults} aria-label="Assistant tool results">{results.filter(r=>r.kind!=="context" && r.kind!=="expression").map((result,index) =>
    <ToolResult key={`${index}:${result.tool}:${result.draft ?? result.title}`} result={result} token={token} onNavigate={onNavigate}/>)}</div>;
}
function ToolResult({ result, token, onNavigate }: { result: AssistantToolResult; token: string; onNavigate(): void }) {
  const context = useAbhiAIContext();
  const [draft,setDraft] = useState(result.draft ?? "");
  const [status,setStatus] = useState("");
  const [category,setCategory] = useState<MemoryCategory>((result.memoryCategory ?? "PREFERENCE") as MemoryCategory);
  const [saved,setSaved] = useState(false);
  const [saving,setSaving] = useState(false);
  async function save() {
    if (saving || saved) return;
    setSaving(true); setStatus("");
    try { await api.createMemory(token,draft,category); setSaved(true); setStatus("Saved. Enable memory in settings to use it in future replies."); window.dispatchEvent(new Event("abhiai:memory-changed")); }
    catch { setStatus("Memory could not be saved. Use a non-sensitive preference and retry."); }
    finally { setSaving(false); }
  }
  return <section className={styles.toolCard} aria-label={result.title}>
    <strong>{result.title}</strong><p>{result.text}</p>
    {result.kind === "cards" && !result.cards.length && <p>No matches found.</p>}
    {result.cards.map((card,index) => <div key={index} className={styles.resultItem}>
      {safeToolHref(card.href) ? <a href={safeToolHref(card.href)} onClick={onNavigate}>{card.title ?? "Open result"}</a> : <strong>{card.title ?? "Available context"}</strong>}
      {card.source && <small>{card.source}</small>}{card.text && <p>{card.text.slice(0,240)}</p>}
    </div>)}
    {result.kind === "forget" && result.cards.map(card=><button type="button" key={String(card.id)} disabled={saved} onClick={()=>{if(window.confirm(`Forget saved memory: ${card.title}?`))void api.deleteMemory(token,String(card.id)).then(()=>{setSaved(true);setStatus("Forgotten. This memory will no longer be retrieved.");window.dispatchEvent(new Event("abhiai:memory-changed"));}).catch(()=>setStatus("Could not forget this memory. Try settings."));}}>Forget: {card.title}</button>)}
    {result.kind === "artifact" && <><pre className={styles.artifact}>{result.draft}</pre><button type="button" onClick={()=>void navigator.clipboard.writeText(result.draft ?? "").then(()=>setStatus("Copied.")).catch(()=>setStatus("Select the text to copy it."))}>Copy result</button></>}
    {(result.kind === "draft" || result.kind === "memory") && <>
      {result.kind === "memory" && <label>Memory category<SelectControl value={category} disabled={saved} onChange={e=>setCategory(e.target.value as MemoryCategory)}>{(["PREFERENCE","INTEREST","ASSISTANT_SETTING","PROJECT_CONTEXT"] as const).map(value=><option key={value} value={value}>{value.toLowerCase().replaceAll("_"," ")}</option>)}</SelectControl></label>}
      <label>Review {result.kind === "draft" ? "post draft" : "suggested memory"}<textarea value={draft} maxLength={result.kind === "draft" ? 1000 : 500} rows={4} disabled={saved} onChange={e=>setDraft(e.target.value)}/></label>
      {result.kind === "draft" ? <button type="button" disabled={!draft.trim()} onClick={()=>{ context?.openComposer(draft); onNavigate(); }}>Edit in post composer</button>
        : <button type="button" disabled={saving || saved || !draft.trim()} onClick={()=>void save()}>{saved ? "Memory saved" : saving ? "Saving…" : "Save memory"}</button>}
    </>}
    {status && <p role="status">{status}</p>}
  </section>;
}
