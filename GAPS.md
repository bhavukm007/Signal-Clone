# Gap analysis

The initial partial implementation lacked durable sessions, complete per-recipient receipts, live presence, upload handling, disappearing-message cleanup, group-role UI, and the required API/service/repository layout. The work in this branch closes those assignment gaps. The verification status and evidence are listed item-by-item in [PROGRESS.md](PROGRESS.md).

| Initial gap | Resolution | Verification |
|---|---|---|
| Durable authentication sessions | Opaque random bearer token, SHA-256 digest at rest, expiry and revocation checked on REST and WebSocket | Auth tests cover hash, expiry, logout revocation, and invalid WebSocket session |
| Delivery/read receipts | Per-recipient receipt rows, idempotent message writes, live delivery/read events, group aggregate | Backend tests and two-account live WebSocket smoke |
| Presence and last-seen | First/last socket lifecycle updates user state and broadcasts presence; typing is membership-checked and throttled | Backend WebSocket tests |
| Uploads | Validated avatar and attachment endpoints with file metadata and local static serving | Backend upload tests |
| Disappearing messages | Per-conversation timer sets expiry; cancellable lifespan task soft-deletes and broadcasts expired messages | Backend purge and event tests |
| Group role editing in UI | Group details UI exposes add/remove/promote/demote/leave; backend services enforce admin checks | Group service tests, admin denial in live smoke, frontend build |
| Required folder/layer structure | API and WebSocket handlers delegate to services and repositories; frontend split into route groups, components, hooks, stores, lib, types | Backend tests, strict TypeScript check, lint and build |
| Runtime route/state bugs found during final smoke | Root route now uses authenticated app guard; stable Zustand selector fallbacks and persisted incoming-message read cursor avoid render and read-cursor errors | Browser navigation and send after fix; production build |

## Remaining documented constraints

- The connection manager and presence state live in one process. Horizontal scaling requires shared pub/sub and session/presence infrastructure.
- SQLite and uploads use local disk; the deployment guide configures a persistent Render disk for the demo service.
- OTP and encryption are simulated, and calls, Stories, and linked devices remain placeholders as specified.
- CI is configured, but this run's final status is based on local executions rather than a GitHub Actions run.
