# Promansis

## Current Work

- Profile import leaves stale asset files behind.
  - Status: In review
  - Next step: Ready for review on the focused bug-fix branch after Rust checks.
  - Blockers: None.

## Owned Bugs

### Profile import leaves stale asset files behind

- Status: In review
- Owner: Promansis
- Impact area: Rust capability
- Reported: 2026-05-19
- Last updated: 2026-05-19

#### Notes

The local-only bug backlog lists this as bug 2. The fix belongs to the Rust profile import capability because profile restore replaces storage collections and managed asset files as one native restore operation.

Resolved by validating and decoding imported asset payloads before mutation, clearing the managed profile asset directories, then writing only the imported profile assets. Invalid asset payloads now fail before existing managed files are removed.

## Status Notes

No status notes currently listed.
