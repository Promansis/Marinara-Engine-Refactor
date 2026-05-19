# Promansis

## Current Work

### Stored generation replay metadata is not applied on replay/regenerate

- Status: In progress
- Owner: Promansis
- Impact area: Generation | prompts | agents | provider boundary
- Likely root cause: Regenerate requests never reapply stored `message.extra.generationReplay` before `startGeneration` assembles prompt and request state.
- Files likely to change: `src/features/generation/hooks/use-generate.ts`, possibly `src/engine/generation/generation-replay.ts` if request shaping needs a helper adjustment.
- Checks planned: `pnpm typecheck`

## Owned Bugs

No owned bugs currently listed.

## Status Notes

No status notes currently listed.
