# Research Notes

This document records current ecosystem research used for the architecture plan.

## Tauri Security

Tauri v2 uses a capabilities and permissions model to constrain what windows and webviews can access. Capability files live under `src-tauri/capabilities` and define permissions for windows or webviews. This supports the plan to keep the main app webview on narrow permissions and expose privileged work only through typed Rust commands.

Sources:

- [Tauri capabilities](https://v2.tauri.app/es/security/capabilities/)
- [Tauri capability reference](https://v2.tauri.app/fr/reference/acl/capability/)
- [Tauri permissions](https://v2.tauri.app/es/security/permissions/)

Tauri CSP should be explicitly configured. Tauri notes that CSP can reduce XSS impact and warns against remote scripts/CDNs. The refactor should replace the current `csp: null` with a strict policy.

Source:

- [Tauri CSP](https://v2.tauri.app/security/csp/)

## LLM Provider Abstraction

The app should define its own provider trait and use third-party crates behind that trait.

Candidates:

- `genai`: broad unified provider abstraction for OpenAI, Anthropic, Gemini, Ollama, Groq, DeepSeek, Cohere, and custom providers.
- `async-openai`: mature OpenAI and OpenAI-compatible client.
- `rig`: agent-oriented framework worth evaluating after Marinara's own agent pipeline is ported.

Keep provider-specific behavior in `llm/providers`, not in generation or command code.

Sources:

- [genai crate summary](https://socket.dev/cargo/package/genai)
- [async-openai docs](https://docs.rs/async-openai)
- [Rig](https://rig.rs/)

## Sidecar Runtime Candidates

Crane is a Rust/Candle inference engine that advertises LLM, VLM, TTS, OCR, and OpenAI-compatible server support. It may fit the sidecar strategy because it could replace old custom sidecar internals with an existing Rust runtime/package while preserving the current UI/UX.

Evaluate before adoption:

- Windows/macOS/Linux packaging
- CUDA/Metal/CPU support and binary size
- model coverage compared with current sidecar expectations
- OpenAI-compatible endpoint behavior
- TTS support maturity
- project maintenance risk

Source:

- [Crane GitHub repository](https://github.com/lucasjinreal/Crane)

## Local-First Sync And CRDTs

Automerge is a strong candidate for metadata sync experiments because its Rust crate provides a JSON-like CRDT, binary storage format, and sync protocol that can run over a reliable ordered transport. Automerge's docs also describe sync servers over WebSockets.

Important caveat: not every domain should be modeled as a CRDT immediately. Some Marinara domains can use append-only logs or LWW with revision history. Game state branches and prompt edits may need explicit conflict review.

Sources:

- [Automerge Rust crate](https://docs.rs/automerge/latest/automerge/)
- [Automerge sync module](https://docs.rs/automerge/latest/automerge/sync/index.html)
- [Automerge network sync](https://automerge.org/docs/tutorial/network-sync/)
- [Automerge repositories](https://automerge.org/docs/reference/repositories/)

## Sync Server Web Stack

Axum is a good Rust server candidate because it is modular, uses Tokio/Hyper, and integrates with Tower middleware. Tower HTTP provides middleware such as tracing and compression. Utoipa can generate OpenAPI 3.1 docs from Rust code.

Sources:

- [Axum docs](https://doc.cuprate.org/axum/index.html)
- [Tower HTTP compression docs](https://snix.dev/rustdoc/tower_http/compression/index.html)
- [Tower HTTP trace docs](https://snix.dev/rustdoc/tower_http/trace/struct.Trace.html)
- [Utoipa docs](https://docs.rs/utoipa/latest/utoipa/)

## Sync Server Storage

For Docker deployment:

- PostgreSQL is the recommended metadata database for production.
- Simple single-container mode should use raw metadata files, not SQLite.
- Local filesystem blobs should be supported first.
- S3-compatible blob storage should be optional.
- MinIO is a common self-hosted S3-compatible option.

Sources:

- [MinIO self-hosted S3 guide](https://kx.cloudingenium.com/en/minio-s3-compatible-object-storage-self-hosted-guide)
- [Rclone S3 docs](https://rclone.org/s3/)

## Type-Safe Boundaries

Use generated TypeScript bindings from Rust domain DTOs instead of duplicated hand-written TypeScript DTOs.

Candidates:

- `specta`
- `tauri-specta`
- `utoipa` for sync server REST/OpenAPI schemas

Sources:

- [Specta docs](https://docs.rs/specta)
- [tauri-specta docs](https://docs.rs/tauri-specta/latest/tauri_specta/index.html)
- [Utoipa docs](https://docs.rs/utoipa/latest/utoipa/)
