import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/chats-api";
import type { Chat, ChatMode, Message } from "../types";

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string | null) => [...chatKeys.all, "detail", id] as const,
  messages: (id: string | null) => [...chatKeys.all, "messages", id] as const,
};

export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get<Chat[]>("/chats"),
    retry: false,
  });
}

export function useChat(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.detail(chatId),
    queryFn: () => api.get<Chat>(`/chats/${chatId}`),
    enabled: !!chatId,
    retry: false,
  });
}

export function useChatMessages(chatId: string | null) {
  return useQuery({
    queryKey: chatKeys.messages(chatId),
    queryFn: () => api.get<Message[]>(`/chats/${chatId}/messages`),
    enabled: !!chatId,
    retry: false,
  });
}

export function useCreateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: "user" | "assistant" | "system" | "narrator"; content: string; characterId?: string | null }) =>
      api.post<Message>(`/chats/${chatId}/messages`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
  });
}

export function useUpdateMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      api.patch<Message>(`/chats/${chatId}/messages/${messageId}`, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
  });
}

export function useDeleteMessage(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.delete(`/chats/${chatId}/messages/${messageId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
  });
}

export function useSetActiveSwipe(chatId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api.patch<Message>(`/chats/${chatId}/messages/${messageId}/swipe`, { activeSwipeIndex: index }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
  });
}

export function useUpdateChatMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...metadata }: { id: string } & Record<string, unknown>) =>
      api.patch<Chat>(`/chats/${id}/metadata`, metadata),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: chatKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; mode: ChatMode; characterIds?: string[] }) => api.post<Chat>("/chats", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/chats/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}

export function useDeleteChatGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api.delete(`/chats/group/${groupId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.list() }),
  });
}
