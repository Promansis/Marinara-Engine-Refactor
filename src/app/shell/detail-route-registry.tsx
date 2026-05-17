import { lazy, type ReactNode } from "react";

const CharacterEditor = lazy(() =>
  import("../../features/characters/components/CharacterEditor").then((module) => ({ default: module.CharacterEditor })),
);
const CharacterLibraryView = lazy(() =>
  import("../../features/characters/components/CharacterLibraryView").then((module) => ({
    default: module.CharacterLibraryView,
  })),
);
const LorebookEditor = lazy(() =>
  import("../../features/lorebooks/components/LorebookEditor").then((module) => ({ default: module.LorebookEditor })),
);
const PresetEditor = lazy(() =>
  import("../../features/presets/components/PresetEditor").then((module) => ({ default: module.PresetEditor })),
);
const ConnectionEditor = lazy(() =>
  import("../../features/connections/components/ConnectionEditor").then((module) => ({
    default: module.ConnectionEditor,
  })),
);
const AgentEditor = lazy(() =>
  import("../../features/agents/components/AgentEditor").then((module) => ({ default: module.AgentEditor })),
);
const ToolEditor = lazy(() =>
  import("../../features/agents/components/ToolEditor").then((module) => ({ default: module.ToolEditor })),
);
const PersonaEditor = lazy(() =>
  import("../../features/personas/components/PersonaEditor").then((module) => ({ default: module.PersonaEditor })),
);
const RegexScriptEditor = lazy(() =>
  import("../../features/agents/components/RegexScriptEditor").then((module) => ({
    default: module.RegexScriptEditor,
  })),
);

export type DetailRouteState = {
  characterDetailId: string | null;
  characterLibraryOpen: boolean;
  lorebookDetailId: string | null;
  presetDetailId: string | null;
  connectionDetailId: string | null;
  agentDetailId: string | null;
  toolDetailId: string | null;
  personaDetailId: string | null;
  regexDetailId: string | null;
};

type DetailRoute = {
  isActive: (state: DetailRouteState) => boolean;
  render: () => ReactNode;
};

const DETAIL_ROUTES: DetailRoute[] = [
  { isActive: (state) => Boolean(state.regexDetailId), render: () => <RegexScriptEditor /> },
  { isActive: (state) => Boolean(state.personaDetailId), render: () => <PersonaEditor /> },
  { isActive: (state) => Boolean(state.toolDetailId), render: () => <ToolEditor /> },
  { isActive: (state) => Boolean(state.agentDetailId), render: () => <AgentEditor /> },
  { isActive: (state) => Boolean(state.connectionDetailId), render: () => <ConnectionEditor /> },
  { isActive: (state) => Boolean(state.presetDetailId), render: () => <PresetEditor /> },
  { isActive: (state) => Boolean(state.characterDetailId), render: () => <CharacterEditor /> },
  { isActive: (state) => state.characterLibraryOpen, render: () => <CharacterLibraryView /> },
  { isActive: (state) => Boolean(state.lorebookDetailId), render: () => <LorebookEditor /> },
];

export function getDetailRouteView(state: DetailRouteState): ReactNode | null {
  return DETAIL_ROUTES.find((route) => route.isActive(state))?.render() ?? null;
}
