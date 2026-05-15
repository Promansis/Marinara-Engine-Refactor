# Sync Server And Docker Deployment

The Tauri app should remain local-first. The sync server is optional infrastructure for users who want multiple Marinara installs to share chats, characters, files, settings, and generated assets across devices.

Sync is the final major refactor module. Do not implement it before the local-first app, file storage, core features, imports/assets, integrations, sidecar, and hardening are stable. Earlier phases should only keep storage sync-friendly through stable IDs, timestamps, manifest versions, and clear blob references.

## Design Goal

The sync server is not the primary app backend. It is a self-hosted relay and storage endpoint:

- Tauri desktop app works offline.
- Local data remains the source of truth on each device.
- Sync server stores encrypted metadata changes and file blobs.
- Docker deployment provides easy hosting for users who previously ran Marinara as a container.
- Conflict handling is deterministic and visible when automatic merge is unsafe.

## Recommended Stack

```text
Docker Compose
  sync-api       Rust/Axum REST + WebSocket API
  postgres               Sync metadata, users, devices, manifests
  object-storage         Local filesystem by default, optional S3/MinIO
  redis                  Optional rate limit, queues, websocket fanout
```

Use a single-container mode first:

```text
sync-api
  /data/metadata for raw file metadata
  /data/blobs for object files
```

Then support production Compose:

```text
api + postgres + minio + redis
```

## Why Local-First Instead Of Server-Authoritative

The current app has large local domains: chats, game state, images, avatars, model settings, sidecar files, imports, and generated media. Making Docker the only authority would make the desktop app dependent on a server and would break offline use.

