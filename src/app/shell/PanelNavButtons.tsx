import { BookOpen, Bot, FileText, Link, Settings, Sparkles, User, Users } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useAgentStore } from "../../shared/stores/agent.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";

const RIGHT_PANEL_BUTTONS = [
  { panel: "bot-browser" as const, icon: Bot, label: "Browser", color: "from-cyan-400 to-blue-500" },
  { panel: "characters" as const, icon: Users, label: "Characters", color: "from-pink-400 to-rose-500" },
  { panel: "lorebooks" as const, icon: BookOpen, label: "Lorebooks", color: "from-amber-400 to-orange-500" },
  { panel: "presets" as const, icon: FileText, label: "Presets", color: "from-purple-400 to-violet-500" },
  { panel: "connections" as const, icon: Link, label: "Connections", color: "from-sky-400 to-blue-500" },
  { panel: "agents" as const, icon: Sparkles, label: "Agents", color: "from-pink-300 to-purple-400" },
  { panel: "personas" as const, icon: User, label: "Personas", color: "from-emerald-400 to-teal-500" },
  { panel: "settings" as const, icon: Settings, label: "Settings", color: "from-zinc-400 to-zinc-500" },
] as const;

function stopTitlebarDrag(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function PanelNavButtons({ className }: { className?: string }) {
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const failedAgentCount = useAgentStore((s) => s.failedAgentTypes.length);

  return (
    <nav
      data-tour="panel-buttons"
      aria-label="Panel navigation"
      className={cn("mari-panel-nav flex shrink-0 items-center gap-0.5", className)}
      onMouseDown={stopTitlebarDrag}
      onDoubleClick={stopTitlebarDrag}
    >
      {RIGHT_PANEL_BUTTONS.map(({ panel, icon: Icon, label, color }) => {
        const isActive = rightPanelOpen && rightPanel === panel;
        return (
          <button
            key={panel}
            type="button"
            onClick={() => toggleRightPanel(panel)}
            onMouseDown={stopTitlebarDrag}
            onDoubleClick={stopTitlebarDrag}
            className={cn(
              "relative rounded-md p-1.5 transition-all duration-200 active:scale-95",
              isActive
                ? "bg-[var(--accent)] text-[var(--primary)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]/70 hover:text-[var(--primary)]",
            )}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          >
            <Icon size="0.875rem" />
            {isActive && (
              <span
                className={cn(
                  "absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r",
                  color,
                )}
              />
            )}
            {panel === "agents" && failedAgentCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-1 ring-[var(--card)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
