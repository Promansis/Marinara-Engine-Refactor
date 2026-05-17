import { ArrowLeft, ArrowRight, ArrowRightLeft, Film, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useChatStore } from "../../../shared/stores/chat.store";

type SceneForkMode = "convert" | "copy";

interface SceneBannerProps {
  variant: "scene" | "origin";
  sceneChatId?: string;
  sceneChatName?: string;
  originChatId?: string;
  description?: string;
}

export function RoleplaySceneBanner({
  variant,
  sceneChatId,
  sceneChatName,
  originChatId,
  description,
}: SceneBannerProps) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  if (variant === "scene") {
    return (
      <div className="mx-auto my-3 w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-[var(--card-foreground)] shadow-lg backdrop-blur">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted-foreground)]">
          <Film size="0.875rem" />
          Scene
        </div>
        {description && <p className="mb-3 text-sm leading-relaxed italic">{description}</p>}
        {originChatId && (
          <button
            type="button"
            onClick={() => setActiveChatId(originChatId)}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80"
            title="Return to conversation"
          >
            <ArrowLeft size="0.75rem" />
            Back to conversation
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto my-3 flex w-full max-w-2xl items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-[var(--card-foreground)] shadow-lg backdrop-blur">
      <Film size="1.125rem" className="shrink-0 text-[var(--primary)]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">A scene is in progress</p>
        {sceneChatName && <p className="truncate text-xs text-[var(--muted-foreground)]">{sceneChatName}</p>}
      </div>
      {sceneChatId && (
        <button
          type="button"
          onClick={() => setActiveChatId(sceneChatId)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          title="Go to the active scene"
        >
          Go to Scene
          <ArrowRight size="0.75rem" />
        </button>
      )}
    </div>
  );
}

export function EndSceneBar({
  sceneChatId,
  originChatId,
  onConclude,
  onAbandon,
  onFork,
  isForking,
}: {
  sceneChatId: string;
  originChatId?: string;
  onConclude: (id: string) => void | Promise<void>;
  onAbandon?: (id: string) => void;
  onFork?: (id: string, mode: SceneForkMode) => void;
  isForking?: boolean;
}) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleConfirmEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await onConclude(sceneChatId);
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1.5">
      {originChatId && (
        <button
          type="button"
          onClick={() => setActiveChatId(originChatId)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--card-foreground)] transition-opacity hover:opacity-80"
          title="Return to conversation"
        >
          <ArrowLeft size="0.75rem" />
          Back
        </button>
      )}
      {!confirmEnd ? (
        <button
          type="button"
          onClick={() => {
            setConfirmDiscard(false);
            setConfirmEnd(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--card-foreground)] transition-opacity hover:opacity-80"
          title="End the scene and generate a summary"
        >
          <Film size="0.875rem" />
          End Scene
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6875rem] text-[var(--foreground)]">End and save summary?</span>
          <button
            type="button"
            onClick={handleConfirmEnd}
            disabled={isEnding}
            className="rounded-lg bg-[var(--primary)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {isEnding ? "Saving..." : "Yes"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmEnd(false)}
            disabled={isEnding}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--card-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            No
          </button>
        </div>
      )}
      {onAbandon && !confirmDiscard && (
        <button
          type="button"
          onClick={() => {
            setConfirmEnd(false);
            setConfirmDiscard(true);
          }}
          disabled={isEnding}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
          title="Discard the scene without saving"
        >
          <Trash2 size="0.8125rem" />
          Discard
        </button>
      )}
      {onFork && !confirmDiscard && (
        <button
          type="button"
          onClick={() => onFork(sceneChatId, "convert")}
          disabled={isForking}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
          title="Detach this scene into a standalone roleplay"
        >
          <ArrowRightLeft size="0.8125rem" />
          Convert
        </button>
      )}
      {onAbandon && confirmDiscard && (
        <div className="flex items-center gap-1.5">
          <span className="text-[0.6875rem] text-[var(--destructive)]">Discard scene?</span>
          <button
            type="button"
            onClick={() => onAbandon(sceneChatId)}
            className="rounded-lg bg-[var(--destructive)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--destructive-foreground)] transition-opacity hover:opacity-80"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmDiscard(false)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--card-foreground)] transition-opacity hover:opacity-80"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

export function deferredSceneAction(label: string) {
  toast.error(`${label} is waiting for the Rust conversation/roleplay backend slice.`);
}
