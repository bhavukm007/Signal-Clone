# Progress checklist

Status: `[ ]` pending, `[x]` completed. Final verification status is recorded in item 21.

1. [x] Make backend tests runnable and green using in-memory SQLite, TESTING lifespan gate, `pytest-timeout`, and TestClient REST/WebSocket; install frontend dependencies and pass lint/typecheck/build.
2. [x] Refactor backend into API → services → repositories → models; add all specified tables, schemas, constraints, indexes, and consistent errors.
3. [x] Implement durable hashed auth sessions with expiry and revocation, enforced on REST and WebSocket.
4. [x] Implement sent/delivered/read receipts, group aggregation, online/last-seen presence, typing, and WebSocket tests.
5. [x] Complete groups with server-side admin rules, system messages, broadcasts, and tests.
6. [x] Implement validated avatar and attachment uploads.
7. [x] Implement expiring messages, cancellable purger, deletion broadcast, and tests.
8. [x] Complete idempotent seed script with 8–10 users, demo accounts, contacts, varied DMs/groups/statuses.
9. [x] Refactor frontend into the specified app/components/hooks/stores/lib/types layout with theme tokens.
10. [x] Complete welcome/register/verify/profile flow, persisted auth guard, profile avatar, settings logout.
11. [x] Complete conversation list, debounced conversation/contact search, compose flows, unread/pin/mute/presence states.
12. [x] Complete chat view: realtime, grouped/date-separated messages, receipts, typing, pagination, scroll behavior, optimistic sends, header, encryption placeholder.
13. [x] Complete group create/info/member administration UI.
14. [x] Complete settings sections, coming-soon flows, toasts.
15. [x] Complete attachments, reactions, replies, disappearing UI, responsive layouts, shortcuts.
16. [x] Pixel polish and accessibility pass against specified tokens and layout.
17. [x] Script and pass two-account end-to-end smoke flow including realtime, groups, receipts, and restart persistence.
18. [x] Finalize Render/Vercel config and write beginner deployment guide.
19. [x] Finalize README with architecture, schema, API/WS tables, state machine, checklist, assumptions, limitations, deployment, tests.
20. [x] Add plain-language module explanations and 15 interview questions/answers.
21. [x] Final lint, typecheck, backend tests, frontend build, smoke checks; remove dead code and record each verification truthfully.

## Verification log

