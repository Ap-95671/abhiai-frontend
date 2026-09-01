"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & { error: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function appendTranscript(base: string, transcript: string) {
  const normalized = transcript.trim();
  if (!normalized) return base;
  if (!base.trim()) return normalized;
  return `${base.trimEnd()} ${normalized}`;
}

function friendlyError(code: string) {
  if (code === "not-allowed" || code === "service-not-allowed") return "Microphone permission was denied. Allow microphone access and try again.";
  if (code === "audio-capture") return "No working microphone was found.";
  if (code === "no-speech") return "No speech was detected. Try speaking a little closer to the microphone.";
  if (code === "network") return "Speech recognition could not reach its transcription service.";
  if (code === "aborted") return "";
  return "Voice input could not be completed. Please try again.";
}

export function useSpeechRecognition(onChange: (value: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const originalValueRef = useRef("");
  const committedRef = useRef("");
  const cancelRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)));
    return () => recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!listening) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setElapsedSeconds(0);
    setError("");
    onChange(originalValueRef.current);
  }, [onChange]);

  const start = useCallback((currentValue: string) => {
    if (listening) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported by this browser. You can still type your message.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    originalValueRef.current = currentValue;
    committedRef.current = "";
    cancelRef.current = false;
    setError("");

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) committedRef.current = appendTranscript(committedRef.current, text);
        else interim = appendTranscript(interim, text);
      }
      onChange(appendTranscript(originalValueRef.current, appendTranscript(committedRef.current, interim)));
    };
    recognition.onerror = (event) => {
      const message = friendlyError(event.error);
      if (message) setError(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setElapsedSeconds(0);
      if (!cancelRef.current && committedRef.current.trim()) {
        onChange(appendTranscript(originalValueRef.current, committedRef.current));
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("Voice input could not start. Please try again.");
    }
  }, [listening, onChange]);

  return { cancel, elapsedSeconds, error, listening, start, stop, supported };
}
