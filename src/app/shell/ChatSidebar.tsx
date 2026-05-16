import { BookOpen, MessageSquare, Plus, Search, Theater } from "lucide-react";
import { useState } from "react";
import { useUIStore, type UserStatus } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";

const STATUS_OPTIONS: Array<{
  value: UserStatus;
  label: string;
  description: string;
  color: string;
}> = [
  {
    value: "active",
    label: "Active",
    description: "You're online and available",
    color: "bg-green-500",
  },
  {
    value: "idle",
    label: "Idle",
    description: "Automatic when you're away",
    color: "bg-yellow-500",
  },
  {
    value: "dnd",
    label: "Do Not Disturb",
    description: "Suppress auto messages",
    color: "bg-red-500",
  },
];

const TABS = [
  { id: "conversation", label: "Convo", icon: MessageSquare },
  { id: "roleplay", label: "RP", icon: BookOpen },
  { id: "game", label: "Game", icon: Theater },
] as const;

export function ChatSidebar() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("conversation");

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
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
            title="New chat"
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
            disabled
            placeholder="Search chats..."
            className="w-full rounded-xl border border-[var(--border)]/40 bg-[var(--sidebar-accent)]/35 py-2 pl-9 pr-3 text-xs text-[var(--sidebar-foreground)] outline-none placeholder:text-[var(--muted-foreground)]/70"
          />
        </div>
      </div>

      <div className="border-b border-[var(--border)]/30 px-3 py-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--sidebar-accent)]/25 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.6875rem] font-medium transition-all",
                activeTab === id
                  ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              <Icon size="0.75rem" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="animate-float flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--secondary)]">
          {activeTab === "conversation" ? (
            <MessageSquare size="1.25rem" className="text-[var(--muted-foreground)]" />
          ) : activeTab === "game" ? (
            <Theater size="1.25rem" className="text-[var(--muted-foreground)]" />
          ) : (
            <BookOpen size="1.25rem" className="text-[var(--muted-foreground)]" />
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">Chat list moves in Phase 2.</p>
      </div>

      <UserStatusFooter />
    </nav>
  );
}

function UserStatusFooter() {
  const userStatus = useUIStore((s) => s.userStatus);
  const userActivity = useUIStore((s) => s.userActivity);
  const setUserStatusManual = useUIStore((s) => s.setUserStatusManual);
  const setUserActivity = useUIStore((s) => s.setUserActivity);
  const [open, setOpen] = useState(false);

  const current = STATUS_OPTIONS.find((s) => s.value === userStatus) ?? STATUS_OPTIONS[0]!;

  return (
    <div className="relative border-t border-[var(--border)]/30 px-3 py-2">
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
