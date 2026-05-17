import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "../types";

function parseExtra(extra: Message["extra"]): Record<string, unknown> {
  if (!extra) return {};
  if (typeof extra !== "string") return extra;
  try {
    const parsed = JSON.parse(extra) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getChoicesFromMessage(message: Message | undefined): string[] {
  if (!message) return [];
  const extra = parseExtra(message.extra);
  const candidates = extra.choices ?? extra.cyoaChoices ?? extra.visualNovelChoices;
  if (!Array.isArray(candidates)) return [];
  return candidates.filter((choice): choice is string => typeof choice === "string" && choice.trim().length > 0);
}

export function CyoaChoices({ messages }: { messages: Message[] | undefined }) {
  const lastAssistant = [...(messages ?? [])].reverse().find((message) => message.role === "assistant");
  const choices = getChoicesFromMessage(lastAssistant);

  if (choices.length === 0) return null;

  return (
    <div className="mx-auto my-4 flex w-full max-w-2xl flex-col gap-2 px-2">
      <div className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase text-[var(--muted-foreground)]">
        <Sparkles size="0.75rem" />
        Choices
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => toast.error("Choice submission is waiting for the Rust generation backend slice.")}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)]/80 px-3 py-2 text-left text-xs leading-relaxed text-[var(--foreground)] shadow-sm backdrop-blur transition-colors hover:bg-[var(--accent)]"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
