import {
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Circle,
  FolderOpen,
  GitBranch,
  MessageSquare,
  MinusCircle,
  Moon,
  Plus,
  Search,
  Tag,
  Theater,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCharacters } from "../../features/characters/hooks/use-characters";
import { useChatFolders } from "../../features/chats/hooks/use-chat-folders";
import { useChats } from "../../features/chats/hooks/use-chats";
import type { Chat, ChatFolder, ChatMode } from "../../features/chats/types";
import { cn, getAvatarCropStyle } from "../../shared/lib/utils";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore, type UserStatus } from "../../shared/stores/ui.store";

type ChatSortOption = "newest" | "oldest" | "name-asc" | "name-desc";
type SidebarMode = Exclude<ChatMode, "visual_novel">;

const MODE_TABS: Array<{
  id: SidebarMode;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
}> = [
  { id: "conversation", label: "Conversation", shortLabel: "CONVO", icon: MessageSquare },
  { id: "roleplay", label: "Roleplay", shortLabel: "RP", icon: BookOpen },
  { id: "game", label: "Game", shortLabel: "GM", icon: Theater },
];

const SORT_LABELS: Record<ChatSortOption, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "name-asc": "A-Z",
  "name-desc": "Z-A",
};

function getChatTags(chat: Pick<Chat, "metadata">): string[] {
  return Array.isArray(chat.metadata?.tags)
    ? chat.metadata.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
}

function normalizeChatCharacterIds(value: unknown): string[] {
  const parsed = (() => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value.trim() ? [value] : [];
    }
  })();

  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    : [];
}

function toSearchText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function formatChatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Chat data is waiting for the Rust chats backend slice.";
}