Local-first sync lets each Tauri install keep working and later reconcile changes. Automerge is a strong research candidate because its Rust crate provides a JSON-like CRDT plus a sync protocol that works over reliable ordered transports. Automerge Repo also documents the sync-server concept over WebSockets. See [Automerge Rust docs](https://docs.rs/automerge/latest/automerge/) and [Automerge network sync](https://automerge.org/docs/tutorial/network-sync/).

## Sync Data Classes

### CRDT-Friendly Metadata

Use CRDT or append-only operation logs for:

- chats
- messages
- message swipes
- folders
- characters
- personas
- lorebooks
- prompt presets
- chat presets
- regex scripts
- custom tools metadata
- app settings
- theme metadata
- game journal
- game inventory
- game session notes

### Last-Writer-Wins With Version History

Use LWW plus revision history for:

- connection configuration without API keys
- generation parameters
- UI preferences
- active persona
- active preset
- haptic settings
- TTS settings
- translation settings
- sidecar settings

### Blob Sync

Use content-addressed blobs for:

- avatars
- gallery images
- generated images
- backgrounds
- sprites
- character card PNGs
- imports and exports
- TTS cache entries if user opts in
- game music and SFX user uploads

Do not sync:

- provider API keys by default
- OAuth refresh tokens by default
- local sidecar model binaries by default
- temporary logs
- generated sidecar runtime installs

## Sync Server Rust Workspace

Add a separate deployable binary:

```text
sync-server/
  Cargo.toml
  Dockerfile
  docker-compose.yml
  migrations/
  src/
    main.rs
    app.rs
    state.rs
    config.rs
    error.rs
    routes/
      mod.rs
      auth.rs
      devices.rs
      sync.rs
      blobs.rs
      snapshots.rs
      health.rs
    services/
      auth_service.rs
      device_service.rs
      sync_service.rs
      blob_service.rs
      snapshot_service.rs
      retention_service.rs
    storage/
      mod.rs
      postgres.rs
      file_metadata.rs
      object_store.rs
      local_files.rs
      s3.rs
    sync/
      mod.rs
      protocol.rs
      changes.rs
      conflicts.rs
      crdt.rs
      cursor.rs
    security/
      password.rs
      tokens.rs
      rate_limit.rs
      tenancy.rs
    openapi.rs
```

## Tauri Client Sync Modules

```text
src-tauri/crates/sync-client/
  src/
    lib.rs
    config.rs
    client.rs
    auth.rs
    device.rs
    websocket.rs
    upload.rs
    download.rs
    change_log.rs
    conflict.rs
    scheduler.rs
```

Frontend:

```text
src/features/sync/
  components/
    SyncSettingsPanel.tsx
    SyncStatusIndicator.tsx
    ConflictReviewPanel.tsx
    DeviceList.tsx
  hooks/
    useSyncStatus.ts
    useSyncSettings.ts
    useSyncConflicts.ts
  stores/
    sync.store.ts
```

## Sync Protocol

### Initial Pairing

1. User deploys sync server.
2. User creates an account or invite token.
3. Tauri app opens Sync Settings.
4. User enters server URL and pairing token.
5. Rust client registers a device.
6. Server returns device ID and scoped access token.
7. Tauri stores token in OS keychain.

### Normal Sync Loop

```text
local change -> local repository write -> append sync operation
sync scheduler wakes -> push operations -> server validates -> server stores
server broadcasts heads -> client pulls missing operations -> local merge
blob references missing -> client uploads/downloads content-addressed blobs
```

### Offline Behavior

- Local writes never block on server availability.
- Failed pushes remain queued.
- Pull resumes from last acknowledged cursor.
- Blob uploads can retry independently from metadata changes.

### Conflict Rules

Use automatic merge where safe:

- appended messages merge by timestamp and stable sequence ID
- independent character field edits merge by field
- lorebook entry edits merge by entry ID
- settings use LWW with revision history

Require review where unsafe:

- same message edited on two devices
- same character description edited on two devices
- same prompt section edited on two devices
- same game state branch advanced independently

## Sync Server API

### REST Endpoints

```text
GET  /health
POST /auth/login
POST /auth/device-pair
POST /auth/refresh
GET  /devices
DELETE /devices/:device_id

POST /sync/push
POST /sync/pull
GET  /sync/heads
POST /sync/ack

POST /blobs/init
PUT  /blobs/:hash
GET  /blobs/:hash
HEAD /blobs/:hash
DELETE /blobs/:hash

POST /snapshots/upload
GET  /snapshots/latest
POST /snapshots/restore
```

### WebSocket

```text
GET /sync/ws
```

Message types:

```text
hello
heads
push_changes
pull_changes
blob_needed
conflict
ack
ping
error
```

## Data Model

### PostgreSQL Tables

```text
users
devices
device_tokens
sync_collections
sync_changes
sync_heads
blob_objects
blob_refs
snapshots
conflicts
audit_events
```

### Collections

```text
chat
message
character
persona
lorebook
prompt
preset
agent
game
asset
settings
theme
extension
integration
```

Each change stores:

- collection
- entity ID
- operation ID
- device ID
- Lamport timestamp or hybrid logical clock
- parent heads
- encrypted payload
- blob refs
- schema version

## Encryption And Privacy

Recommended default:

- server authenticates users and devices
- metadata payloads can be end-to-end encrypted later
- provider API keys and OAuth refresh tokens do not sync by default
- blob encryption is optional at first, then per-account encryption key later

Do not store raw provider keys in the sync server. If users explicitly opt into secret sync later, use client-side encryption and device recovery codes.

## Docker Compose Targets

### Simple Mode

```text
sync-api:
  image: ghcr.io/pasta-devs/sync-api:latest
  ports:
    - "127.0.0.1:7870:7870"
  volumes:
    - sync-data:/data
```

### Production Mode

```text
services:
  api:
    image: ghcr.io/pasta-devs/sync-api:latest
    depends_on:
      - postgres
      - minio
      - redis
  postgres:
    image: postgres:16-alpine
  minio:
    image: minio/minio
  redis:
    image: redis:7-alpine
```

MinIO is a common self-hosted S3-compatible object store and works well as an optional blob backend. See [MinIO self-hosted S3 guide](https://kx.cloudingenium.com/en/minio-s3-compatible-object-storage-self-hosted-guide). The server should also support local filesystem blobs so users are not forced into a multi-service deployment.

## Server Crates

Recommended crates:

- `axum` for HTTP and WebSocket API.
- `tower-http` for tracing, CORS, compression, request limits.
- `sqlx` for PostgreSQL in production mode.
- `utoipa` for generated OpenAPI docs.
- `reqwest` only for outbound callbacks if needed.
- `argon2` for password hashing.
- `jsonwebtoken` or `paseto` for tokens.
- `automerge` for CRDT experiments.
- `object_store` or AWS S3-compatible client for blob storage abstraction.

Axum is designed around Tokio, Hyper, and Tower middleware. See [Axum docs](https://doc.cuprate.org/axum/index.html). Utoipa generates OpenAPI documentation from Rust code. See [Utoipa docs](https://docs.rs/utoipa/latest/utoipa/).

## Sync Server Milestones

1. Single-user raw-file metadata and local-filesystem blob sync server.
2. Device registration and bearer auth.
3. Metadata push/pull for chats, messages, characters, settings.
4. Blob upload/download.
5. WebSocket heads broadcast.
6. Docker Compose simple mode.
7. Conflict review UI.
8. PostgreSQL backend for production mode.
9. S3/MinIO blob backend.
10. Multi-user accounts and invites.
11. End-to-end encrypted payload option.
