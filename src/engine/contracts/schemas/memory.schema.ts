import { z } from "zod";

export const memoryVisibilitySchema = z.enum(["private", "shared", "public"]);

export const memoryModeSchema = z.enum(["chat", "roleplay", "game"]);

export const memoryNoteTypeSchema = z.enum([
  "fact",
  "preference",
  "summary",
  "relationship",
  "world",
  "quest",
  "scene",
  "custom",
]);

export const memoryNoteStatusSchema = z.enum(["active", "archived"]);

export const memoryEventTypeSchema = z.enum([
  "created",
  "updated",
  "archived",
  "section_added",
  "section_updated",
  "linked",
  "unlinked",
  "validated",
  "reindexed",
]);

export const memoryScopeSchema = z.object({
  universeId: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  roleplayId: z.string().nullable().optional(),
  gameId: z.string().nullable().optional(),
  visibility: memoryVisibilitySchema,
});

export const memoryGateSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "not_contains"]),
  value: z.string(),
});

export const memoryEvidenceSchema = z.object({
  source: z.string(),
  quote: z.string().optional(),
  messageId: z.string().nullable().optional(),
  noteId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export const memorySectionSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  visibility: memoryVisibilitySchema.optional(),
  gates: z.array(memoryGateSchema).optional(),
  evidence: z.array(memoryEvidenceSchema).optional(),
  updatedAt: z.string().optional(),
});

export const memoryLinkSchema = z.object({
  noteId: z.string(),
  relationship: z.string(),
});

export const memorySectionsSchema = z.record(memorySectionSchema);

export const memoryNoteSchema = z.object({
  id: z.string(),
  type: memoryNoteTypeSchema,
  status: memoryNoteStatusSchema,
  modes: z.array(memoryModeSchema),
  scope: memoryScopeSchema,
  tags: z.array(z.string()),
  links: z.array(memoryLinkSchema),
  sections: memorySectionsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().min(1),
  previousHash: z.string().nullable(),
});

export const memoryNoteDraftSchema = z.object({
  type: memoryNoteTypeSchema,
  modes: z.array(memoryModeSchema).optional(),
  scope: memoryScopeSchema,
  tags: z.array(z.string()).optional(),
  links: z.array(memoryLinkSchema).optional(),
  sections: memorySectionsSchema,
});

export const memoryNotePatchSchema = z.object({
  type: memoryNoteTypeSchema.optional(),
  status: memoryNoteStatusSchema.optional(),
  modes: z.array(memoryModeSchema).optional(),
  scope: memoryScopeSchema.optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(memoryLinkSchema).optional(),
  sections: memorySectionsSchema.optional(),
});

export const memoryListOptionsSchema = z.object({
  status: memoryNoteStatusSchema.optional(),
  types: z.array(memoryNoteTypeSchema).optional(),
  modes: z.array(memoryModeSchema).optional(),
  scope: memoryScopeSchema.partial().optional(),
  tags: z.array(z.string()).optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).optional(),
});

export const memoryEventTargetSchema = z.object({
  kind: z.enum(["note", "section", "manifest", "vault"]),
  id: z.string().optional(),
  section: z.string().optional(),
});

export const memoryEventSchema = z.object({
  ts: z.string(),
  type: memoryEventTypeSchema,
  target: memoryEventTargetSchema,
  field: z.string().optional(),
  old: z.unknown().optional(),
  newValue: z.unknown().optional(),
  cause: z.string().optional(),
  turn: z.number().int().optional(),
  mode: memoryModeSchema.optional(),
  scope: memoryScopeSchema.optional(),
});

export const memoryEventDraftSchema = memoryEventSchema.extend({
  ts: z.string().optional(),
});

export const memoryManifestFileSchema = z.object({
  path: z.string(),
  hash: z.string(),
  bytes: z.number().int().min(0),
  updatedAt: z.string().optional(),
});

export const memoryManifestSchema = z.object({
  version: z.string(),
  embeddingModel: z.string().nullable(),
  generatedAt: z.string(),
  vaultHash: z.string(),
  files: z.array(memoryManifestFileSchema),
});

export const memoryValidationIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  path: z.string(),
  message: z.string(),
});

export const memoryValidationReportSchema = z.object({
  ok: z.boolean(),
  issues: z.array(memoryValidationIssueSchema),
  staleIndexes: z.boolean(),
  counts: z.record(z.number()),
});

export const memoryRebuildRequestSchema = z.object({
  force: z.boolean().optional(),
  embeddingModel: z.string().nullable().optional(),
  noteIds: z.array(z.string()).optional(),
  scope: memoryScopeSchema.partial().optional(),
});

export const memoryRebuildResultSchema = z.object({
  noteCount: z.number().int().min(0),
  eventCount: z.number().int().min(0),
  reindexedNoteIds: z.array(z.string()),
  removedNoteIds: z.array(z.string()),
  manifest: memoryManifestSchema,
  warnings: z.array(z.string()),
});

export const memoryLayoutInfoSchema = z.object({
  version: z.string(),
  rootPath: z.string(),
  notesPath: z.string(),
  eventsPath: z.string(),
  manifestPath: z.string(),
  indexesPath: z.string(),
});

export type MemoryNoteDraftInput = z.input<typeof memoryNoteDraftSchema>;
export type MemoryNotePatchInput = z.input<typeof memoryNotePatchSchema>;
export type MemoryEventDraftInput = z.input<typeof memoryEventDraftSchema>;
export type MemoryListOptionsInput = z.input<typeof memoryListOptionsSchema>;
export type MemoryRebuildRequestInput = z.input<typeof memoryRebuildRequestSchema>;
