"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { api, ApiError, MemorySettings } from "@/lib/api";

export function MemoryPanel({ accessToken, onUnauthorized }: { accessToken: string; onUnauthorized: () => void }) {
  const [settings, setSettings] = useState<MemorySettings | null>(null);
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
    try { setSettings(await api.updateMemorySettings(accessToken, !settings.enabled)); }
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
      const memory = await api.createMemory(accessToken, content);
      setSettings({ ...settings, memories: [memory, ...settings.memories] });
      setDraft("");
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memory could not be saved.");
    } finally { setSaving(false); }
  }

  async function removeMemory(id: string) {
    if (!settings) return;
    setSaving(true); setError("");
    try {
      await api.deleteMemory(accessToken, id);
      setSettings({ ...settings, memories: settings.memories.filter((memory) => memory.id !== id) });
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memory could not be deleted.");
    } finally { setSaving(false); }
  }

  async function clearAll() {
    if (!settings || settings.memories.length === 0 || !window.confirm("Delete every saved memory? This cannot be undone.")) return;
    setSaving(true); setError("");
    try { await api.clearMemories(accessToken); setSettings({ ...settings, memories: [] }); }
    catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized();
      setError(saveError instanceof Error ? saveError.message : "Memories could not be cleared.");
    } finally { setSaving(false); }
  }

  return <section aria-labelledby="memory-title" className="workspace-view memory-workspace-view">
    <header className="workspace-header"><div><p className="eyebrow">AI privacy</p><h1 id="memory-title">Memory & personalization</h1><p>You decide exactly what AbhiAI may remember across conversations.</p></div></header>
    <div className="workspace-content memory-workspace">
      {loading && <div aria-label="Loading memory settings" className="memory-loading" role="status"><i/><i/><i/></div>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {settings && <>
        <section className="memory-control-card">
          <div><span className="memory-icon"><AppIcon name="ai"/></span><div><h2>Use saved memories in AI chats</h2><p>Off by default. When enabled, only the items listed below are added to relevant prompts. AbhiAI does not automatically create memories.</p></div></div>
          <button aria-checked={settings.enabled} className={settings.enabled ? "memory-toggle enabled" : "memory-toggle"} disabled={saving} onClick={() => void toggleEnabled()} role="switch" type="button"><span/>{settings.enabled ? "On" : "Off"}</button>
        </section>

        <form className="memory-create-card" onSubmit={(event) => void addMemory(event)}>
          <label htmlFor="new-memory">Add something you want AbhiAI to remember</label>
          <textarea id="new-memory" maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="For example: I prefer concise answers with practical examples." value={draft}/>
          <footer><span>{draft.length}/500 · Never save passwords, API keys, or highly sensitive information.</span><button disabled={saving || !draft.trim()} type="submit">Save memory</button></footer>
        </form>

        <section className="memory-list-card">
          <header><div><h2>Saved memories</h2><p>{settings.memories.length} of 50</p></div>{settings.memories.length > 0 && <button className="memory-clear" disabled={saving} onClick={() => void clearAll()} type="button">Clear all</button>}</header>
          {settings.memories.length === 0 ? <div className="memory-empty"><AppIcon name="bookmark"/><h3>No saved memories</h3><p>Nothing from your conversations is remembered automatically.</p></div> : <ul>{settings.memories.map((memory) => <li key={memory.id}><span>{memory.content}</span><button aria-label={`Delete memory: ${memory.content}`} disabled={saving} onClick={() => void removeMemory(memory.id)} type="button">Delete</button></li>)}</ul>}
        </section>
      </>}
    </div>
  </section>;
}
