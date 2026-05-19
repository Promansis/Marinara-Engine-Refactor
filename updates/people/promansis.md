# Promansis

## Current Work

- Spotify setup redirect URI instructions
  - Status: Ready for review on `fix/spotify-redirect-uri-setup`
  - Impact area: Spotify agent setup UI, native Spotify OAuth capability contract
  - Next step: Review the focused local commit and manually confirm the Spotify setup copy in the agent editor.
  - Blockers: None.

## Owned Bugs

## Spotify setup tells users to set a redirect URI env var that native auth ignores

- Status: Ready for review on `fix/spotify-redirect-uri-setup`
- Owner: Promansis
- Impact area: UI | Rust capability
- Reported: Local backlog item 20
- Last updated: 2026-05-19

### Steps

1. Open the Spotify DJ agent setup.
2. Read the Spotify redirect URI instructions.

### Expected

The setup instructions should describe the redirect URI that native Spotify auth actually uses.

### Actual

The setup copy told users they could set `SPOTIFY_REDIRECT_URI` to an HTTPS URL, but the frontend status and Rust OAuth flow use the fixed loopback callback.

### Notes

- Owner is the Spotify agent setup UI copy, with the Rust Spotify OAuth callback contract reviewed as the dependent capability.
- Fixed by documenting the supported loopback redirect URI and paste-back fallback instead of advertising an unsupported environment override.
- Verification: `pnpm typecheck`; `cargo check --manifest-path src-tauri/Cargo.toml`.

## Status Notes

No status notes currently listed.