- Item 1: `python -m pytest -x -q` passed six tests with an in-process TestClient WebSocket ping. `npm ci`, lint, strict typecheck, and production build passed on the initial frontend.
- Item 2: `python -m compileall -q app tests` passed; backend suite passed after modularization. OpenAPI and table coverage are tested.
- Item 3: backend tests cover token hash-at-rest, expiry, REST logout, and revoked WebSocket rejection.
- Item 4: backend tests cover `sent → delivered → read`, presence transitions, typing, pending delivery on reconnect, and multiple tabs.
- Item 5: backend tests cover admin denial, promotion, add/remove/leave, system message persistence, and live broadcast.
- Item 6: backend tests cover MIME rejection, file serving, uploader ownership, attachment linking, and avatar storage.
- Item 7: backend tests cover timer assignment, expiry purge, persisted soft deletion, and `message.deleted` broadcast.
- Item 8: backend test verifies idempotence, 10 users, 60 contacts, 9 DMs × 18 messages, 3 groups × 16 messages, reactions, replies, receipt variation, unread/pinned/muted/disappearing state, and demo accounts.
- Item 9: frontend lint, strict typecheck, and production build passed without warnings after the route/store/theme refactor.
- Item 10: routes implement identifier OTP request, fixed-code hint, verification, display name/avatar onboarding, persisted session, `/auth/me` refresh validation, protected app routes, and Settings logout. Frontend lint, strict typecheck, and production build passed.
- Item 11: conversation list queries are debounced and server-filtered, with matching people search, direct chat creation, add-contact and group-compose flows, recent activity order, pinned/muted, unread, online, sender preview and empty/loading/error states. Keyboard shortcuts open compose/focus search/navigate chats. `npm run lint`, `npm run typecheck`, and `npm run build` passed.
- Item 12: chat view now renders grouped/date-separated bubbles, sender receipts, client-expiring typing, optimistic sends, quote/reply, file sending, reaction data, encryption/safety placeholder, direct/group headers, cursor pagination with scroll-position preservation, and a scroll-to-latest control. Backend suite: 17 passed. Frontend lint/typecheck/build passed.
- Item 13: group compose picks contacts; group info lists members and admin badges, allows admin-only edits/add/remove/promote/demote, and supports self-leave. All mutations use API client methods, refresh cached details/lists, and surface errors; backend enforces privileges and its group tests pass. Frontend lint/typecheck/build passed.
- Item 14: settings now edit profile/about/avatar, persist privacy and notification preferences, persist and apply system/light/dark theme, and expose Linked devices/Stories/Calls placeholders. New incoming inactive-chat messages and errors surface as dismissible toasts. Read receipts and typing preferences control their respective events. Frontend lint/typecheck/build passed.
- Item 15: attachments stage before send, file chips and image previews/lightbox work, emoji insertion and reaction toggling work, replies quote/scroll, per-chat disappearing timers are configurable and shown in the list, mobile back/single-pane behavior works, and keyboard shortcuts cover compose/search/close/chat navigation/send. Backend tests: 17 passed; frontend lint/typecheck/build passed.
- Item 16: applied the requested token palette, 340–380px conversation pane, bubble geometry/metadata, hover reactions, thin scrollbars, visible keyboard focus, reduced-motion support, responsive breakpoints, meaningful time labels, original SVG chat mark, and modal focus trapping. The independent audit later reproduced a failing format check on `tsconfig.json`; that failure is corrected and reverified in the remediation log below.
- Clean-install follow-up: the first `npm ci` found an omitted transitive `@types/prop-types` lock entry. Regenerated the lockfile; a subsequent clean `npm ci` succeeded, and format check, lint, strict typecheck, and production build all passed afterward.
- Item 17: `backend/scripts/smoke_e2e.py` passed against the existing database for both demo users: direct conversation, group creation, admin denial, typing start/stop, both-way WebSocket messages, acknowledgement, delivered/read status. Restarted the backend against the same `signal.db`; the script's `--verify-conversation/--verify-message/--verify-group` mode confirmed saved rows survived. This live run exposed and fixed the legacy SQLite receipt timestamp constraint. Final backend suite: 18 passed.
- Item 18: Render Blueprint uses the Docker FastAPI service, `/health`, persistent `/data` disk, SQLite URL, persisted uploads, OTP config, and editable CORS origin. Sessions are opaque random tokens stored as SHA-256 hashes; there is no generated JWT secret. Vercel config lives under the frontend project root. `DEPLOY.md` gives click-by-click GitHub, Render, Vercel, variables, and verification steps. YAML and Vercel JSON parse checks passed.
- Backend tests use `sqlite://` with `StaticPool`, `check_same_thread=False`, dependency overrides, `TESTING=1`, and a 30-second timeout. Production lifespan creates and seeds only outside test mode.
- Windows sandbox blocks TestClient's local asyncio socketpair and generated Next.js build directories without elevated execution. The backend uses in-process TestClient, and checked runs passed through the reviewed execution path. npm registry access also required reviewed network execution.
- Item 19: Replaced the stale first-pass README with setup, architecture/layering, Mermaid ER, schema rationale, REST and WebSocket tables, status machine, feature mapping, assumptions, deployment, tests, and limitations. Endpoint names and demo credentials were reviewed against the implementation.
- Item 20: Added `INTERVIEW_NOTES.md` with plain-language explanations of the implemented manager, services, receipt model, auth, optimistic UI, client stores, schema choices, and 15 interview questions with answers.
- Follow-up route fix: removed the duplicate standalone `/` page that always redirected to welcome. The authenticated `(app)` route now owns `/`, so the app guard and its session check control landing after onboarding. `npm run lint`, `npm run build`, and `npm run typecheck` passed after Next regenerated its route types.
- Final browser QA found two state bugs before acceptance: Zustand selectors returned fresh fallback arrays and caused a render loop when opening an empty chat; and the read effect attempted to mark a just-created optimistic message as read before persistence. Both were fixed with stable shared arrays and a cursor limited to the latest persisted incoming message. The browser now completed login, loaded the seeded chat, and sent a message without a runtime overlay or read-cursor error.
- Item 21 prior checkpoint (historical): 18 backend tests were recorded. The independent audit found that its format-check claim was stale; it is superseded by the fix report below, which records the clean-install commands and current results.

