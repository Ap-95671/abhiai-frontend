export type AssistantCharacterState = "idle" | "listening" | "thinking" | "speaking" | "error";
export type VoiceConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "expired";
export type CharacterEvent = "listen" | "think" | "speak" | "settle" | "fail";

export function transition(state: AssistantCharacterState, event: CharacterEvent): AssistantCharacterState {
  if (event === "fail") return "error";
  if (event === "settle") return "idle";
  if (event === "listen") return "listening";
  if (event === "think") return "thinking";
  if (event === "speak" && state !== "error") return "speaking";
  return state;
}

export const characterLabels: Record<AssistantCharacterState, string> = {
  idle: "Ready when you are", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…", error: "Let’s try again",
};

export type AssistantMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  final: boolean;
  interrupted?: boolean;
};

export function upsertMessage(messages: AssistantMessage[], message: AssistantMessage): AssistantMessage[] {
  const index = messages.findIndex(item => item.id === message.id);
  if (index < 0) return [...messages, message];
  return messages.map((item, i) => i === index ? message : item);
}

/** Keep the same recent, bounded chronological history when entering realtime. */
export function realtimeHistory(messages: AssistantMessage[]) {
  const selected: AssistantMessage[] = [];
  let characters = 0;
  for (const message of [...messages].reverse()) {
    if (!message.content || !message.final) continue;
    if (selected.length >= 40 || characters + message.content.length > 60000) break;
    selected.unshift(message);
    characters += message.content.length;
  }
  return selected.map(message => ({
    role: message.role === "USER" ? "user" : "model",
    parts: [{ text: message.content }],
  }));
}
