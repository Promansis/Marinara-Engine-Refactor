export type MariMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type MariEntryRequest = {
  userMessage: string;
  messages: MariMessage[];
  context?: Record<string, unknown>;
};

export type MariEntryResponse = {
  content: string;
  received: {
    userMessage: string;
    messageCount: number;
    contextKeys: string[];
    createdAt: string;
  };
};

export function runProfessorMariEntry(input: MariEntryRequest): MariEntryResponse {
  const userMessage = input.userMessage.trim();
  return {
    content: userMessage,
    received: {
      userMessage,
      messageCount: input.messages.length,
      contextKeys: Object.keys(input.context ?? {}),
      createdAt: new Date().toISOString(),
    },
  };
}
