# Zelo — Build Progress

## Done

- [x] Firebase Auth — Google OAuth login/logout, session cookies
- [x] Instagram OAuth flow — uses Instagram Login (`instagram.com/oauth/authorize`), not Facebook dialog
- [x] Token exchange via `api.instagram.com/oauth/access_token`, long-lived via `graph.instagram.com/access_token`
- [x] Scopes: `instagram_business_basic,instagram_business_manage_messages`
- [x] Token refresh via `graph.instagram.com/refresh_access_token`
- [x] Webhook handler — Meta signature verification, incoming DM processing
- [x] AI auto-reply — OpenAI integration, per-conversation message history
- [x] Order detection — keyword matching (Albanian + English)
- [x] Daily analytics — message/conversation/order counters in Firestore
- [x] Dashboard overview — account cards, stats, AI toggle UI
- [x] Accounts page — connect / disconnect / refresh token
- [x] Conversations page — full thread view, search, order filter
- [x] Orders page — status management (pending → confirmed → completed → cancelled)
- [x] **Webhook page subscription** — auto-subscribes page to webhook after OAuth connect
- [x] **Token revocation on disconnect** — calls Meta's revocation endpoint before deleting from Firestore
- [x] **AI toggle persistence** — `aiEnabled` field on `InstagramAccount`; webhook skips AI (but still logs message) when off
- [x] **Token auto-refresh** — `POST /api/auth/meta/refresh` refreshes a 60-day token on demand; refresh button in accounts UI
- [x] **Removed legacy routes** — deleted `/api/auth/instagram/` (had `userId: "unknown"` bug); all OAuth now goes through `/api/auth/meta/callback`
- [x] **Dashboard connect button** — now links to `/dashboard/accounts` instead of broken legacy route

---

## Left To Do

- [ ] **Error recovery / retry queue** — Failed message sends are silently dropped. Add retry logic or log failures to Firestore for visibility.
- [ ] **Connection audit trail** — Log connect/disconnect/refresh events with timestamps for debugging.
- [ ] **i18n** — `lib/locale.ts` has a TODO; translation framework is incomplete.
