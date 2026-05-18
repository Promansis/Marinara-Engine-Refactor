import { create } from "zustand";
import type {
  SidecarConfig,
  SidecarCustomModelEntry,
  SidecarDownloadProgress,
  SidecarModelInfo,
  SidecarQuantization,
  SidecarRuntimeDiagnostics,
  SidecarRuntimeInfo,
  SidecarStatus,
} from "@marinara-engine/shared";
import { SIDECAR_DEFAULT_CONFIG } from "@marinara-engine/shared";

interface SidecarTestMessageResult {
  success: boolean;
  response: string;
  messageContent?: string;
  reasoningContent?: string;
  nonce?: string;
  nonceVerified?: boolean;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  timings?: {
    promptTokens: number | null;
    promptMs: number | null;
    predictedTokens: number | null;
    predictedMs: number | null;
  };
  latencyMs: number;
  error?: string;
  failedRuntimeVariant?: string | null;
}

interface SidecarState {
  status: SidecarStatus;
  config: SidecarConfig;
  modelDownloaded: boolean;
  modelDisplayName: string | null;
  runtime: SidecarRuntimeInfo;
  inferenceReady: boolean;
  modelSize: number | null;
  logPath: string | null;
  startupError: string | null;
  failedRuntimeVariant: string | null;
  runtimeDiagnostics: SidecarRuntimeDiagnostics | null;
  platform: string;
  arch: string;
  curatedModels: SidecarModelInfo[];
  downloadProgress: SidecarDownloadProgress | null;
  customModels: SidecarCustomModelEntry[];
  customModelsLoading: boolean;
  customModelsError: string | null;
  showDownloadModal: boolean;
  hasBeenPrompted: boolean;
  testMessagePending: boolean;
  testMessageResult: SidecarTestMessageResult | null;

  fetchStatus: () => Promise<void>;
  startDownload: (quantization: SidecarQuantization) => Promise<void>;
  startCustomDownload: (repo: string, modelPath?: string) => Promise<void>;
  listHuggingFaceModels: (repo: string) => Promise<SidecarCustomModelEntry[]>;
  clearCustomModels: () => void;
  cancelDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
  unloadModel: () => Promise<void>;
  restartRuntime: () => Promise<void>;
  installRuntime: (reinstall?: boolean) => Promise<void>;
  sendTestMessage: () => Promise<void>;
  reinstallRuntime: () => Promise<void>;
  updateConfig: (
    partial: Partial<
      Pick<
        SidecarConfig,
        | "useForTrackers"
        | "useForGameScene"
        | "contextSize"
        | "maxTokens"
        | "temperature"
        | "topP"
        | "topK"
        | "gpuLayers"
        | "runtimePreference"
      >
    >,
  ) => Promise<void>;
  setShowDownloadModal: (open: boolean) => void;
  markPrompted: () => void;
}

const PROMPTED_KEY = "marinara_sidecar_prompted";
const SIDECAR_DEFERRED_MESSAGE =
  "Local sidecar is deferred in the Tauri migration. Configure a provider connection instead.";

const DEFERRED_RUNTIME: SidecarRuntimeInfo = {
  installed: false,
  build: null,
  variant: null,
  backend: null,
  source: null,
  systemPath: null,
};

const DEFERRED_STATUS = {
  status: "not_downloaded" as SidecarStatus,
  modelDownloaded: false,
  modelDisplayName: null,
  runtime: DEFERRED_RUNTIME,
  inferenceReady: false,
  modelSize: null,
  logPath: null,
  startupError: SIDECAR_DEFERRED_MESSAGE,
  failedRuntimeVariant: null,
  runtimeDiagnostics: null,
  platform: "",
  arch: "",
  curatedModels: [],
  downloadProgress: null,
  customModels: [],
  customModelsLoading: false,
  customModelsError: null,
  testMessagePending: false,
} satisfies Omit<SidecarState, "config" | "showDownloadModal" | "hasBeenPrompted" | "testMessageResult" | keyof SidecarActions>;

type SidecarActions = {
  [K in keyof SidecarState as SidecarState[K] extends (...args: never[]) => unknown ? K : never]: SidecarState[K];
};

function readPrompted(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) === "true";
  } catch {
    return false;
  }
}

function writePrompted(): void {
  try {
    localStorage.setItem(PROMPTED_KEY, "true");
  } catch {
    // Ignore storage failures; this only suppresses an optional prompt.
  }
}

function deferredDownloadProgress(phase: SidecarDownloadProgress["phase"], label?: string): SidecarDownloadProgress {
  return {
    phase,
    status: "error",
    downloaded: 0,
    total: 0,
    speed: 0,
    label,
    error: SIDECAR_DEFERRED_MESSAGE,
  };
}

function deferredTestResult(): SidecarTestMessageResult {
  return {
    success: false,
    response: "",
    latencyMs: 0,
    error: SIDECAR_DEFERRED_MESSAGE,
    failedRuntimeVariant: null,
  };
}

export const useSidecarStore = create<SidecarState>((set, get) => ({
  ...DEFERRED_STATUS,
  config: { ...SIDECAR_DEFAULT_CONFIG, useForTrackers: false, useForGameScene: false },
  showDownloadModal: false,
  hasBeenPrompted: readPrompted(),
  testMessageResult: null,

  fetchStatus: async () => {
    set({ ...DEFERRED_STATUS, config: { ...get().config, useForTrackers: false, useForGameScene: false } });
  },

  startDownload: async (_quantization) => {
    set({ ...DEFERRED_STATUS, downloadProgress: deferredDownloadProgress("model", "Local model download") });
  },

  startCustomDownload: async (_repo, _modelPath) => {
    set({ ...DEFERRED_STATUS, downloadProgress: deferredDownloadProgress("model", "Custom local model download") });
  },

  listHuggingFaceModels: async (_repo) => {
    set({ customModels: [], customModelsLoading: false, customModelsError: SIDECAR_DEFERRED_MESSAGE });
    return [];
  },

  clearCustomModels: () => {
    set({ customModels: [], customModelsError: null, customModelsLoading: false });
  },

  cancelDownload: async () => {
    set({ downloadProgress: null });
  },

  deleteModel: async () => {
    set({ ...DEFERRED_STATUS, config: { ...SIDECAR_DEFAULT_CONFIG, useForTrackers: false, useForGameScene: false } });
  },

  unloadModel: async () => {
    set({ ...DEFERRED_STATUS });
  },

  restartRuntime: async () => {
    set({ ...DEFERRED_STATUS, startupError: SIDECAR_DEFERRED_MESSAGE });
  },

  installRuntime: async (reinstall = false) => {
    set({
      ...DEFERRED_STATUS,
      downloadProgress: deferredDownloadProgress(
        "runtime",
        reinstall ? "Reinstall local runtime" : "Install local runtime",
      ),
    });
  },

  sendTestMessage: async () => {
    set({ testMessagePending: false, testMessageResult: deferredTestResult(), startupError: SIDECAR_DEFERRED_MESSAGE });
  },

  reinstallRuntime: async () => {
    await get().installRuntime(true);
  },

  updateConfig: async (partial) => {
    set({ config: { ...get().config, ...partial, useForTrackers: false, useForGameScene: false } });
  },

  setShowDownloadModal: (open) => set({ showDownloadModal: open }),

  markPrompted: () => {
    writePrompted();
    set({ hasBeenPrompted: true });
  },
}));
