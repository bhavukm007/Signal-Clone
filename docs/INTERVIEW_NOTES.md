# Interview notes

The implementation is a learning/demo messenger, not Signal's cryptographic protocol.

1. **Auth sessions:** OTP is mocked; the server stores a SHA-256 hash of an opaque random bearer token with expiry and revocation (`backend/app/services/auth_service.py`).
2. **Layering:** API and WebSocket handlers call services; services apply membership/role policy and repositories own focused persistence queries.
3. **Idempotent sends:** `(sender_id, client_message_id)` is unique, and an async per-conversation/idempotency lock serializes write-and-publish within one process.
4. **Receipts:** one receipt row per message and current participant; aggregate status advances from sent to delivered to read.
5. **SQLite:** foreign keys, WAL and a busy timeout are set on connections. SQLite plus the in-memory hub are single-instance only.
6. **Presence:** socket counts support multiple tabs; snapshots initialize clients, live events update peers, and disconnect state has a five-second grace.
7. **Reconnect:** the client retries WebSockets with backoff and invalidates REST queries to resync messages and conversations.
8. **Disappearing messages:** a lifespan worker purges expired messages and emits deletion events; this worker and hub are process-local.
9. **Phone identity:** phone-like auth/contact identifiers normalize to canonical E.164; ten-digit input is interpreted as an Indian number with country code +91.
10. **Frontend state:** React feature components and hooks use TanStack Query for REST-backed data and Zustand for session/UI/transient chat/presence state.
11. **Media:** uploads are capped and served through membership-authorized endpoints; files live on local disk and can disappear on free-tier restart.
12. **Trust boundary:** no message encryption, real SMS, calls, stories or linked-device protocol is implemented.

All statements above are grounded in the current source. See [ARCHITECTURE.md](ARCHITECTURE.md) for the tables, API and event contracts.
