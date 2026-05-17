import {
  ArrowRightLeft,
  BookOpen,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Loader2,
  MapPin,
  PenLine,
  ScrollText,
  Settings2,
  Sparkles,
  Swords,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { cn } from "../../../shared/lib/utils";
import { useChatStore } from "../../../shared/stores/chat.store";
import { useUIStore } from "../../../shared/stores/ui.store";
import { useChat, useChatMessages, useDeleteMessage, useSetActiveSwipe, useUpdateMessage } from "../hooks/use-chats";
import type { ChatMetadata, Message } from "../types";
import { ConversationInput } from "./ConversationInput";
import { ConversationMessage } from "./ConversationMessage";
import { CyoaChoices } from "./CyoaChoices";
import { EndSceneBar, RoleplaySceneBanner, deferredSceneAction } from "./RoleplaySceneBanner";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Roleplay data is waiting for the Rust chats backend slice.";
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

function toStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRoleplayBackground(metadata: ChatMetadata | null | undefined, fallback: string | null) {
  return (
    toStringValue(metadata?.backgroundUrl) ??
    toStringValue(metadata?.chatBackground) ??
    toStringValue(metadata?.roleplayBackground) ??
    fallback
  );
}

function metadataFlag(metadata: ChatMetadata | null | undefined, key: string) {
  return metadata?.[key] === true || metadata?.[key] === "true";
}

function RoleplayToolbar({
  chatId,
  metadata,
  linkedChatId,
}: {
  chatId: string;
  metadata: ChatMetadata | null | undefined;
  linkedChatId?: string | null;
}) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const actions = [
    {
      title: "Summary",
      icon: ScrollText,
      active: !!toStringValue(metadata?.summary),
      onClick: () => toast.error("Summary editing is waiting for the Rust conversation/roleplay backend slice."),
    },
    {
      title: "World info",
      icon: Globe,
      active: metadataFlag(metadata, "hasActiveLorebookEntries"),
      onClick: () => toast.error("Active lorebook inspection is waiting for the Rust lorebooks backend slice."),
    },
    {
      title: "Author's notes",
      icon: PenLine,
      active: !!toStringValue(metadata?.authorNotes),
      onClick: () => toast.error("Author's notes persistence is waiting for the Rust chats backend slice."),
    },
    {
      title: "Files",
      icon: FolderOpen,
      active: false,
      onClick: () => toast.error("Chat files are waiting for the imports/assets/gallery/media UI slice."),
    },
    {
      title: "Gallery",
      icon: ImageIcon,
      active: false,
      onClick: () => toast.error("Chat gallery is waiting for the imports/assets/gallery/media UI slice."),
    },
    {
      title: "Settings",
      icon: Settings2,
      active: false,
      onClick: () => toast.error("Chat settings drawer is waiting for a later reviewed chat slice."),
    },
  ];

  return (
    <div className="pointer-events-auto flex min-w-0 items-center gap-1.5">
      {metadataFlag(metadata, "enableAgents") && (
        <button
          type="button"
          onClick={() => toast.error("Roleplay agents are waiting for the agents/tools UI and Rust agent backend slices.")}
          className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-md transition-colors hover:bg-foreground/10 hover:text-foreground"
          title="Agents"
        >
          <Sparkles size="0.875rem" />
          <span className="hidden sm:inline">Agents</span>
        </button>
      )}
      {actions.map(({ title, icon: Icon, active, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
            active
              ? "border-foreground/25 bg-foreground/10 text-foreground"
              : "border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
          )}
          title={title}
        >
          <Icon size="0.875rem" />
        </button>
      ))}
      {linkedChatId && (
        <button
          type="button"
          onClick={() => setActiveChatId(linkedChatId)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 text-foreground/60 backdrop-blur-md transition-colors hover:bg-foreground/10 hover:text-foreground"
          title="Connected chat"
        >
          <ArrowRightLeft size="0.875rem" />
        </button>
      )}
      <span className="sr-only">Roleplay toolbar for {chatId}</span>
    </div>
  );
}

