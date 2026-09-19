"use client";

import { SelectControl } from "@/components/chat/tool-menu";

import { FormEvent, useCallback, useEffect, useState, useId } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { Toggle } from "@/components/ui/toggle";
import { api, ApiError, MemorySettings, MemoryCategory, type UserMemory } from "@/lib/api";

export function MemoryPanel({ accessToken, onUnauthorized, projectKey="",conversationId,sessionId }: { accessToken: string; onUnauthorized: () => void;projectKey?:string;conversationId?:string;sessionId?:string }) {
  const prefix = useId();
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [category, setCategory] = useState<MemoryCategory>("PREFERENCE");
  const [scope,setScope]=useState<UserMemory["scope"]>("GLOBAL");
  const [preferenceKey,setPreferenceKey]=useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setSettings(await api.getMemorySettings(accessToken)); }
    catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "Memory settings could not be loaded.");
    } finally { setLoading(false); }
  }, [accessToken, onUnauthorized]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function toggleEnabled() {
    if (!settings) return;
    setSaving(true); setError("");
    try { setSettings(await api.updateMemorySettings(accessToken, !settings.enabled)); window.dispatchEvent(new Event("abhiai:memory-changed")); }
    catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memory preference could not be updated.");
    } finally { setSaving(false); }
  }

  async function addMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !settings) return;
    setSaving(true); setError("");
    try {
      const memory = await api.createMemory(accessToken, content, category,scope,scope==="PROJECT"?projectKey:scope==="CONVERSATION"?conversationId:scope==="SESSION"?sessionId:"",preferenceKey);
      setSettings({ ...settings, memories: [memory, ...settings.memories.filter(item=>item.id!==memory.id)] });
      setDraft(""); window.dispatchEvent(new Event("abhiai:memory-changed"));
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memory could not be saved.");
    } finally { setSaving(false); }
  }

  async function editMemory(memory:UserMemory) {
    const text=window.prompt("Edit saved memory",memory.content);if(text===null)return;
    setSaving(true);setError("");
    try {const updated=await api.editMemory(accessToken,memory.id,text);setSettings(current=>current?{...current,memories:current.memories.map(m=>m.id===updated.id?updated:m)}:current);window.dispatchEvent(new Event("abhiai:memory-changed"));}
    catch(failure){setError(failure instanceof Error?failure.message:"Memory edit failed.");}finally{setSaving(false);}
  }
  async function removeMemory(id: string) {
    if (!settings || !window.confirm("Delete this saved memory?")) return;
    setSaving(true); setError("");
    try {
      await api.deleteMemory(accessToken, id);
      setSettings({ ...settings, memories: settings.memories.filter((memory) => memory.id !== id) }); window.dispatchEvent(new Event("abhiai:memory-changed"));
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memory could not be deleted.");
    } finally { setSaving(false); }
  }

  async function clearAll() {
    if (!settings || settings.memories.length === 0 || !window.confirm("Delete every saved memory? This cannot be undone.")) return;
    setSaving(true); setError("");
    try { await api.clearMemories(accessToken); setSettings({ ...settings, memories: [] }); window.dispatchEvent(new Event("abhiai:memory-changed")); }
    catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memories could not be cleared.");
    } finally { setSaving(false); }
  }

  return <section aria-labelledby={`${prefix}-memory-title`} className="workspace-view memory-workspace-view">
    <header className="workspace-header"><div><p className="eyebrow">AI privacy</p><h1 id={`${prefix}-memory-title`}>Memory & personalization</h1><p>You decide exactly what AbhiAI may remember across conversations.</p></div></header>
    <div className="workspace-content memory-workspace">
      {loading && <div aria-label="Loading memory settings" className="memory-loading" role="status"><i/><i/><i/></div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {settings && <>
        <section className="memory-control-card">
          <div><span className="memory-icon"><AppIcon name="ai"/></span><div><h2>Use saved memories in AI chats</h2><p>Off by default. When enabled, only the items listed below are added to relevant prompts. AbhiAI does not automatically create memories.</p></div></div>
          <Toggle checked={settings.enabled} disabled={saving} label="Use saved memories in AI chats" onCheckedChange={() => void toggleEnabled()} />
        </section>

        <form className="memory-create-card" onSubmit={(event) => void addMemory(event)}>
          <label htmlFor={`${prefix}-new-memory`}>Add something you want AbhiAI to remember</label>
          <label htmlFor={`${prefix}-memory-category`}>Category</label><SelectControl id={`${prefix}-memory-category`} value={category} onChange={event=>setCategory(event.target.value as MemoryCategory)}>{(["PREFERENCE","INTEREST","ASSISTANT_SETTING","PROJECT_CONTEXT"] as const).map(value=><option key={value} value={value}>{value.toLowerCase().replaceAll("_"," ")}</option>)}</SelectControl>
          <label>Scope<SelectControl value={scope} onChange={e=>setScope(e.target.value as UserMemory["scope"])}><option value="GLOBAL">Global</option><option value="PROJECT" disabled={!projectKey}>Project: {projectKey||"choose in assistant settings"}</option><option value="CONVERSATION" disabled={!conversationId}>This conversation</option><option value="SESSION" disabled={!sessionId}>This session (expires within 24 hours)</option></SelectControl></label>
          <label>Preference name (optional)<input maxLength={80} value={preferenceKey} onChange={e=>setPreferenceKey(e.target.value)} placeholder="For example: response length"/></label><p>Using the same preference name in the same scope replaces its older value.</p>
          <textarea id={`${prefix}-new-memory`} maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="For example: I prefer concise answers with practical examples." value={draft}/>
          <footer><span>{draft.length}/500 · Never save passwords, API keys, or highly sensitive information.</span><button disabled={saving || !draft.trim()} type="submit">Save memory</button></footer>
        </form>

        <section className="memory-list-card">
          <header><div><h2>Saved memories</h2><p>{settings.memories.length} of 50</p></div>{settings.memories.length > 0 && <button className="memory-clear" disabled={saving} onClick={() => void clearAll()} type="button">Clear all</button>}</header>
          {settings.memories.length === 0 ? <div className="memory-empty"><AppIcon name="bookmark"/><h3>No saved memories</h3><p>Nothing from your conversations is remembered automatically.</p></div> : <ul>{settings.memories.map((memory) => <li key={memory.id}><span><small>{(memory.category ?? "PREFERENCE").toLowerCase().replaceAll("_"," ")}</small><br/>{memory.scope && <small> · {memory.scope.toLowerCase()} {memory.scopeKey}</small>}<br/>{memory.content}</span><button type="button" disabled={saving} onClick={()=>void editMemory(memory)}>Edit</button><button aria-label={`Delete memory: ${memory.content}`} disabled={saving} onClick={() => void removeMemory(memory.id)} type="button">Delete</button></li>)}</ul>}
        </section>
      </>}
    </div>
  </section>;
}