## Final verification status (this workspace)

Status values mean: `verified-by-running` = directly run and observed passing here; `verified-by-CI-only` = not locally run but covered by the checked-in CI workflow; `unverified` = no passing evidence.

| Item | Status | Evidence |
|---:|---|---|
| 1 | verified-by-running | 28 backend tests and clean-copy npm ci, format, lint, typecheck, build; see fix report |
| 2 | verified-by-running | schema and route/service tests; compile checks |
| 3 | verified-by-running | auth tests for hashing, expiry, revoke, REST and WS validation |
| 4 | verified-by-running | receipt, presence, typing and multi-socket tests |
| 5 | verified-by-running | group admin and system-message tests |
| 6 | verified-by-running | upload validation and attachment tests |
| 7 | verified-by-running | expiry/purge and deletion-event tests |
| 8 | verified-by-running | seed idempotence/count/content test |
| 9 | verified-by-running | frontend format/lint/typecheck/build |
| 10 | verified-by-running | browser OTP/login flow and protected app landing |
| 11 | verified-by-running | conversation list/search implementation and live seeded list render |
| 12 | verified-by-running | browser chat render/send plus live WS receipt smoke |
| 13 | verified-by-running | group service tests and group admin UI routes/components review |
| 14 | verified-by-running | settings UI implementation and frontend build/typecheck |
| 15 | verified-by-running | bonus components/hooks implementation and frontend build/typecheck |
| 16 | verified-by-running | responsive/theme implementation, 30 Playwright screenshots, format/lint/build |
| 17 | verified-by-running | live two-account smoke and persistence after backend restart |
| 18 | verified-by-running | deployment config parsed and reviewed; hosting itself was not deployed |
| 19 | verified-by-running | README content reviewed against API/schema/config |
| 20 | verified-by-running | interview notes and 15 Q&A reviewed |
| 21 | verified-by-running | 28 backend tests, 10 Playwright tests, frontend clean-install checks/build, live WS smoke and restart persistence |

## Audit remediation (2026-10-08)

The previous audit is a historical snapshot. Its `JWT_SECRET` deployment statement was wrong; the README and deployment guide now describe the opaque hashed session token actually implemented. The earlier 18-test count is historical; the current backend suite has 28 passing tests. The earlier format-check claim was stale and is now verified with a clean npm install in an isolated checkout. The repository is still not published and no hosted demo exists because this fix pass was explicitly instructed not to create a remote or deploy.

| Audit defect | Status | Verification |
|---|---|---|
| D-01 | NOT-FIXED | No GitHub remote or hosted demo was created, per the explicit no-publish/no-deploy instruction. |
| D-02 | FIXED-VERIFIED | Clean-copy `npm ci`; format, lint, typecheck, and build passed. |
| D-03–D-15 | FIXED-VERIFIED | Backend regression tests, Playwright UI checks, and smoke results listed in `AUDIT.md` Fix report. |
| D-16 | NOT-FIXED | Legacy SQLite migration remains additive and does not rebuild every old table to apply all fresh-schema checks. |
| D-17 | FIXED-VERIFIED | Removed unused JWT secret config/docs; corrected WebSocket event payload description and checked env/deploy config. |