function RoleplayHudStrip({ metadata }: { metadata: ChatMetadata | null | undefined }) {
  const rows = [
    { label: "Location", value: toStringValue(metadata?.location), icon: MapPin },
    { label: "Time", value: toStringValue(metadata?.time), icon: BookOpen },
    { label: "Weather", value: toStringValue(metadata?.weather), icon: Globe },
  ].filter((row) => row.value);

  if (rows.length === 0 && !metadataFlag(metadata, "enableAgents")) return null;

  return (
    <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 overflow-x-auto px-1">
      {rows.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-black/25 px-2.5 py-1 text-[0.6875rem] text-foreground/75 backdrop-blur-md"
          title={`${label}: ${value}`}
        >
          <Icon size="0.75rem" />
          <span className="max-w-32 truncate">{value}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyRoleplayState({ chatName }: { chatName: string }) {
  return (
    <div className="mx-auto mt-10 max-w-xl px-4">
      <div className="rounded-xl border border-foreground/10 bg-[var(--card)]/75 p-4 text-sm text-[var(--muted-foreground)] shadow-lg backdrop-blur">
        <p className="font-medium text-[var(--foreground)]">Roleplay ready</p>
        <p className="mt-1 text-xs leading-relaxed">
          This is the start of your roleplay with <span className="font-medium text-[var(--foreground)]">{chatName}</span>.
        </p>
      </div>
    </div>
  );
}

interface RoleplayConversationViewProps {
  activeChatId: string;
}

export function RoleplayConversationView({ activeChatId }: RoleplayConversationViewProps) {
  const chatQuery = useChat(activeChatId);
  const messagesQuery = useChatMessages(activeChatId);
  const updateMessage = useUpdateMessage(activeChatId);
  const deleteMessage = useDeleteMessage(activeChatId);
  const setActiveSwipe = useSetActiveSwipe(activeChatId);
  const globalBackground = useUIStore((s) => s.chatBackground);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const centerCompact = useUIStore((s) => s.centerCompact);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = messagesQuery.data;
  const metadata = chatQuery.data?.metadata;
  const chatName = chatQuery.data?.name ?? "selected roleplay";
  const backgroundUrl = getRoleplayBackground(metadata, globalBackground);
  const visibleMessages = useMemo(() => (messages ?? []).filter((message) => !isHiddenFromUser(message)), [messages]);
  const sceneStatus = toStringValue(metadata?.sceneStatus);
  const sceneOriginChatId = toStringValue(metadata?.sceneOriginChatId);
  const activeSceneChatId = toStringValue(metadata?.activeSceneChatId);
  const activeSceneChatName = toStringValue(metadata?.activeSceneChatName);
  const sceneDescription = toStringValue(metadata?.sceneDescription);
  const linkedChatId = toStringValue(metadata?.connectedChatId);
  const weatherLabel = toStringValue(metadata?.weather);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length]);

  return (
    <section data-component="RoleplayConversationView" className="rpg-chat-area relative flex flex-1 flex-col overflow-hidden">
      {backgroundUrl && (
        <div
          className="mari-background absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        />
      )}
      <div className="rpg-overlay absolute inset-0" />
      <div className="rpg-vignette pointer-events-none absolute inset-0" />
      {weatherEffects && weatherLabel && (
        <div className="pointer-events-none absolute right-4 top-16 z-10 rounded-full border border-foreground/10 bg-black/20 px-3 py-1 text-xs text-white/70 backdrop-blur-md">
          {weatherLabel}
        </div>
      )}

      <div className="pointer-events-none relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <RoleplayHudStrip metadata={metadata} />
        <RoleplayToolbar chatId={activeChatId} metadata={metadata} linkedChatId={linkedChatId} />
      </div>

      <div className="relative z-10 flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          data-chat-scroll
          className={cn(
            "rpg-chat-messages-mobile mari-messages-scroll relative h-full overflow-y-auto overflow-x-hidden pb-1 pt-4",
            centerCompact ? "px-3" : "px-3 md:px-[15%]",
          )}
        >
          {(chatQuery.isLoading || messagesQuery.isLoading) && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="animate-spin text-foreground/60" size="2rem" />
            </div>
          )}

          {(chatQuery.error || messagesQuery.error) && (
            <div className="mx-auto mt-10 max-w-xl px-4">
              <div className="rounded-xl border border-foreground/10 bg-[var(--card)]/80 p-4 text-sm text-[var(--muted-foreground)] shadow-lg backdrop-blur">
                <p className="font-medium text-[var(--foreground)]">Roleplay history unavailable</p>
                <p className="mt-1 text-xs leading-relaxed">{errorMessage(messagesQuery.error ?? chatQuery.error)}</p>
              </div>
            </div>
          )}

          {sceneStatus === "active" && activeSceneChatId && (
            <RoleplaySceneBanner
              variant="origin"
              sceneChatId={activeSceneChatId}
              sceneChatName={activeSceneChatName ?? undefined}
            />
          )}
          {sceneStatus === "scene" && (
            <RoleplaySceneBanner
              variant="scene"
              sceneChatId={activeChatId}
              originChatId={sceneOriginChatId ?? undefined}
              description={sceneDescription ?? undefined}
            />
          )}

          {!messagesQuery.isLoading && !messagesQuery.error && visibleMessages.length === 0 && (
            <EmptyRoleplayState chatName={chatName} />
          )}

          {visibleMessages.map((message, index) => (
            <div
              key={message.id}
              className="animate-message-in"
              style={{ animationDelay: `${Math.min(index * 30, 200)}ms`, animationFillMode: "backwards" }}
            >
              <ConversationMessage
                message={message}
                isGrouped={false}
                messageIndex={index + 1}
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
                onSetActiveSwipe={(messageId, swipeIndex) =>
                  setActiveSwipe.mutate(
                    { messageId, index: swipeIndex },
                    {
                      onError: (error) => toast.error(errorMessage(error)),
                    },
                  )
                }
              />
            </div>
          ))}

          <CyoaChoices messages={messages} />

          {metadataFlag(metadata, "combatAgentEnabled") && (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={() => toast.error("Encounters are waiting for the game/agents backend slices.")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs text-foreground/60 transition-all hover:bg-foreground/10 hover:text-orange-300"
                title="Start combat encounter"
              >
                <Swords size="0.875rem" />
                Encounter
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="relative z-20">
        {sceneStatus === "scene" && (
          <EndSceneBar
            sceneChatId={activeChatId}
            originChatId={sceneOriginChatId ?? undefined}
            onConclude={() => deferredSceneAction("End scene")}
            onAbandon={() => deferredSceneAction("Discard scene")}
            onFork={() => deferredSceneAction("Convert scene")}
          />
        )}
        <ConversationInput chatId={activeChatId} chatName={chatQuery.data?.name} />
      </div>
    </section>
  );
}
