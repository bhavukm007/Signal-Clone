# Gap analysis

This compares the committed first pass with the requested acceptance list. Full implementation is tracked in `PROGRESS.md`.

| Area | Current state | Required work |
|---|---|---|
| Test harness | Tests use app-global file SQLite; no timeout plugin or TESTING gate | Isolated in-memory DB, dependency override, no startup seed/tasks in tests, TestClient REST + WebSocket tests, pytest-timeout |
| Python runtime | Syntax/schema import worked; HTTP TestClient stalled during an earlier attempt | Isolate engine/lifespan and identify exact failure; run `pytest -x -q` |
| Frontend toolchain | `npm install` was interrupted while network/package resolution stalled; no lockfile | Run bounded logged `npm ci`, fallback registry/package manager, lint/typecheck/build |
| Backend architecture | Most implementation is a 300+ line `main.py`; routes directly query SQLAlchemy | Extract config, models, schemas, repositories, services, API routers, websocket manager/handlers |
| Authentication | Reversible `demo-<user id>` bearer token; logout does not revoke | Opaque random tokens, SHA-256 token hashes in auth_sessions, expiration/revocation on REST and WS |
| Database | Users, OTP, contacts, conversations, participants, messages, receipts, reactions only | Add auth_sessions, attachments, full timestamps/roles/read cursor/left-at, proper constraints/indexes |
| Messaging | REST/WS send basics; receipt rows are created but delivery/read aggregation is incomplete | Idempotent service, delivery on connect/ack, read up to cursor, aggregate status, reply/edit/delete semantics |
| Realtime | In-memory sockets and partial typing; no presence fanout, delivery reconnect, reaction WS, expiry | Multi-tab manager, last-socket presence, typing throttle/expire, all specified events, reconnect/resync |
| Groups | Create, member listing/add/remove exist, limited admin enforcement | System messages/broadcasts, role changes, metadata edits, self leave, UI management |
| Contacts | Add/list/delete/block endpoints added in prior pass but not backed by UI/test | Schema validation, search/integration in compose, contact modals and tests |
| Uploads | None | Avatar and message uploads, MIME/size checks, static serving, attachment metadata and UI |
| Disappearing | Timer column only | Expiry assignment, cancellable background purger, WS deleted event, visible timer and tests |
| Seed | Ten users, nine direct chats and three group chats; missing contacts/reactions/replies/unread variety | Idempotent standalone seed module and richer fixture dataset matching requested counts/statuses |
| Frontend architecture | One very compressed page and CSS; no route groups, stores, hooks or presentational boundaries | Split routes/components/hooks/stores/types/lib, accessible reusable UI, no API calls in view components |
| Frontend behavior | Single-step fixed-OTP login, simple chat, settings stub, dark toggle | Full auth route progression, token guard, conversations/contact/group/settings/bonus behavior |
| Deployment/docs | Basic Render/Docker/Vercel files and README | CI, robust env setup, exact beginner deployment steps, complete schema/event/API docs and interview notes |
| Repository history | Three scaffold/backend/frontend commits | Continue one focused commit per completed checklist item |

## Verification constraints observed so far

- A previous test client command constructed `TestClient` without entering its context manager and stalled. That does not establish a sandbox socket limitation; item 1 will fix the fixture and retest in-process.
- npm installation did not finish in the earlier pass. It must be retried with the bounded logging and registry fallbacks from the task instructions.
