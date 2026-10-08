# Gap analysis

Reviewed the first-pass README, API, tests, frontend source and deployment manifests before modifying the repository. This file records the remaining work after backend item 2.

| Area | Status after checklist item 2 | Remaining work |
|---|---|---|
| Test runner | In-memory SQLite fixture, `TESTING=1` startup gate, 30-second pytest timeout, REST and WebSocket TestClient tests; suite passes with internal loopback IPC allowed | Keep extending meaningful backend coverage; sandbox blocks the Windows asyncio socketpair unless test process is approved outside it |
| Frontend toolchain | `package-lock.json` created; npm ci, lint, typecheck, and production build pass | Resolve current React Hook warnings while moving UI into hooks/components |
| Backend layering | `api/v1`, `services`, `repositories`, `models`, `schemas`, `core`, `db`, and `ws` modules exist; route handlers delegate logic; consistent validation/HTTP error envelope | Complete websocket events/manager and auth session dependency; add upload/purge semantics |
| Database | All ten requested tables now exist with foreign keys, SQLite FK/WAL pragmas, unique/check constraints, read cursor, group fields, message metadata, receipts, reactions, attachments | Add regression tests for constraints/indexes and richer seed behaviors |
| Authentication | Opaque random tokens are stored as SHA-256 hashes with 30-day expiry; logout and expired sessions are revoked; REST and WebSocket share token validation | Add device/session management only if required; core requested behavior is covered |
| Messages/receipts | Idempotent REST/WS send; client ack; per-recipient sent/delivered/read; all-recipient aggregate; online delivery on connect; cursor read; typing throttle; first/last socket presence and reconnect delivery are covered by tests | Group-wide aggregate edge cases and reaction broadcast tests remain in group/realtime validation |
| Groups | Group creation, member listing/add/remove/role editing API and admin checks live in services | System messages, conversation broadcasts, UI, and broader role tests |
| Uploads | Route placeholder only; attachment schema exists | Validated storage, serving, metadata creation, avatar/attachment client flows |
| Disappearing messages | Schema and timer patch path exist | Cancellable purge task and deleted events; fully exercise timer lifecycle |
| Seed | 10 users, 9 DMs × 18 messages, and 3 groups × 16 messages generated on empty DB | Contacts, reactions/replies, unread diversity, proper system-message text, standalone idempotency verification |
| Frontend | Current single page still builds but is compressed and tightly coupled | Prescribed route/component/hooks/store/lib structure and all flows in items 9–16 |
| Deployment/docs | Basic Docker/Render/Vercel manifests exist | CI, complete beginner deploy guide, final README, interview notes, smoke run |

## Verification constraints

- `TestClient` uses an AnyIO Windows loopback socketpair internally; under the restricted shell it blocks before the app request executes. Running the in-process suite via the reviewed escalation path passes; the test code itself performs no external network requests.
- npm registry access required the reviewed escalation path after the sandbox returned `ENOTFOUND`; a lockfile is now present and reproducible `npm ci` succeeded.