export function ChatSidebar() {
  const { data: chats, error: chatsError, isFetching, isLoading, refetch } = useChats();
  const { data: folders } = useChatFolders();
  const { data: characters } = useCharacters();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const setActiveChatSnapshot = useChatStore((s) => s.setActiveChatSnapshot);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarMode>("conversation");
  const [sort, setSort] = useState<ChatSortOption>("newest");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const characterLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        avatarUrl: string | null;
        avatarCrop?: { zoom: number; offsetX: number; offsetY: number } | null;
        conversationStatus?: string;
      }
    >();

    for (const character of (characters ?? []) as Array<{ id: string; data?: unknown; avatarPath?: string | null }>) {
      const record = (() => {
        if (typeof character.data === "string") {
          try {
            return JSON.parse(character.data) as Record<string, unknown>;
          } catch {
            return {};
          }
        }
        return character.data && typeof character.data === "object" ? (character.data as Record<string, unknown>) : {};
      })();
      const extensions =
        record.extensions && typeof record.extensions === "object" ? (record.extensions as Record<string, unknown>) : {};
      map.set(character.id, {
        name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Unknown",
        avatarUrl: character.avatarPath ?? null,
        avatarCrop:
          extensions.avatarCrop && typeof extensions.avatarCrop === "object"
            ? (extensions.avatarCrop as { zoom: number; offsetX: number; offsetY: number })
            : null,
        conversationStatus:
          typeof extensions.conversationStatus === "string" ? extensions.conversationStatus : undefined,
      });
    }

    return map;
  }, [characters]);

  const modeChats = useMemo(
    () => (chats ?? []).filter((chat) => chat.mode === activeTab && !(chat.mode === "conversation" && chat.metadata?.gameId)),
    [activeTab, chats],
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const chat of modeChats) {
      for (const tag of getChatTags(chat)) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [modeChats]);

  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) setActiveTag(null);
  }, [activeTag, allTags]);

  useEffect(() => {
    const activeChat = chats?.find((chat) => chat.id === activeChatId);
    if (activeChat?.mode === "conversation" || activeChat?.mode === "roleplay" || activeChat?.mode === "game") {
      setActiveTab(activeChat.mode);
    }
  }, [activeChatId, chats]);

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = modeChats.filter((chat) => {
      const tags = getChatTags(chat);
      if (activeTag && !tags.includes(activeTag)) return false;
      if (!query) return true;
      const characterNames = normalizeChatCharacterIds(chat.characterIds)
        .map((characterId) => characterLookup.get(characterId)?.name ?? "")
        .filter(Boolean);
      return (
        toSearchText(chat.name).toLowerCase().includes(query) ||
        tags.some((tag) => tag.toLowerCase().includes(query)) ||
        characterNames.some((name) => name.toLowerCase().includes(query))
      );
    });

    return sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "name-asc":
          return toSearchText(a.name).localeCompare(toSearchText(b.name));
        case "name-desc":
          return toSearchText(b.name).localeCompare(toSearchText(a.name));
        case "newest":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [activeTag, characterLookup, modeChats, searchQuery, sort]);

  const displayChats = useMemo(() => {
    const totalGroupSizes = new Map<string, number>();
    for (const chat of chats ?? []) {
      if (chat.groupId) totalGroupSizes.set(chat.groupId, (totalGroupSizes.get(chat.groupId) ?? 0) + 1);
    }

    const seenGroups = new Set<string>();
    const entries: Array<{ chat: Chat; branchCount: number }> = [];
    for (const chat of filteredChats) {
      if (chat.groupId) {
        if (seenGroups.has(chat.groupId)) continue;
        seenGroups.add(chat.groupId);
        entries.push({ chat, branchCount: totalGroupSizes.get(chat.groupId) ?? 1 });
      } else {
        entries.push({ chat, branchCount: 1 });
      }
    }
    return entries;
  }, [chats, filteredChats]);

  const modeFolders = useMemo(
    () => (folders ?? []).filter((folder) => folder.mode === activeTab).sort((a, b) => a.sortOrder - b.sortOrder),
    [activeTab, folders],
  );

  const { folderChatsMap, unfiledChats } = useMemo(() => {
    const map = new Map<string, Array<{ chat: Chat; branchCount: number }>>();
    const unfiled: Array<{ chat: Chat; branchCount: number }> = [];
    for (const entry of displayChats) {
      if (!entry.chat.folderId) {
        unfiled.push(entry);
        continue;
      }
      const entries = map.get(entry.chat.folderId) ?? [];
      entries.push(entry);
      map.set(entry.chat.folderId, entries);
    }
    return { folderChatsMap: map, unfiledChats: unfiled };
  }, [displayChats]);

  const selectChat = (chat: Chat) => {
    closeAllDetails();
    setActiveChatId(chat.id);
    setActiveChatSnapshot({ id: chat.id, characterIds: chat.characterIds, mode: chat.mode });
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  };

  const cycleSort = () => {
    setSort((current) => {
      if (current === "newest") return "oldest";
      if (current === "oldest") return "name-asc";
      if (current === "name-asc") return "name-desc";
      return "newest";
    });
  };

  const activeTabLabel = MODE_TABS.find((tab) => tab.id === activeTab)?.label ?? "Chat";
  const canShowEmpty = displayChats.length === 0 && !isLoading && !chatsError;

  return (
    <nav data-component="ChatSidebar" className="flex h-full flex-col overflow-hidden">
      <div className="mari-sidebar-header border-b border-[var(--border)]/30 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--sidebar-foreground)]">Marinara</p>
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">Local workspace</p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white opacity-50 shadow-sm"
            title="New chat waits for the Rust chats backend slice"
            disabled
          >
            <Plus size="0.9375rem" />
          </button>
        </div>

        <div className="relative">
          <Search
            size="0.875rem"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl border border-[var(--border)]/40 bg-[var(--sidebar-accent)]/35 py-2 pl-9 pr-3 text-xs text-[var(--sidebar-foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]/40"
          />
        </div>
      </div>

      <div className="border-b border-[var(--border)]/30 px-3 py-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--sidebar-accent)]/25 p-1">
          {MODE_TABS.map(({ id, shortLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
                setActiveTag(null);
                setTagsExpanded(false);
              }}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium transition-all",
                activeTab === id
                  ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size="0.75rem" />
              <span className="truncate">{shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={cycleSort}
            className="flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)]"
            title="Change chat sort"
          >
            <ArrowUpDown size="0.75rem" />
            {SORT_LABELS[sort]}
          </button>
          {allTags.length > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded((value) => !value)}
              className="flex min-w-0 flex-1 items-center justify-end gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-all hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--foreground)]"
            >
              <Tag size="0.75rem" />
              Tags
              <ChevronDown size="0.75rem" className={cn("transition-transform", tagsExpanded && "rotate-180")} />
            </button>
          )}
        </div>

        {tagsExpanded && allTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
                className={cn(
                  "max-w-full truncate rounded-full px-2 py-1 text-[0.625rem] transition-all",
                  activeTag === tag
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "bg-[var(--sidebar-accent)]/35 text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading && (
          <div className="px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">Loading chats...</div>
        )}

        {chatsError && (
          <div className="mx-1 rounded-xl border border-[var(--border)]/40 bg-[var(--card)]/65 px-3 py-4 text-center">
            <MessageSquare className="mx-auto text-[var(--muted-foreground)]" size="1.25rem" />
            <p className="mt-2 text-xs font-medium text-[var(--foreground)]">Chat backend not wired yet</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {getErrorMessage(chatsError)}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="mt-3 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] transition-all hover:bg-[var(--primary)]/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? "Checking..." : "Try Again"}
            </button>
          </div>
        )}

        {canShowEmpty && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)]">
              {activeTab === "conversation" ? (
                <MessageSquare size="1.25rem" className="text-[var(--muted-foreground)]" />
              ) : activeTab === "game" ? (
                <Theater size="1.25rem" className="text-[var(--muted-foreground)]" />
              ) : (
                <BookOpen size="1.25rem" className="text-[var(--muted-foreground)]" />
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {searchQuery.trim() || activeTag ? `No ${activeTabLabel.toLowerCase()} chats match` : `No ${activeTabLabel.toLowerCase()} chats yet`}
            </p>
            <button
              type="button"
              disabled
              className="mt-1 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-[0.6875rem] font-medium text-[var(--primary)] opacity-50"
              title="New chat waits for the Rust chats backend slice"
            >
              + New {activeTabLabel}
            </button>
          </div>
        )}

        <div className="stagger-children flex flex-col gap-0.5">
          {modeFolders.map((folder) => (
            <FolderSection
              key={folder.id}
              folder={folder}
              entries={folderChatsMap.get(folder.id) ?? []}
              renderChat={(entry) => (
                <ChatRow
                  key={entry.chat.id}
                  chat={entry.chat}
                  activeChatId={activeChatId}
                  branchCount={entry.branchCount}
                  characterLookup={characterLookup}
                  unreadCount={unreadCounts.get(entry.chat.id) ?? 0}
                  onSelect={() => selectChat(entry.chat)}
                />
              )}
            />
          ))}
          {unfiledChats.map((entry) => (
            <ChatRow
              key={entry.chat.id}
              chat={entry.chat}
              activeChatId={activeChatId}
              branchCount={entry.branchCount}
              characterLookup={characterLookup}
              unreadCount={unreadCounts.get(entry.chat.id) ?? 0}
              onSelect={() => selectChat(entry.chat)}
            />
          ))}
        </div>
      </div>

      <UserStatusFooter />
    </nav>
  );
}

function FolderSection({
  folder,
  entries,
  renderChat,
}: {
  folder: ChatFolder;
  entries: Array<{ chat: Chat; branchCount: number }>;
  renderChat: (entry: { chat: Chat; branchCount: number }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(!folder.collapsed);

  useEffect(() => setOpen(!folder.collapsed), [folder.collapsed]);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-[var(--sidebar-accent)]/40"
      >
        <ChevronRight
          size="0.75rem"
          className={cn("text-[var(--muted-foreground)] transition-transform", open && "rotate-90")}
        />
        <FolderOpen size="0.75rem" className="text-[var(--muted-foreground)]" />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: folder.color || "#6b7280" }} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--muted-foreground)]">
          {folder.name}
        </span>
        {entries.length > 0 && <span className="text-[0.5625rem] text-[var(--muted-foreground)]">{entries.length}</span>}
      </button>
      {open && entries.length > 0 && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--border)]/20 pl-1">
          {entries.map(renderChat)}
        </div>
      )}
    </div>
  );
}

