"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechPlaybackStatus = "idle" | "playing" | "paused";

export type SpeechPlaybackController = {
  activeMessageId: string | null;
  play(messageId: string, text: string): void;
  status: SpeechPlaybackStatus;
  stop(): void;
  supported: boolean;
  toggle(): void;
};

function textForSpeech(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " Code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\$\$([\s\S]*?)\$\$/g, " Mathematical expression. ")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeechPlayback(): SpeechPlaybackController {
  const [supported, setSupported] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeechPlaybackStatus>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const reset = useCallback(() => {
    utteranceRef.current = null;
    setActiveMessageId(null);
    setStatus("idle");
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    reset();
  }, [reset]);

  useEffect(() => {
    queueMicrotask(() => setSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window));
    return () => window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback((messageId: string, text: string) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    window.speechSynthesis.cancel();
    const speakable = textForSpeech(text);
    if (!speakable) return;
    const utterance = new SpeechSynthesisUtterance(speakable);
    utterance.lang = navigator.language || "en-US";
    utterance.rate = 1;
    const finish = () => {
      if (utteranceRef.current === utterance) reset();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    utteranceRef.current = utterance;
    setActiveMessageId(messageId);
    setStatus("playing");
    window.speechSynthesis.speak(utterance);
  }, [reset]);

  const toggle = useCallback(() => {
    if (!utteranceRef.current) return;
    if (status === "playing") {
      window.speechSynthesis.pause();
      setStatus("paused");
    } else if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
    }
  }, [status]);

  return { activeMessageId, play, status, stop, supported, toggle };
}
