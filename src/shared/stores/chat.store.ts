import { create } from "zustand";

const ACTIVE_CHAT_STORAGE_KEY = "marinara-active-chat-id";

interface ActiveChatSnapshot {
  id: string;
  characterIds?: string | string[] | null;
  mode?: string;
}

interface ChatStore {
  activeChatId: string | null;
  activeChat: ActiveChatSnapshot | null;
  currentInput: string;
  inputDrafts: Map<string, string>;
  isStreaming: boolean;
  streamingChatId: string | null;
  streamBuffer: string;
  unreadCounts: Map<string, number>;
  setActiveChatId: (id: string | null) => void;
  setActiveChatSnapshot: (chat: ActiveChatSnapshot | null) => void;
  setCurrentInput: (value: string) => void;
  setInputDraft: (chatId: string, value: string) => void;
  clearInputDraft: (chatId: string) => void;
  clearUnread: (chatId: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeChatId: (() => {
    try {
      return localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  })(),
  activeChat: null,
  currentInput: "",
  inputDrafts: new Map(),
  isStreaming: false,
  streamingChatId: null,
  streamBuffer: "",
  unreadCounts: new Map(),
  setActiveChatId: (id) => {
    set((state) => {
      const unreadCounts = new Map(state.unreadCounts);
      if (id) unreadCounts.delete(id);
      return { activeChatId: id, unreadCounts, ...(!id ? { activeChat: null } : {}) };
    });
    try {
      if (id) localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, id);
      else localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
  setActiveChatSnapshot: (chat) =>
    set((state) => ({
      activeChat: chat,
      activeChatId: chat?.id ?? state.activeChatId,
    })),
  setCurrentInput: (value) => set({ currentInput: value }),
  setInputDraft: (chatId, value) =>
    set((state) => {
      const inputDrafts = new Map(state.inputDrafts);
      inputDrafts.set(chatId, value);
      return { inputDrafts };
    }),
  clearInputDraft: (chatId) =>
    set((state) => {
      if (!state.inputDrafts.has(chatId)) return state;
      const inputDrafts = new Map(state.inputDrafts);
      inputDrafts.delete(chatId);
      return { inputDrafts };
    }),
  clearUnread: (chatId) =>
    set((state) => {
      if (!state.unreadCounts.has(chatId)) return state;
      const unreadCounts = new Map(state.unreadCounts);
      unreadCounts.delete(chatId);
      return { unreadCounts };
    }),
  reset: () => {
    set({
      activeChatId: null,
      activeChat: null,
      currentInput: "",
      inputDrafts: new Map(),
      isStreaming: false,
      streamingChatId: null,
      streamBuffer: "",
      unreadCounts: new Map(),
    });
    try {
      localStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
}));
