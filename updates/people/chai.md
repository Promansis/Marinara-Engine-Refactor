# Chai

## Current Work

- Chat smoke testing for the first recommended app area.
  - Status: In review / blocked at real-provider boundary
  - Last updated: 2026-05-19
  - Current path: desktop app via `pnpm tauri dev`, Connections setup flow after the upstream no-connections gate fix.
  - Result: fixed and verified the Create Connection dialog layout bug; connection creation now works at the default desktop window size.
  - Next step: continue Chat generation smoke only with a valid provider key; without one, Chat remains at the expected provider-auth boundary.

## Owned Bugs

## Create Connection dialog action row starts outside the clickable modal area

- Status: Locally verified
- Owner: Chai
- Impact area: UI
- Reported: 2026-05-19
- Last updated: 2026-05-19

### Steps

1. Run the desktop app with `pnpm tauri dev`.
2. Open the Connections panel.
3. Click `Add Connection`.
4. Enter a connection name.
5. Try to create the connection at the default desktop window size.

### Expected

The action row should be visible and clickable without requiring hidden scrolling at the default desktop window size.

### Actual

The dialog content is taller than the visible modal area at the default desktop window size, so the `Cancel` and `Create` actions start below the panel. Clicking where the offscreen `Create` button would be hits the modal backdrop instead.

### Notes

- Screenshot: `docs/pr-evidence/create-connection-modal-layout/before.png`
- Fix: widened the Create Connection modal and switched the provider grid to a progressive 2/3/4-column layout so the action row is visible at 800x600.
- Fixed-state screenshot: `docs/pr-evidence/create-connection-modal-layout/after.png`
- Verification: created `Chai Smoke Connection`; the connection appeared in the Connections panel and opened its detail editor.
- Baseline: `pnpm check` passed.

## Status Notes

- Upstream `origin/main` includes Mari's fix for the Chat setup bug originally documented in `updates/unowned-bugs.md`: the no-connections chat modal's `Open Connections` CTA opened the Connections panel but left the modal blocking interaction.
- Chai independently verified the fixed path in the desktop app: clicked `New Conversation`, clicked `Open Connections`, confirmed the setup modal disappeared, clicked `Add Connection`, and reached the `Create Connection` dialog.
- Screenshot for the finding: `scratch/step2-chat-open-connections-modal-blocker.png`.
- Fixed-state screenshot: `scratch/fix-open-connections-modal-after.png`.
- Browser-only fallback is not sufficient for Chat smoke testing because `window.__TAURI__` is absent and storage/Tauri capabilities are required.
- Follow-up smoke path around the bug: created `Smoke Test Connection`, selected it in new chat setup, selected Professor Mari, clicked `Start Chatting`, sent `Smoke test after setup`, and saw the expected provider boundary error: `Provider returned HTTP 401 Unauthorized: Missing bearer or basic authentication in header`.
- Screenshot for the follow-up smoke: `scratch/step2-chat-after-dummy-send.png`.
