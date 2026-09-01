"use client";

import { useCallback } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { useSpeechRecognition } from "@/components/voice/use-speech-recognition";

type VoiceInputProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function VoiceInput({ disabled = false, onChange, value }: VoiceInputProps) {
  const update = useCallback((nextValue: string) => onChange(nextValue), [onChange]);
  const speech = useSpeechRecognition(update);

  return <div className={`voice-input${speech.listening ? " listening" : ""}`}>
    {speech.listening ? <div aria-live="polite" className="voice-listening" role="status">
      <span aria-hidden="true" className="voice-pulse"/>
      <strong>Listening</strong>
      <time>{durationLabel(speech.elapsedSeconds)}</time>
      <button aria-label="Stop voice input" onClick={speech.stop} type="button">Stop</button>
      <button aria-label="Cancel voice input" onClick={speech.cancel} type="button">Cancel</button>
    </div> : <button
      aria-label={speech.supported ? "Start voice input" : "Voice input availability"}
      className="voice-input-button"
      disabled={disabled}
      onClick={() => speech.start(value)}
      title={speech.supported ? "Speak your message" : "Check voice input support"}
      type="button"
    ><AppIcon name="microphone"/></button>}
    {speech.error && <span className="voice-input-error" role="alert">{speech.error}</span>}
  </div>;
}
