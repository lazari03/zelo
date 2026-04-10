# Zelo Build Log

This file documents every major feature/task completed in the project, in order. Update this file after each significant change.

---

## [2026-04-10] Initial Build Log Created
- Build log initialized. All future tasks will be recorded here.

## [2026-04-10] Instagram Connect Flow & Dashboard Improvements

- Added `FIRESTORE_RULES.md` for secure Firestore access.
- Planned and started implementation of Instagram OAuth connect flow.
- Dashboard will allow users to connect Instagram, view inbox, stats, and toggle AI takeover.
- All dashboard features will be responsive and match the current theme.
- Next: Implement the Instagram OAuth endpoint and UI integration.

## [2026-04-10] Instagram OAuth Endpoint & Dashboard Button
- Added /api/auth/instagram and /api/auth/instagram/callback endpoints for OAuth flow.
- Updated dashboard: Connect Instagram button now links to OAuth endpoint, styled and responsive.
- Next: Implement callback logic to save connected account and show connected accounts, inbox, stats, and AI toggle.

## [2026-04-10] Instagram OAuth Callback Logic
- Implemented code exchange, page and IG business account fetch, and Firestore save in /api/auth/instagram/callback.
- Next: Update dashboard to show connected accounts, inbox, stats, and AI toggle.

## [2026-04-10] Dashboard: Connected Accounts, AI Toggle, Inbox/Stats
- Dashboard now displays all connected Instagram accounts for the user.
- Each account card shows page name, connection status, AI on/off toggle, inbox, and stats links.
- Fully responsive and visually consistent with the theme.
- Next: Implement inbox and stats pages per account.
