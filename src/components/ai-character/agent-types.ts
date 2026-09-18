import type { AssistantToolResult } from "./tool-types";
import type { AbhiAIPageContext } from "./context-types";
export type AssistantSettings = { mode: "STANDARD" | "FRIENDLY" | "TUTOR" | "PROFESSIONAL" | "CREATIVE"; pageContext: boolean; agentActions: boolean; proactive: boolean; projectKey: string; fallbackAllowed: boolean };
export type AgentTask = {
  id: string; conversationId: string; goal: string; status: "READY" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "WAITING_CONFIRMATION";
  createdAt: string; updatedAt: string; stepsUsed: number; toolCalls: number; retries: number;
  state: { plan: string[]; steps: { id: string; description: string; tool: string; arguments: Record<string,string>; status: string; result: AssistantToolResult | null }[];
    context: AbhiAIPageContext | null; projectKey: string; sessionId: string; result: string; notice: string;
    pending: { id: string; actionType: string; label: string; exactPayload: string; payloadHash: string; expiresAt: string; status: string } | null };
};
