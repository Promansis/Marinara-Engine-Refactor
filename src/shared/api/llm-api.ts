import type { LlmChunk, LlmGateway, LlmRequest } from "../../engine/capabilities";
import { invokeTauri } from "./tauri-client";

export const llmApi: LlmGateway = {
  complete: (request: LlmRequest) =>
    invokeTauri("api_request", {
      method: "POST",
      path: "/llm/complete",
      body: request,
    }),
  stream: async function* (request: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmChunk> {
    const events = await invokeTauri<LlmChunk[]>("api_stream_events", {
      path: "/llm/stream",
      body: request,
    });
    for (const event of events) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const text = typeof event.text === "string" ? event.text : typeof event.data === "string" ? event.data : undefined;
      yield text === undefined ? event : { ...event, text };
    }
  },
  listModels: (connectionId?: string | null) =>
    invokeTauri("api_request", {
      method: "GET",
      path: `/llm/models${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`,
      body: null,
    }),
};
