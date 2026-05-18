# Engine Migration Checklist

This file tracks the full Marinara Engine migration into the Tauri refactor. Keep it updated after every migration pass.

Last updated: 2026-05-18.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Moved/wired
- `[d]` Deferred by scope

## Architecture Anchors

- [x] Confirmed top-level modes are `chat`, `roleplay`, and `game`.
- [x] Confirmed conversation/autonomous is a chat subsystem under `engine/modes/chat`.
- [x] Confirmed sidecar and sync-client are deferred external-service scope.
- [~] Create `src/engine` layers from `docs/tauri-refactor/14-layered-module-architecture.md`.
- [x] Replace server-stub frontend API with Tauri-backed API adapter.
- [~] Build Rust capability commands for storage, assets/imports, LLM transport, integrations, and updates.
- [x] Removed direct browser `fetch('/api/...')` calls for local Fastify routes; local app calls now go through Tauri API adapters or local TypeScript helpers.
- [x] Removed remaining active source `fetch()` calls; non-API blob loading no longer uses browser fetch.
- [x] Removed sidecar from active onboarding, agent, connection, and game scene UI; sidecar and sync remain deferred scope only.

## TypeScript Engine Layers

- [x] Layer 0: `src/engine/contracts` from `packages/shared/src`.
- [x] Layer 0: `src/engine/core` primitives.
- [x] Layer 1: `src/engine/capabilities` TypeScript ports.
- [x] Layer 2: `src/engine/shared` pure helpers.
- [ ] Layer 3: `src/engine/entities` pure entity operations.
- [x] Layer 4: `src/engine/repositories` capability-backed repositories.
- [~] Layer 5: `src/engine/generation-core` prompt, lorebook, regex, LLM DTO helpers.
- [~] Layer 6: `src/engine/agents-runtime` agent executor, pipeline, knowledge, and tools.
- [~] Layer 7: `src/engine/generation` generation orchestration and stream event DTOs.
- [~] Layer 8: `src/engine/modes/chat` chat core, autonomous, awareness, schedules, commands.
- [~] Layer 8: `src/engine/modes/roleplay` scene, sprites, encounter, visual-novel.
- [~] Layer 8: `src/engine/modes/game` turn, prompts, mechanics, state, world, assets.

## Rust Capability Layers

- [ ] `src-tauri/src/app.rs` capability graph.
- [x] `src-tauri/src/state.rs` shared state.
- [x] `src-tauri/src/commands/mod.rs` command registration.
- [x] `src-tauri/src/commands/storage.rs` command facade split into capability modules under `src-tauri/src/commands/storage/`.
- [~] `src-tauri/src/commands/assets.rs` asset commands; currently routed through the storage command shim and `marinara-assets`.
- [x] Import commands: character JSON/PNG/CharX, native `.marinara` packages, lorebooks, presets, personas, JSONL chat imports, native folder picking, ST bulk scan/run, current-format media restore, folder/group remapping, and current Marinara/ST heuristic handling are routed through native storage.
- [ ] `src-tauri/src/commands/llm.rs` provider transport commands.
- [ ] `src-tauri/src/commands/integrations.rs` integration commands.
- [ ] `src-tauri/src/commands/updates.rs` update commands.
- [ ] `src-tauri/src/events/mod.rs` event names/helpers.
- [x] `src-tauri/crates/core` paths, IDs, errors, timestamps.
- [x] `src-tauri/crates/security` path and outbound policy helpers.
- [x] `src-tauri/crates/storage` raw file storage and atomic writes.
- [x] `src-tauri/crates/assets` file/blob/media handling for managed game assets and backgrounds.
- [~] `src-tauri/crates/import` import file helpers.
- [x] `src-tauri/crates/llm` provider transport.
- [x] `src-tauri/crates/integrations` Spotify, TTS, translation, and haptic transport are wired through native commands.
- [x] `src-tauri/crates/updates` update check/apply planning.
- [d] `src-tauri/crates/sidecar` deferred external-service scope.
- [d] `src-tauri/crates/sync-client` deferred external-service scope.
- [d] `src-tauri/crates/sync-protocol` deferred until sync returns.

## Original Source Coverage

- [x] `packages/shared/src/constants`
- [x] `packages/shared/src/schemas`
- [x] `packages/shared/src/types`
- [x] `packages/shared/src/utils`
- [~] `packages/server/src/services/prompt`
- [~] `packages/server/src/services/lorebook`
- [x] `packages/server/src/services/regex`
- [~] `packages/server/src/services/agents`
- [~] `packages/server/src/services/tools`
- [~] `packages/server/src/routes/generate`
- [~] `packages/server/src/services/conversation`
- [~] `packages/server/src/services/game`
- [~] `packages/server/src/services/llm`
- [~] `packages/server/src/services/image`
- [~] `packages/server/src/services/spotify`
- [~] `packages/server/src/services/import`
- [~] `packages/server/src/services/storage`
- [ ] `packages/server/src/db`
- [ ] `packages/server/src/routes`
- [ ] `packages/server/src/utils`
- [ ] `packages/server/src/middleware`
- [d] `packages/server/src/services/sidecar`
- [~] `packages/client/src/components`
- [~] `packages/client/src/hooks`
- [~] `packages/client/src/lib`
- [~] `packages/client/src/stores`
- [~] `packages/client/src/styles`

