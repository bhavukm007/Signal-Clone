# Progress checklist

Status values: `[ ]` pending, `[x]` completed. Completion requires passing verification or a documented CI-only/unverified status in item 21.

1. [x] Make backend tests runnable and green using in-memory SQLite, TESTING lifespan gate, `pytest-timeout`, and TestClient REST/WebSocket; install frontend dependencies and pass lint/typecheck/build.
2. [ ] Refactor backend into API → services → repositories → models; add all specified tables, schemas, constraints, indexes, and consistent errors.
3. [ ] Implement durable hashed auth sessions with expiry and revocation, enforced on REST and WebSocket.
4. [ ] Implement sent/delivered/read receipts, group aggregation, online/last-seen presence, typing, and WebSocket tests.
5. [ ] Complete groups with server-side admin rules, system messages, broadcasts, and tests.
6. [ ] Implement validated avatar and attachment uploads.
7. [ ] Implement expiring messages, cancellable purger, deletion broadcast, and tests.
8. [ ] Complete idempotent seed script with 8–10 users, demo accounts, contacts, varied DMs/groups/statuses/settings.
9. [ ] Refactor frontend into the specified app/components/hooks/stores/lib/types layout with theme tokens.
10. [ ] Complete welcome/register/verify/profile flow, persisted auth guard, profile avatar, settings logout.
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

- Initial gap review: `README.md`, backend API, current tests, frontend page/layout/styles, package/deployment manifests read on 2026-10-08.
- Item 1 verified by running: `python -m pytest -x -q` → 4 passed; `npm ci --no-audit --no-fund --prefer-offline`; `npm run lint`; `npm run typecheck`; `npm run build` all exit 0. Lint/build currently emit 3 React hook dependency warnings to fix during frontend refactor.
- The TestClient run required the reviewed unsandboxed execution path because AnyIO's Windows event loop creates an internal local socketpair; this was test harness IPC, not an external app/network request. The tests use in-memory SQLite and no app server sockets.
- `pytest-timeout==2.4.0` installed and configured to 30 seconds. `TESTING=1` skips startup database/seed work; tests override `get_db` with `StaticPool` in-memory SQLite.
