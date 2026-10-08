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
11. [ ] Complete conversation list, debounced conversation/contact search, compose flows, unread/pin/mute/presence states.
12. [ ] Complete chat view: realtime, grouped/date-separated messages, receipts, typing, pagination, scroll behavior, optimistic sends, header, encryption placeholder.
13. [ ] Complete group create/info/member administration UI.
14. [ ] Complete settings sections, coming-soon flows, toasts.
15. [ ] Complete attachments, reactions, replies, disappearing UI, responsive layouts, shortcuts.
16. [ ] Pixel polish and accessibility pass against specified tokens and layout.
17. [ ] Script and pass two-account end-to-end smoke flow including realtime, groups, receipts, and restart persistence.
18. [ ] Finalize Render/Vercel config and write beginner deployment guide.
19. [ ] Finalize README with architecture, schema, API/WS tables, state machine, checklist, assumptions, limitations, deployment, tests.
20. [ ] Add plain-language module explanations and 15 interview questions/answers.
21. [ ] Final lint, typecheck, backend tests, frontend build, smoke checks; remove dead code and record each verification truthfully.

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
- Backend tests use `sqlite://` with `StaticPool`, `check_same_thread=False`, dependency overrides, `TESTING=1`, and a 30-second timeout. Production lifespan creates and seeds only outside test mode.
- Windows sandbox blocks TestClient's local asyncio socketpair and generated Next.js build directories without elevated execution. The backend uses in-process TestClient, and checked runs passed through the reviewed execution path. npm registry access also required reviewed network execution.
