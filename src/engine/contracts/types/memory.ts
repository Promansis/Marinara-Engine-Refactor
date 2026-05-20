export type MemoryVisibility = "private" | "shared" | "public";

export type MemoryMode = "chat" | "roleplay" | "game";

export type MemoryNoteType =
  | "fact"
  | "preference"
  | "summary"
  | "relationship"
  | "world"
  | "quest"
  | "scene"
  | "custom";

export type MemoryNoteStatus = "active" | "archived";

export type MemoryEventType =
  | "created"
  | "updated"
  | "archived"
  | "section_added"
  | "section_updated"
  | "linked"
  | "unlinked"
  | "validated"
  | "reindexed";

export interface MemoryScope {
  universeId?: string | null;
  conversationId?: string | null;
  roleplayId?: string | null;
  gameId?: string | null;
  visibility: MemoryVisibility;
}

export interface MemoryGate {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains";
  value: string;
}

export interface MemoryEvidence {
  source: string;
  quote?: string;
  messageId?: string | null;
  noteId?: string | null;
  createdAt?: string;
}

export interface MemorySection {
  text: string;
  confidence: number;
  salience: number;
  visibility?: MemoryVisibility;
  gates?: MemoryGate[];
  evidence?: MemoryEvidence[];
  updatedAt?: string;
}

export interface MemoryLink {
  noteId: string;
  relationship: string;
}

export interface MemoryNote {
  id: string;
  type: MemoryNoteType;
  status: MemoryNoteStatus;
  modes: MemoryMode[];
  scope: MemoryScope;
  tags: string[];
  links: MemoryLink[];
  sections: Record<string, MemorySection>;
  createdAt: string;
  updatedAt: string;
  version: number;
  previousHash: string | null;
}

export interface MemoryNoteDraft {
  type: MemoryNoteType;
  modes?: MemoryMode[];
  scope: MemoryScope;
  tags?: string[];
  links?: MemoryLink[];
  sections: Record<string, MemorySection>;
}

export interface MemoryNotePatch {
  type?: MemoryNoteType;
  status?: MemoryNoteStatus;
  modes?: MemoryMode[];
  scope?: MemoryScope;
  tags?: string[];
  links?: MemoryLink[];
  sections?: Record<string, MemorySection>;
}

export interface MemoryListOptions {
  status?: MemoryNoteStatus;
  types?: MemoryNoteType[];
  modes?: MemoryMode[];
  scope?: Partial<MemoryScope>;
  tags?: string[];
  includeArchived?: boolean;
  limit?: number;
}

export interface MemoryEventTarget {
  kind: "note" | "section" | "manifest" | "vault";
  id?: string;
  section?: string;
}

export interface MemoryEvent {
  ts: string;
  type: MemoryEventType;
  target: MemoryEventTarget;
  field?: string;
  old?: unknown;
  newValue?: unknown;
  cause?: string;
  turn?: number;
  mode?: MemoryMode;
  scope?: MemoryScope;
}

export type MemoryEventDraft = Omit<MemoryEvent, "ts"> & {
  ts?: string;
};

export interface MemoryManifestFile {
  path: string;
  hash: string;
  bytes: number;
  updatedAt?: string;
}

export interface MemoryManifest {
  version: string;
  embeddingModel: string | null;
  generatedAt: string;
  vaultHash: string;
  files: MemoryManifestFile[];
}

export interface MemoryValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export interface MemoryValidationReport {
  ok: boolean;
  issues: MemoryValidationIssue[];
  staleIndexes: boolean;
  counts: Record<string, number>;
}

export interface MemoryRebuildRequest {
  force?: boolean;
  embeddingModel?: string | null;
  noteIds?: string[];
  scope?: Partial<MemoryScope>;
}

export interface MemoryRebuildResult {
  noteCount: number;
  eventCount: number;
  reindexedNoteIds: string[];
  removedNoteIds: string[];
  manifest: MemoryManifest;
  warnings: string[];
}

export interface MemoryLayoutInfo {
  version: string;
  rootPath: string;
  notesPath: string;
  eventsPath: string;
  manifestPath: string;
  indexesPath: string;
}
