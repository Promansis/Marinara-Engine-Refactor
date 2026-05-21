import type { LlmChunk, LlmRequest } from "../../engine/capabilities/llm";
import { useUIStore } from "../stores/ui.store";

type LlmDebugKind = "complete" | "stream";

function isDebugModeEnabled(): boolean {
  try {
    return useUIStore.getState().debugMode === true;
  } catch {
    return false;
  }
}

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValue);
  if (!value || typeof value !== "object") return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/(token|secret|password|api[_-]?key|authorization|cookie|credential)/i.test(key)) {
      redacted[key] = "[REDACTED]";
      continue;
    }
    redacted[key] = redactSensitiveValue(entry);
  }
  return redacted;
}

function logDebugGroup(label: string, payload: Record<string, unknown>) {
  if (!isDebugModeEnabled()) return;
  console.groupCollapsed(label);
  console.log(redactSensitiveValue(payload));
  console.groupEnd();
}

export function logLlmRequest(kind: LlmDebugKind, request: LlmRequest) {
  logDebugGroup(`[Marinara debug] LLM ${kind} request`, { request });
}

export function logLlmCompleteResponse(response: string) {
  logDebugGroup("[Marinara debug] LLM complete response", { response });
}

export function logLlmStreamResponse(chunks: LlmChunk[], content: string, error?: unknown) {
  logDebugGroup("[Marinara debug] LLM stream response", {
    content,
    chunks,
    ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
  });
}