function ChatRow({
  chat,
  activeChatId,
  branchCount,
  characterLookup,
  unreadCount,
  onSelect,
}: {
  chat: Chat;
  activeChatId: string | null;
  branchCount: number;
  characterLookup: Map<
    string,
    {
      name: string;
      avatarUrl: string | null;
      avatarCrop?: { zoom: number; offsetX: number; offsetY: number } | null;
      conversationStatus?: string;
    }
  >;
  unreadCount: number;
  onSelect: () => void;
}) {
  const tags = getChatTags(chat);
  const characterIds = normalizeChatCharacterIds(chat.characterIds);
  const firstCharacter = characterIds.length > 0 ? characterLookup.get(characterIds[0]!) : undefined;
  const isActive = activeChatId === chat.id;

  return (
    <button
      type="button"
      data-chat-id={chat.id}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all",
        isActive
          ? "bg-[var(--primary)]/12 text-[var(--foreground)] ring-1 ring-[var(--primary)]/20"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/45",
      )}
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--secondary)]">
        {firstCharacter?.avatarUrl ? (
          <img
            src={firstCharacter.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            style={getAvatarCropStyle(firstCharacter.avatarCrop)}
          />
        ) : (
          <MessageSquare size="1rem" className="text-[var(--muted-foreground)]" />
        )}
        {unreadCount > 0 && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold">{chat.name || "Untitled chat"}</span>
          {branchCount > 1 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
              <GitBranch size="0.5625rem" />
              {branchCount}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.625rem] text-[var(--muted-foreground)]">
          <span className="truncate">{firstCharacter?.name ?? MODE_TABS.find((tab) => tab.id === chat.mode)?.label ?? "Chat"}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">{formatChatDate(chat.updatedAt)}</span>
        </div>
        {tags.length > 0 && (
          <div className="mt-1 flex min-w-0 gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="max-w-20 truncate rounded-full bg-[var(--sidebar-accent)]/50 px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

const STATUS_OPTIONS: Array<{
  value: UserStatus;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    value: "active",
    label: "Active",
    description: "You're online and available",
    color: "bg-green-500",
    icon: <Circle size="0.625rem" className="fill-green-500 text-green-500" />,
  },
  {
    value: "idle",
    label: "Idle",
    description: "Automatic when you're away",
    color: "bg-yellow-500",
    icon: <Moon size="0.625rem" className="text-yellow-500" />,
  },
  {
    value: "dnd",
    label: "Do Not Disturb",
    description: "Suppress auto messages",
    color: "bg-red-500",
    icon: <MinusCircle size="0.625rem" className="text-red-500" />,
  },
];

function UserStatusFooter() {
  const userStatus = useUIStore((s) => s.userStatus);
  const userActivity = useUIStore((s) => s.userActivity);
  const setUserStatusManual = useUIStore((s) => s.setUserStatusManual);
  const setUserActivity = useUIStore((s) => s.setUserActivity);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = STATUS_OPTIONS.find((s) => s.value === userStatus) ?? STATUS_OPTIONS[0]!;

  return (
    <div ref={ref} className="relative border-t border-[var(--border)]/30 px-3 py-2">
      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl bg-[var(--popover)] p-1.5 shadow-xl ring-1 ring-[var(--border)]/40">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setUserStatusManual(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-[var(--accent)]",
                userStatus === opt.value && "bg-[var(--accent)]",
              )}
            >
              <span className={`h-2 w-2 rounded-full ${opt.color}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--foreground)]">{opt.label}</div>
                <div className="text-[0.625rem] text-[var(--muted-foreground)]">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/60"
          title="Change activity status"
          aria-label="Change activity status"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${current.color}`} />
          <span className="max-w-20 truncate text-xs text-[var(--sidebar-foreground)]">{current.label}</span>
        </button>
        <input
          value={userActivity}
          onChange={(event) => setUserActivity(event.target.value)}
          maxLength={120}
          placeholder="What are you doing?"
          aria-label="Custom activity"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)]/40 bg-[var(--sidebar-accent)]/35 px-2 py-1.5 text-xs text-[var(--sidebar-foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/70 focus:border-[var(--primary)]/40 focus:bg-[var(--sidebar-accent)]/60"
        />
      </div>
    </div>
  );
}
