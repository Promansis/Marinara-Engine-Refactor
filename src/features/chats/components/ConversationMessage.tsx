import { Check, ChevronLeft, ChevronRight, Copy, Pencil, RefreshCw, Trash2, User, X } from "lucide-react";
import { memo, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn, copyToClipboard } from "../../../shared/lib/utils";
import { useUIStore } from "../../../shared/stores/ui.store";
import type { Message, MessageExtra } from "../types";

function parseExtra(extra: Message["extra"]): MessageExtra {
  if (!extra) return {};
  if (typeof extra !== "string") return extra;
  try {
    const parsed = JSON.parse(extra) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MessageExtra) : {};
  } catch {
    return {};
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function displayNameFor(message: Message, extra: MessageExtra) {
  if (message.role === "user") return extra.personaSnapshot?.name || "You";
  if (message.role === "system") return "System";
  if (message.role === "narrator") return "Narrator";
  return "Assistant";
}

interface ConversationMessageProps {
  message: Message;
  isGrouped?: boolean;
  messageIndex?: number;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onSetActiveSwipe?: (messageId: string, index: number) => void;
}

export const ConversationMessage = memo(function ConversationMessage({
  message,
  isGrouped,
  messageIndex,
  onDelete,
  onEdit,
  onRegenerate,
  onSetActiveSwipe,
}: ConversationMessageProps) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const chatFontSize = useUIStore((s) => s.chatFontSize);
  const showMessageNumbers = useUIStore((s) => s.showMessageNumbers);
  const extra = useMemo(() => parseExtra(message.extra), [message.extra]);
  const content = extra.displayText || message.content;
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const displayName = displayNameFor(message, extra);
  const activeSwipe = message.swipes?.[message.activeSwipeIndex];
  const visibleContent = activeSwipe?.content || content;
  const swipeCount = message.swipeCount ?? message.swipes?.length ?? 0;
  const hasSwipes = swipeCount > 1;
  const messageTextStyle = useMemo<CSSProperties>(() => ({ fontSize: `${chatFontSize}px` }), [chatFontSize]);

  const saveEdit = () => {
    const next = editRef.current?.value ?? "";
    onEdit?.(message.id, next);
    setEditing(false);
  };

  return (
    <article
      className={cn(
        "mari-message group relative flex gap-4 px-4 py-0.5 transition-colors hover:bg-[var(--secondary)]/30",
        isUser ? "mari-message-user" : "mari-message-assistant",
        isGrouped ? "mt-0" : "mt-4",
        isSystem && "opacity-80",
      )}
      data-message-id={message.id}
      data-message-role={message.role}
    >
      <div className="mari-message-avatar w-10 flex-shrink-0">
        {!isGrouped && (
          <>
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--muted-foreground)]">
              {isUser ? <User size="1.125rem" /> : displayName[0]?.toUpperCase()}
            </div>
            {showMessageNumbers && messageIndex != null && (
              <span className="mt-0.5 block text-center text-[0.5rem] font-medium text-[var(--muted-foreground)]">
                #{messageIndex}
              </span>
            )}
          </>
        )}
      </div>

      <div className="mari-message-body min-w-0 flex-1">
        {!isGrouped && (
          <div className="mari-message-meta mb-0.5 flex items-baseline gap-2">
            <span className="mari-message-name cursor-default text-[0.9375rem] font-semibold leading-tight text-[var(--foreground)]">
              {displayName}
            </span>
            <span className="mari-message-timestamp text-[0.6875rem] text-[var(--muted-foreground)]/60">
              {formatTimestamp(message.createdAt)}
            </span>
          </div>
        )}

        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              defaultValue={visibleContent}
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-2.5 text-[0.9375rem] leading-relaxed outline-none"
              rows={Math.min(8, Math.max(2, visibleContent.split("\n").length))}
              style={messageTextStyle}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveEdit();
              }}
            />
            <div className="flex items-center justify-end gap-1.5">
              <button type="button" onClick={() => setEditing(false)} className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)]" title="Cancel">
                <X size="0.875rem" />
              </button>
              <button type="button" onClick={saveEdit} className="rounded-md p-1 text-emerald-500 hover:bg-emerald-500/10" title="Save">
                <Check size="0.875rem" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="mari-message-content whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed"
            style={messageTextStyle}
          >
            {visibleContent || <span className="italic text-[var(--muted-foreground)]">Empty message</span>}
          </div>
        )}

        {extra.attachments && extra.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {extra.attachments.map((attachment, index) => {
              const source = attachment.url || attachment.data;
              const name = attachment.filename || attachment.name || `Attachment ${index + 1}`;
              if (source && (attachment.type === "image" || attachment.type?.startsWith("image/"))) {
                return (
                  <img
                    key={`${name}-${index}`}
                    src={source}
                    alt={name}
                    className="max-h-64 max-w-full rounded-lg border border-[var(--border)] object-contain"
                    loading="lazy"
                  />
                );
              }
              return (
                <span key={`${name}-${index}`} className="rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
                  {name}
                </span>
              );
            })}
          </div>
        )}

        {hasSwipes && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <button
              type="button"
              onClick={() => onSetActiveSwipe?.(message.id, Math.max(0, message.activeSwipeIndex - 1))}
              disabled={message.activeSwipeIndex <= 0}
              className="rounded p-0.5 hover:bg-[var(--accent)] disabled:opacity-40"
              title="Previous swipe"
            >
              <ChevronLeft size="0.875rem" />
            </button>
            <span>
              {message.activeSwipeIndex + 1}/{swipeCount}
            </span>
            <button
              type="button"
              onClick={() => onSetActiveSwipe?.(message.id, Math.min(swipeCount - 1, message.activeSwipeIndex + 1))}
              disabled={message.activeSwipeIndex >= swipeCount - 1}
              className="rounded p-0.5 hover:bg-[var(--accent)] disabled:opacity-40"
              title="Next swipe"
            >
              <ChevronRight size="0.875rem" />
            </button>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-1 hidden items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--card)]/95 p-1 shadow-sm group-hover:flex">
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(visibleContent);
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 900);
            }
          }}
          className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          title={copied ? "Copied" : "Copy"}
        >
          <Copy size="0.8125rem" />
        </button>
        <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Edit">
          <Pencil size="0.8125rem" />
        </button>
        {!isUser && (
          <button type="button" onClick={() => onRegenerate?.(message.id)} className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]" title="Regenerate">
            <RefreshCw size="0.8125rem" />
          </button>
        )}
        <button type="button" onClick={() => onDelete?.(message.id)} className="rounded-md p-1 text-[var(--muted-foreground)] hover:bg-destructive/10 hover:text-destructive" title="Delete">
          <Trash2 size="0.8125rem" />
        </button>
      </div>
    </article>
  );
});
