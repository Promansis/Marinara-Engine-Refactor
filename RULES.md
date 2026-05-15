# Marinara Refactor Rules

Read this before changing code. This repo starts as a fresh Tauri shell and will receive the existing Marinara app through small, reviewed slices.

## Core Direction

- Frontend: move and lightly reorganize the existing React UI. Do not rewrite or redesign it unless the human approves that exact slice.
- Backend: rebuild backend responsibilities in Rust/Tauri, using complete vertical slices when feasible.
- Releases: no release milestone exists until the full app is rebuilt. Incremental work is only for review and testing.
- Team fit: Rust should be minimal, explicit, and approachable for a JavaScript-heavy team.

## Hard Rules

1. No temporary functionality: no fake commands, mock APIs, fake persistence, no-op success states, or compatibility shims.
2. No old server-code copy as a shortcut.
3. No silent feature removal. Move, map, defer, or get explicit approval to remove.
4. No central contracts crate. Domain crates own frontend-facing DTOs; TypeScript bindings are generated from those DTOs.
5. No SQLite or other database for local desktop data. Use raw file storage only, and do not implement legacy SQLite import.
6. Preserve the current file-native layout: `storage/manifest.json` and `storage/tables/*.json` stay readable unless a documented migration says otherwise.
7. Secrets stay in Rust-owned safe storage. Preserve the copied key-entry UX unless a specific UX change is approved.
8. Provider/authenticated network calls must go through Rust commands/services, not React hooks.
9. Generation streaming uses Tauri commands plus typed events, not HTTP/SSE shims.
10. Agent/custom-tool execution and the Rust permission model must be implemented in the same module slice.
11. Sync is the final major module. Do not implement it before the local-first app and core backend are stable.

## Slice Workflow

Work in small slices. Do not move or rewrite multiple feature areas at once.

Preferred implementation order:

1. App shell and bootstrap.
2. Shared styles, UI primitives, and backend-free utilities.
3. One small visible UI surface at a time.
4. Assets only when the UI slice that uses them moves.
5. Backend vertical slices: storage, DTOs, commands, services, security, events, frontend hook adaptation, inventory updates, and tests.
6. Sidecar and integrations after core app behavior.
7. Sync last.

## Required Review Handoff

Every implementation slice must stop for human review and include:

1. What changed.
2. Source inventory items moved, mapped, deferred, or removed with approval.
3. What is intentionally non-functional.
4. Command to run.
5. Where to click or test.
6. Expected visual or behavioral result.
7. Files or areas to inspect.
8. Tests run.
9. One explicit question: change this slice or continue?

Do not continue to the next slice until the human responds.

## Ownership Summary

`src/app` owns bootstrap, providers, shell layout, and app-level composition.

`src/shared` owns reusable UI primitives, generic hooks, shared styles/utilities, generated bindings, and final-shape API wrappers.

`src/features/<feature>` owns feature components, hooks, stores, local types, and helpers.

Rust owns persistence, filesystem access, secrets, provider calls, prompt/generation orchestration, agent/tool execution, imports/backups, sidecar/process management, integrations, updates, and security checks.

Tauri commands stay thin: validate input, call services, map errors, return DTOs. Domain crates must not import `tauri`.

## Source Inventory

Every slice must update source inventory status for touched source files from `E:/Personal Projects/Marinara-Engine`.

Frontend inventory includes components, hooks, stores, frontend libs, styles, and public assets.

Backend inventory includes routes, services, storage modules, schema/source metadata, shared types/schemas/constants/utilities, server assets, scripts, platform integrations, and behavioral tests.