## 2026-05-17 Migration Pass

- [x] Replaced remaining direct local Fastify browser fetches with Tauri-backed API helpers or local asset URL resolution.
- [x] Added managed local file URL handling for backgrounds and game assets through Tauri asset protocol paths.
- [x] Wired character, persona, preset, lorebook, connection, chat, gallery, backup, import, knowledge-source, bot-browser, GIF, and prompt-review utility frontend paths away from deferred throwing API shims.
- [x] Added Tauri-backed chat gallery and character gallery upload/list/delete storage.
- [x] Added Tauri-backed default Pollinations image test and avatar generation route, plus NPC avatar upload persistence.
- [x] Hid active sidecar model controls from onboarding, agents, connections, and game scene setup/runtime surfaces.
- [~] Added local new-app backup/import/profile routes with ZIP download payloads, profile JSON restore, and compatible exports; legacy backup/profile/archive compatibility is intentionally not handled in runtime code.
- [~] Added Chub, Janny, CharacterTavern, Pygmalion, Wyvern, DataCat, and Chartavern bot-browser routes behind Rust transport; authenticated-session behavior now validates stored credentials for Pygmalion and Chartavern, but exact upstream parity still needs live-provider QA.

## 2026-05-18 Migration Pass

- [x] Split the previous monolithic native storage route shim into focused modules (`router`, `shared`, `chats`, `imports`, `bulk_imports`, `llm`, assets, integrations, and related capability slices). Product-owned game/encounter/conversation orchestration has been moved out of Rust routes.
- [x] Added visible error toasts to create connection, character, persona, and preset modals so failed native calls no longer look like dead sidebar buttons.
- [x] Reworked import routes for the sidebar/settings import flows: ST character inspect/batch now returns the frontend shape, PNG character-card metadata is parsed from `chara`/`ccv3` chunks, CharX reads `card.json` and embedded icons, and native `.marinara` packages read `data.json` plus avatar assets.
- [x] Added native JSONL chat import and branch import routes used by the chat/settings import UI.
- [x] Added local SillyTavern folder browsing response shape plus basic ST bulk scan/run for characters, chats, group chats, presets, lorebooks, backgrounds, and personas.
- [x] Replaced game/encounter route placeholders with local Tauri mechanics for dice, skill checks, time/weather, random encounters, combat rounds, loot, journal entries, checkpoints, party cards, map movement, encounter init/action/summary, LLM-backed setup/session carryover/conclusion, and generated game image/audio orchestration.
- [x] Replaced chat/agent no-op route responses for autonomous unread state, LLM-backed summaries/consolidation, memory chunks, agent memory, echo-message cleanup, retry bookkeeping, cadence status, generated schedules, autonomous timing, and conversation schedule/status checks with migrated TypeScript orchestration over Tauri storage/LLM capabilities.
- [x] Normalized lorebook imports into lorebook rows plus `lorebook-entries`, including current-format category/tag handling and new-app media/profile packaging.
- [x] Replaced haptic placeholders with the open-source Rust `buttplug` client package, Intiface websocket connect/disconnect, scan, device listing, output commands, auto-stop, and stop-all routes.
- [~] Replaced TTS placeholders with native provider transport for OpenAI-compatible, ElevenLabs, NanoGPT ElevenLabs, and PocketTTS voice/audio routes; browser playback remains frontend-owned.
- [~] Replaced Spotify placeholders with OAuth, token refresh, status, access-token, player, devices, playlists, playback controls, DJ playlist, and game scene candidate/play routes over native Spotify Web API transport.
- [x] Added native font listing/file serving/folder opening and Google font download routes; App startup injects local font faces through Tauri asset URLs.
- [x] Added native translation route for Google, DeepL, DeepLX, and AI-backed translation.
- [x] Added lorebook vectorization route using configured embedding connections and persisted entry embeddings.
- [x] Replaced bulk character/persona/preset/lorebook export JSON responses with ZIP binary download payloads, and replaced character PNG export placeholder with an embedded `chara` PNG card.
- [x] Replaced avatar upload echo routes with local avatar persistence for characters, personas, and NPC portraits while keeping frontend-compatible avatar paths.
- [x] Replaced persona activation, prompt default, chat-preset active, regex reorder, game-assets rescan/open-folder/folder-description, scoped admin expunge, and character-version restore placeholders with storage-backed behavior.
- [x] Replaced game setup, session lorebook regeneration, session recap/carryover/conclusion, and campaign progression stubs with LLM-backed native flows plus deterministic local fallbacks where provider calls fail.
- [x] Removed active `/game`, `/encounter`, `/conversation`, `/agents/retry`, and `/sidecar` frontend product-route calls; normal mode workflows now use TypeScript mode APIs over storage/assets/LLM/integration capabilities.
- [x] Split shared chat/message repository hooks, common chat components, and chat UI types into neutral `src/features/chats`, so conversation, roleplay, and game mode code no longer depend on `features/conversation`.
- [x] Wired custom static/webhook tools into the migrated agent runtime through native `/custom-tools/execute`; script execution remains explicitly disabled in the native runtime.
- [x] Expanded native image-provider parity: OpenAI/GPT image edits, NanoGPT, Together, Stability v1/v2, Horde, ComfyUI reference uploads, RunPod Serverless ComfyUI, Draw Things/A1111 img2img, NovelAI raw references/ZIP/image responses, OpenRouter/Gemini chat image parsing, xAI aspect-ratio payloads, transparent-background options, and selected image connection use for sprite generation are wired.
- [x] Removed active settings copy that presented theme/extension data as server-synced runtime behavior; sync remains deferred scope.
- [x] Removed runtime legacy asset URL compatibility and added the no-legacy-runtime rule to `AGENTS.md`; old data conversion will be a separate migration script.
- [x] Removed browser-era custom theme/extension migration hooks, stale settings-sync/CSRF files, and sessionStorage draft migration fallbacks.
- [x] Replaced the historical UI-store `migrate` chain with a fresh Tauri persistence key, and split `ui.store.ts` into focused store, model/helper, and persistence modules.
- [x] Deleted sidecar-only frontend store/modal/contracts from the active TypeScript app and moved active scene-analysis contracts into neutral scene types.
- [x] Moved bot-browser provider parity behind Rust transport for Janny token refresh, CharacterTavern cookies/filters, Pygmalion token/session cleanup, Wyvern creator routes, DataCat session minting, and provider asset validation.
- [x] Rebuilt current-format imports/exports for Marinara character/persona/lorebook/preset envelopes, SillyTavern-compatible exports, embedded character media, sprite/gallery restore, prompt group/section remapping, and embedded lorebook pointer cleanup.
- [x] Replaced prompt-review fallback assembly with full preset/section/group/choice-block orchestration over migrated storage and LLM streaming.
- [x] Removed duplicate API re-export shims, deleted conversation-mode re-export wrappers, removed active sidecar/sync runtime branches, removed active legacy runtime compatibility paths, and kept old-data conversion out of normal app code.

