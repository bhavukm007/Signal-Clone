# Interview notes

This project favors explicit data flow and authorization checks over hidden framework behavior. The notes below describe the implementation in this repository.

## Major modules

### WebSocket manager

`backend/app/ws/manager.py` keeps a map from each user ID to a set of connected sockets. A set matters because one person may have the app open in multiple tabs. The endpoint unregisters in `finally`, and only the last socket causes `last_seen_at` and offline presence to update. Failed sends close and remove dead sockets. A sweeper drops sockets that miss the 75-second timeout; the browser pings every 25 seconds. Typing updates are throttled with a monotonic clock. This manager is intentionally process-local; more than one backend instance would need a shared pub/sub service.

### Message service

`backend/app/services/message_service.py` owns message rules. It verifies active conversation membership, checks the client message ID for an existing send, validates replies and attachments, assigns a disappearing expiry when configured, stores the message and recipient receipt rows, and updates conversation activity in one transaction. The WebSocket handler broadcasts only after persistence succeeds. That ordering avoids showing a message that failed to save. Repeating a client ID returns the existing message, which makes reconnect retries safe.

### Receipt logic

`message_receipts` stores one row per message recipient. A recipient's row records delivery and read timestamps independently. The service advances read cursors and marks that recipient's earlier messages read; the sender sees an aggregate computed only from current participants (`left_at IS NULL`). A group stays sent while any current recipient is pending, becomes delivered when all current recipients have received it, and becomes read when all current recipients have read it. A client-only `sending` state covers the time before the server acknowledges persistence.

### Schema choices

UUID strings make IDs consistent across API, database, and client-generated references. Foreign keys protect relationships, while unique constraints enforce rules even if a caller bypasses the UI. `direct_key` is the sorted pair of user IDs and prevents duplicate one-to-one conversations. Participant, receipt, and reaction uniqueness prevents duplicate rows for a person in the same scope. A composite `(conversation_id, created_at)` index supports newest-first history pages; activity and membership indexes support conversation lists and authorization checks. Messages are soft-deleted so deletion can be broadcast and history can retain a tombstone.

### Authentication

`auth_service` generates a high-entropy opaque bearer token and stores only its SHA-256 digest in `auth_sessions`. Every REST and WebSocket authentication request hashes the presented token and checks expiry and revocation. Logout sets `revoked_at`, so a copied token stops working immediately. The project uses opaque sessions rather than JWTs because revocation and shared REST/WebSocket validation are straightforward for this single-database demo.

### Optimistic UI

The chat hook creates a client message ID and inserts a `sending` message into the conversation store before the network response arrives. The API response or `message.ack` replaces its temporary identity/status; query invalidation then reconciles the canonical server copy and receipt data. The same client ID is sent again after a retry, allowing backend idempotency to avoid duplicates.

### Store design

TanStack Query owns REST-backed conversation, contact, group, and message pages, including cache invalidation. Zustand holds state that needs immediate cross-component updates: authentication, active chat and optimistic messages, transient modals/toasts/search, and presence. Keeping those responsibilities distinct avoids copying the full server database into a second client cache. Preferences that need to survive refreshes use browser storage; message history remains server-owned.

## Likely interview questions

1. **Why use SQLite?** It keeps setup reproducible and persistence easy for a single-instance assignment. The repository and service boundaries leave room to move to a server database later.
2. **How do you prevent duplicate direct chats?** The service sorts the two user IDs into one `direct_key`; a database unique constraint closes the race between concurrent requests.
3. **Why one receipt row per recipient?** It preserves who received or read a message, which is necessary for group receipts and reconnect delivery.
4. **How is message sending idempotent?** The client supplies a stable ID and the database enforces uniqueness for sender plus client ID. A retry returns the existing message.
5. **Why broadcast after commit?** Other clients should only see messages that have been durably stored. The transaction also updates activity and receipt rows consistently.
6. **How does group receipt aggregation work?** Each recipient has their own state; the service derives the aggregate from all active recipients instead of storing a potentially stale aggregate.
7. **How does the server authorize group edits?** Services verify active membership and admin role for every mutation. UI checks improve usability but are not trusted for security.
8. **Why hash session tokens?** A database leak does not expose bearer credentials directly. The original random token is returned once and cannot be reconstructed from its digest.
9. **Why opaque sessions instead of JWTs?** Revocation is immediate and both HTTP and WebSocket authentication can use the same database check.
10. **How are messages paginated?** The API accepts a message cursor and returns a bounded page in chronological display order. The client preserves scroll position while prepending older pages.
11. **How do disappearing messages work?** The conversation timer sets `expires_at` on new messages. A cancellable worker finds expired rows, soft-deletes them, and broadcasts deletion events.
12. **What happens when a recipient reconnects?** A new socket marks the user online and the service advances pending delivery receipts for messages in their conversations; the client also refreshes REST queries.
13. **What is the scaling limit of presence?** The connection manager is in memory in one process. Multiple workers need a shared presence/connection event broker.
14. **How do tests avoid hanging WebSockets?** FastAPI `TestClient` exercises sockets in process, tests set `TESTING=1` to skip workers/seeding, tasks are cancelled on shutdown, and pytest-timeout caps hangs.
15. **How do you reconcile optimistic sends with server state?** A stable client ID links the temporary row with the acknowledgement. Query invalidation fetches canonical history, while backend idempotency protects retries from duplicate persistence.
