# Progress checklist

Status values: `[ ]` pending, `[x]` completed. Completion requires passing verification or a documented CI-only/unverified status in item 21.

1. [x] Make backend tests runnable and green using in-memory SQLite, TESTING lifespan gate, `pytest-timeout`, and TestClient REST/WebSocket; install frontend dependencies and pass lint/typecheck/build.
2. [x] Refactor backend into API → services → repositories → models; add all specified tables, schemas, constraints, indexes, and consistent errors.
3. [x] Implement durable hashed auth sessions with expiry and revocation, enforced on REST and WebSocket.
4. [x] Implement sent/delivered/read receipts, group aggregation, online/last-seen presence, typing, and WebSocket tests.
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

- Item 1: `python -m pytest -x -q` → 6 passed, including an in-process TestClient WebSocket ping; `npm ci --no-audit --no-fund --prefer-offline`, `npm run lint`, `npm run typecheck`, and `npm run build` all exited 0. React Hook warnings remain and are tracked for the frontend refactor.
- Item 2: `python -m compileall -q app tests` passed; `python -m pytest -x -q` → 6 passed after modularization; `app.openapi()` registered 24 HTTP routes before the final ping route was added. All expected table names are asserted by a test.`n- Item 3: `python -m pytest -x -q` → 9 passed, including token hash-at-rest, 30-day expiry, REST logout/expiry rejection, and revoked WebSocket rejection.`n- Item 4: `python -m pytest -x -q` → 12 passed, including sender/recipient message WS delivery, `sent → delivered → read` receipts, typing, presence transitions, pending delivery on reconnect, and multiple tabs.
- The test suite uses `sqlite://` with `StaticPool`, `check_same_thread=False`, overrides `get_db`, and sets `TESTING=1`; production lifespan creates tables and seeds only outside test mode.
- The backend and frontend installs needed the approved network/runtime execution path because package networking and Windows asyncio's internal socketpair are blocked in the default shell sandbox.


