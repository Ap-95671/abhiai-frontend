"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAbhiAIContext } from "./abhiai-context";
import { CharacterAvatar } from "./character-avatar";
import styles from "./assistant.module.css";

const Panel = dynamic(() => import("./ai-character-panel"), { ssr: false, loading: () => <span className={styles.loading} role="status">Opening AbhiAI Assistant…</span> });

export function AiCharacterLauncher({ token, userId, obstructed }: { token: string; userId: string; obstructed: boolean }) {
  const [config, setConfig] = useState<{ enabled: boolean; voiceAvailable: boolean }>();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const setAssistantOpen = useAbhiAIContext()?.setAssistantOpen;
  useEffect(() => { setAssistantOpen?.(open); }, [open,setAssistantOpen]);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const show = () => { setLoaded(true); setOpen(true); };
    window.addEventListener("abhiai:open-assistant", show);
    return () => window.removeEventListener("abhiai:open-assistant", show);
  }, []);
  useEffect(() => {
    let active = true;
    void api.assistantConfig(token).then(value => { if (active) setConfig(value); }).catch(() => {});
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (!config?.enabled) return;
    // Find a clear slot above composers, toast notifications and other interactive controls.
    const position = () => {
      const launcher = button.current;
      if (!launcher) return;
      let bottom = 20;
      document.querySelectorAll(".composer, .app-toast, .dm-composer, .group-composer").forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width && rect.height && rect.bottom > innerHeight * 0.6) bottom = Math.max(bottom, innerHeight - rect.top + 12);
      });
      launcher.style.bottom = `max(${Math.min(bottom, innerHeight - 80)}px, calc(16px + env(safe-area-inset-bottom)))`;
    };
    const observer = new ResizeObserver(position);
    observer.observe(document.body);
    const mutations = new MutationObserver(position);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", position); position();
    return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", position); };
  }, [config?.enabled]);
  if (!config?.enabled) return null;
  return <>
    <button ref={button} className={styles.launcher} hidden={open || obstructed} type="button" title="Talk to AbhiAI"
      aria-label="Talk to AbhiAI" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setLoaded(true); setOpen(true); }}>
      <CharacterAvatar state="idle" small /><span>Talk to AbhiAI</span>
    </button>
    {loaded && <Panel token={token} userId={userId} open={open} voiceAvailable={config.voiceAvailable} onDismiss={() => { setOpen(false); requestAnimationFrame(() => button.current?.focus()); }} />}
  </>;
}