## Remaining External QA

- [ ] Run live-account QA for upstream bot-browser providers that require credentials or are subject to Cloudflare/session policy changes.
- [ ] Run live-provider QA across paid image providers, TTS providers, Spotify accounts/devices, and physical Buttplug/Intiface hardware. Native code paths are wired; these checks require external services/devices.
- [ ] Run full manual Tauri UI smoke testing for imports/exports, sprite cleanup/restore, long-running game sessions, and autonomous scheduling with real user data. No source-level placeholder or old local-server blocker is currently known outside deferred sidecar/sync.

## Verification

- [x] `pnpm typecheck` passed on 2026-05-17.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-17.
- [x] `pnpm check:docs` passed on 2026-05-17.
- [x] `pnpm build` passed on 2026-05-17 with Vite large-chunk warnings only.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-18 after storage/import split.
- [x] `pnpm typecheck` passed on 2026-05-18.
- [x] `pnpm build` passed on 2026-05-18 with Vite large-chunk warnings only.
- [x] `pnpm check:docs` passed on 2026-05-18.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-18 after haptic, export, avatar, vectorization, game-assets, admin, and game workflow patches.
- [x] `pnpm typecheck` passed on 2026-05-18 after deferred sidecar UI cleanup.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-18 after image-provider parity expansion.
- [x] `pnpm typecheck` passed on 2026-05-18 after conversation-data split.
- [x] `pnpm build` passed on 2026-05-18 after conversation-data split and active sync-copy cleanup.
- [x] `pnpm typecheck` passed on 2026-05-18 after no-legacy-runtime/UI-store cleanup.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-18 after no-legacy-runtime/UI-store cleanup.
- [x] `pnpm check:docs` passed on 2026-05-18 after no-legacy-runtime/UI-store cleanup.
- [x] `pnpm build` passed on 2026-05-18 after no-legacy-runtime/UI-store cleanup, with Vite large-chunk warnings only.
- [x] `pnpm typecheck` passed on 2026-05-18 after full source migration parity and mode-separation cleanup.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml` passed on 2026-05-18 after full source migration parity and mode-separation cleanup.
- [x] `pnpm check:docs` passed on 2026-05-18 after full source migration parity checklist update.
- [x] `pnpm build` passed on 2026-05-18 after full source migration parity and mode-separation cleanup, with Vite large-chunk warnings only.
