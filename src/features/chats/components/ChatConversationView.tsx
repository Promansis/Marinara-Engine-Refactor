import { ChevronUp, Image as ImageIcon, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "../../../shared/lib/utils";
import { useChatStore } from "../../../shared/stores/chat.store";
import { useUIStore } from "../../../shared/stores/ui.store";
import { useChat, useChatMessages, useDeleteMessage, useSetActiveSwipe, useUpdateMessage } from "../hooks/use-chats";
import type { Message } from "../types";
import { ConversationInput } from "./ConversationInput";
import { ConversationMessage } from "./ConversationMessage";
import { RoleplayConversationView } from "./RoleplayConversationView";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Chat data is waiting for the Rust chats backend slice.";
}

function parseMessageExtra(message: Message) {
  if (!message.extra) return {};
  if (typeof message.extra !== "string") return message.extra;
  try {
    const parsed = JSON.parse(message.extra) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function isHiddenFromUser(message: Message) {
  return parseMessageExtra(message).hiddenFromUser === true;
}

function getDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const messageStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((todayStart.getTime() - messageStart.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function buildItems(messages: Message[] | undefined) {
  if (!messages) return [];
  const items: Array<{ type: "separator"; key: string; label: string } | { type: "message"; key: string; message: Message; grouped: boolean; index: number }> = [];
  let lastDay = "";
  let visibleIndex = 0;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message || isHiddenFromUser(message)) continue;
    const day = getDayKey(message.createdAt);
    if (day !== lastDay) {
      items.push({ type: "separator", key: `sep-${day}`, label: formatDay(message.createdAt) });
      lastDay = day;
    }
    const previous = i > 0 ? messages[i - 1] : undefined;
    const grouped =
      !!previous &&
      !isHiddenFromUser(previous) &&
      previous.role === message.role &&
      previous.characterId === message.characterId &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;
    visibleIndex += 1;
    items.push({ type: "message", key: message.id, message, grouped, index: visibleIndex });
  }
  return items;
}

interface ChatConversationViewProps {
  activeChatId: string | null;
}

export function ChatConversationView({ activeChatId }: ChatConversationViewProps) {
  const chatQuery = useChat(activeChatId);
  const messagesQuery = useChatMessages(activeChatId);
  const updateMessage = useUpdateMessage(activeChatId);
  const deleteMessage = useDeleteMessage(activeChatId);
  const setActiveSwipe = useSetActiveSwipe(activeChatId);
  const convoGradient = useUIStore((s) => s.convoGradient);
  const theme = useUIStore((s) => s.theme);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = messagesQuery.data;
  const items = useMemo(() => buildItems(messages), [messages]);
  const chatName = chatQuery.data?.name ?? "selected chat";
  const activeChatMode = useChatStore((s) => s.activeChat?.id === activeChatId ? s.activeChat.mode : undefined);

  const gradientStyle = useMemo(() => {
    const g = convoGradient[theme];
    const isDefaultDark = convoGradient.dark.from === "#0a0a0e" && convoGradient.dark.to === "#1c2133";
    const isDefaultLight = convoGradient.light.from === "#f2eff7" && convoGradient.light.to === "#eae6f0";
    if ((theme === "dark" && isDefaultDark) || (theme === "light" && isDefaultLight)) {
      return { background: "var(--secondary)" };
    }
    return { background: `linear-gradient(135deg, ${g.from}, ${g.to})` };
  }, [convoGradient, theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  if (!activeChatId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div className="glass max-w-xl rounded-2xl p-6">
          <p className="text-sm font-medium text-[var(--foreground)]">Frontend shell migrated</p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
            Feature screens are intentionally deferred until their reviewed Phase 2 slices.
          </p>
        </div>
      </div>
    );
  }

  if ((chatQuery.data?.mode ?? activeChatMode) === "roleplay") {
    return <RoleplayConversationView activeChatId={activeChatId} />;
  }

  return (
    <section data-component="ChatConversationView" className="mari-chat-area relative flex flex-1 flex-col overflow-hidden" style={gradientStyle}>
      <div ref={scrollRef} data-chat-scroll className="mari-messages-scroll flex-1 overflow-y-auto overflow-x-hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2">
          <div className="rounded-lg bg-[var(--card)]/80 px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)]/90 backdrop-blur-sm dark:bg-black/30">
            {chatQuery.data?.name ?? "Chat"}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toast.error("Chat gallery is waiting for the imports/assets/gallery/media UI slice.")}
              className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30"
              title="Gallery"
            >
              <ImageIcon size="0.875rem" />
            </button>
            <button
              type="button"
              onClick={() => toast.error("Chat settings drawer is waiting for a later reviewed chat slice.")}
              className="flex items-center justify-center rounded-lg bg-[var(--card)]/80 p-1.5 text-foreground/80 backdrop-blur-sm transition-colors hover:bg-[var(--card)] hover:text-foreground dark:bg-black/30"
              title="Chat settings"
            >
              <Settings2 size="0.875rem" />
            </button>
          </div>
        </div>

        {(chatQuery.isLoading || messagesQuery.isLoading) && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)]/20 border-t-[var(--muted-foreground)]/60" />
          </div>
        )}

        {(chatQuery.error || messagesQuery.error) && (
          <div className="mx-auto mt-10 max-w-xl px-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 p-4 text-sm text-[var(--muted-foreground)] shadow-sm">
              <p className="font-medium text-[var(--foreground)]">Chat history unavailable</p>
              <p className="mt-1 text-xs leading-relaxed">{errorMessage(messagesQuery.error ?? chatQuery.error)}</p>
            </div>
          </div>
        )}

        {!messagesQuery.isLoading && !messagesQuery.error && messages && messages.length === 0 && (
          <div className="px-4 pt-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              This is the start of your conversation with <span className="font-medium text-[var(--foreground)]">{chatName}</span>.
            </p>
          </div>
        )}

        {items.map((item) => {
          if (item.type === "separator") {
            return (
              <div key={item.key} className="relative my-4 flex items-center px-4">
                <div className="flex-1 border-t border-[var(--border)]/40" />
                <span className="mx-4 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">{item.label}</span>
                <div className="flex-1 border-t border-[var(--border)]/40" />
              </div>
            );
          }
          return (
            <ConversationMessage
              key={item.key}
              message={item.message}
              isGrouped={item.grouped}
              messageIndex={item.index}
              onDelete={(messageId) =>
                deleteMessage.mutate(messageId, {
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              onEdit={(messageId, content) =>
                updateMessage.mutate(
                  { messageId, content },
                  {
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
              onRegenerate={() => toast.error("Regeneration is waiting for the Rust generation backend slice.")}
              onSetActiveSwipe={(messageId, index) =>
                setActiveSwipe.mutate(
                  { messageId, index },
                  {
                    onError: (error) => toast.error(errorMessage(error)),
                  },
                )
              }
            />
          );
        })}

        {items.length > 0 && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className={cn(
              "mx-auto my-4 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]",
              "transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <ChevronUp size="0.75rem" />
            Top
          </button>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ConversationInput chatId={activeChatId} chatName={chatQuery.data?.name} />
    </section>
  );
}
