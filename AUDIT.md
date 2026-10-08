# Independent audit: Signal Messenger clone

Audit date: 2026-10-08. Scope: the checked-out `main` tree as observed in this workspace. This audit is read-only apart from this report. Evidence distinguishes source inspection, automated tests, and live probes; a README or progress claim alone is not evidence.

## 1. Verdict summary

**Estimated submission readiness: 55%. NO-GO for submission as a completed assignment.** The backend is a credible working prototype: its 18 tests pass, and a separately run two-account smoke script passed direct chat, group creation, admin denial, typing, bidirectional WS sends, delivery/read updates, and persistence after a backend restart. The frontend lint, typecheck, and production build also passed in this environment (build needed elevated filesystem access). The claimed final frontend format check does not pass: `npm run format:check` exits nonzero because committed `frontend/tsconfig.json` is not Prettier-formatted. There is no configured Git remote or hosted demo URL, so two required deliverables cannot be verified and do not presently exist in this checkout.

The product is not “exact” to Signal Desktop. Its layout and colors are recognizable, but font loading, some chat details, error handling, privacy controls, and several advanced behaviors are incomplete. See sections 3–11 for test limits and cited defects.

### Top 10 risks

1. **No public GitHub remote or working hosted demo URL.** The requested deliverables are absent; neither deployment can be exercised.
2. **CI fails its format step.** Reproduced with `npm run format:check`; `tsconfig.json` is flagged. `PROGRESS.md` claims this passes.
3. **Blocking is cosmetic and does not prevent messaging.** The settings “Manage” text is inert; backend only flips a contact flag and message send never checks it.
4. **Uploaded media is publicly served without authentication.** `/uploads` is mounted as `StaticFiles`; uploaded private images/files are addressable by URL.
5. **Group receipt aggregation includes departed recipients.** A removed member’s pending receipt can keep the sender’s aggregate status pending indefinitely.
6. **Unexpected WebSocket send/receive exceptions can leave stale online presence.** Dead-socket cleanup catches only two exception classes, and the disconnect/presence cleanup only runs for `WebSocketDisconnect`.
7. **Conversation list has N+1 queries and materializes unread message rows.** Cost grows with chats and history, instead of issuing bounded counts/joins.
8. **Chat detail/history failures can look like endless loading.** `ChatView` ignores query error/loading states and renders the same loading shell when conversation data is absent.
9. **Disappearing-message automatic worker was not verified.** A live probe timed out waiting for `message.deleted`; current test calls the purge function directly, not the running loop.
10. **Pixel fidelity and responsive acceptance are overstated.** Inter is named but not loaded; the sidebar is 440px overall, bubble max is 75%, and exact 375/768px checks were not performed.

The most important blockers are in defect table D-01 through D-06. Suggested remediation is text only in this audit; no code was changed.

## 2. Requirements traceability matrix

Status meanings: PASS = directly exercised or clear implementation and supporting test; PARTIAL = present but incomplete or tested only in part; FAIL = absent, broken, or contradicted; UNVERIFIED = insufficient evidence or could not be exercised. Source paths are repo-relative.

| ID | Requirement | Status | Evidence | Notes / defects |
|---|---|---|---|---|
| T01 | Register with phone or username | PASS | `backend/app/services/auth_service.py:21-49`; README demo login; smoke `auth` | OTP onboarding creates/reuses user. |
| T02 | Fixed/mock OTP | PASS | `backend/app/core/config.py`; auth tests; live smoke | Fixed OTP is intentionally insecure for production. |
| T03 | Set display name and avatar | PARTIAL | `backend/app/api/v1/auth.py`; `backend/app/api/v1/users.py`; upload service | Profile flow exists; avatar validation covered partly. |
| T04 | Login/logout | PASS | `auth_service.py:61-84`; `backend/tests/test_auth.py`; smoke | Session revoke tested. |
| T05 | Session survives refresh | PASS | `frontend/src/components/layout/AppShell.tsx:13-42`; live browser auth and `/me` validation | Local browser maintained session. |
| T06 | Contacts can be managed | PARTIAL | `backend/app/services/contact_service.py:23-55`; `frontend/src/components/conversations/NewChatModal.tsx` | Add/delete work through APIs; block is ineffective (D-03). |
| T07 | Conversation list sorted by latest activity | PASS | `conversation_service.py:42-84`; CUA desktop view | Sort is in Python, pinned first. |
| T08 | Search conversations | PASS | `conversation_service.py:49-53`; `Sidebar.tsx:26-33` | Debounced. Search implementation is not SQL-injection-vulnerable by inspection. |
| T09 | Search contacts/users too | PARTIAL | `Sidebar.tsx:29-33`; `NewChatModal.tsx:21-29` | Separate user-search query. UI behavior was visually inspected; no comprehensive contact search matrix. |
| T10 | Add a new contact | PASS | `contact_service.py:23-37`; NewChat modal; self-contact probe | Self-contact rejected (422); duplicate add is idempotent in service. |
| T11 | Unread indicators and preview | PASS | `conversation_service.py:54-84`; desktop view | Count is functionally returned, but it loads all unread rows; D-07. |
| T12 | Unread clears when opening chat | PARTIAL | `message_service.py:118-141`; `useMessages.ts`; browser send smoke | Read cursor path exists; independent unread badge clear assertion was not run. |
| T13 | Conversation list reorders after new message | PARTIAL | `message_service.py:58-63`; WS event hook invalidates data | Backend activity updates; no dedicated UI reordering assertion. |
| T14 | Online/last-seen indicators | PARTIAL | `backend/app/ws/router.py:97-105,132-138`; live smoke presence | Connect/disconnect path tested; abnormal disconnect risks stale state (D-05). |
| T15 | Real-time direct send/receive both directions | PASS | `backend/scripts/smoke_e2e.py`; output checks both-way messages | Reproduced against live local servers. |
| T16 | Timestamps and persisted messages | PASS | message service; smoke plus restart verification | Persistence after backend restart reproduced. |
| T17 | Delivery/read receipts, single conversation | PASS | `message_service.py:100-141`; live smoke checks delivered/read | Basic direct flow passed. |
| T18 | Group read receipts aggregate all recipients | PARTIAL | `message_service.py:144-156`; receipt tests | Not tested against every recipient; departed members remain in aggregate (D-06). |
| T19 | Sending → sent → delivered → read states | PARTIAL | `message_service.py`; `useMessages.ts`; smoke | `sending` is client-only; test observed ACK and delivered/read; full status sequence not asserted in browser. |
| T20 | Typing indicators start/stop | PASS | `ws/router.py:37-49`; live smoke typing | Server throttles starts; stop is not throttled. |
| T21 | Typing auto-expires after 5 seconds | PARTIAL | `frontend/src/hooks/useWebSocket.tsx`; typing hook | Client expiry implementation exists; exact expiry timing not independently measured. |
| T22 | Group creation with name and selected members | PASS | `group_service.py:32-48`; live smoke | Group create persisted and survives restart. |
| T23 | Group send/receive | PARTIAL | common message service supports group memberships | Live smoke did not send a group message. |
| T24 | View group members | PASS | group service + `GroupInfoPanel.tsx` | UI source present; member panel visible in app. |
| T25 | Add/remove members and leave | PASS | `group_service.py:51-92`; `backend/tests/test_groups.py` | Active membership authorization checked. Removed-member read probe returned 403. |
| T26 | Admin-only group controls in UI | PASS | `GroupInfoPanel.tsx:31-40` and role controls; group tests | UI gates admin actions; direct API denial also tested in live smoke. |
| T27 | Admin checks enforced by backend | PASS | `group_service.py:51-55,95-105`; live smoke admin denial | Last-admin demotion is not prevented (D-10). |
| T28 | Group data/messages persisted | PASS | live smoke and restart verification | Group creation/restart verified; group message persistence itself not exercised. |
| T29 | Signal-style nav rail and split-pane layout | PASS | CUA screenshot at 1280×720; `globals.css:36-80` | Visually close in broad structure. |
| T30 | Message bubbles, threading/reply | PARTIAL | `ChatView.tsx`; message components | Replies exist. Pixel details differ (section 7). |
| T31 | Forms, modals, search, filters | PARTIAL | `NewChatModal.tsx`; `ui/Modal.tsx` | Common flows exist; errors/loading for some modal queries are silent. |
| T32 | Toasts for notifications/errors | PARTIAL | `useWebSocket.tsx`; `uiStore.ts:23-26` | Inactive-chat toast path exists. Overlapping timeout can clear a newer toast early. |
| T33 | Settings: privacy | PARTIAL | `PrivacySection.tsx:5-35` | Read receipts/typing toggles exist; Blocked users “Manage” is plain text. |
| T34 | Settings: notifications | PARTIAL | `NotificationsSection.tsx:5-32` | Message toast preference works; notification sound is a nonfunctional toggle explicitly noted as unsupported. |
| T35 | Settings: appearance | PASS | `uiStore.ts`; theme provider and CUA dark screenshot | System/light/dark theme control present and dark theme rendered. |
| T36 | Voice/video calls placeholder | PASS | `Sidebar.tsx:59-71`; chat header buttons | Coming-soon messaging. |
| T37 | Stories placeholder | PASS | `Sidebar.tsx:67-71` | Coming-soon messaging. |
| T38 | Linked devices placeholder | PASS | Settings components | UI placeholder present. |
| T39 | E2E encryption may be mocked | PASS | README assumptions; encryption banner | Mock only; not cryptographic protection. |
| T40 | Attachments | PARTIAL | `upload_service.py:22-57`; uploads tests | Allowlist, size guard and basic signatures. Oversize and mismatch adversarial cases not executed; URL access is public. |
| T41 | Reactions | PARTIAL | message service and UI hooks | Implementation/tests present; no full multi-user reaction live probe. |
| T42 | Reply/quote | PARTIAL | message service reply validation; ChatView | Source supports same-conversation reply. No separate live reply probe. |
| T43 | Functional disappearing messages | UNVERIFIED | `main.py:45-52`; `disappearing_service.py:14-33`; one test | Direct service test passes; live worker probe timed out waiting for deletion broadcast. |
| T44 | Dark mode | PASS | CUA dark settings screenshot; theme provider | Rendered dark mode inspected. |
| T45 | Responsive desktop/tablet/mobile | PARTIAL | `globals.css:712+`; source inspection | CSS has mobile breakpoint; exact 375px and 768px runs not completed. Desktop 1280px inspected. |
| T46 | Keyboard shortcuts | PARTIAL | `useKeyboardShortcuts.ts`; Sidebar usage | Implementation exists; every shortcut was not physically invoked. |
| T47 | Seed multiple users/conversations/messages | PASS | `backend/app/db/seed.py`; seed test | Test asserts 10 users, 9 direct, 3 groups, 210 messages, 60 contacts, reactions/replies. |
| T48 | Fresh DB seeds automatically and usable first run | PASS | `main.py:25-33`; seed test; smoke login | Empty DB startup path implemented and test mode separately gated. |
| T49 | Own relational database schema evaluated | PASS | models and SQLite probes; section 4 | Fresh model schema has the intended relationships and constraints. Legacy migration gap noted. |
| T50 | README setup, stack, architecture, schema, assumptions, API | PARTIAL | README sections 1–315 | Present and detailed; some statements are stale/false (section 11), setup not reproducible in this offline sandbox. |
| T51 | Original work | UNVERIFIED | git history; no suspicious copied headers found | No plagiarism evidence found; authorship cannot be established by static review. |
| T52 | Public GitHub repository with frontend/backend | FAIL | `git remote -v` empty; `git ls-files` includes both directories | Repository is local only in this checkout; no public remote configured. |
| T53 | Hosted working demo link | FAIL | README/DEPLOY contain instructions/placeholders, no live URL | No demo link found or deployment reachable from this audit. |
| T54 | Evaluation: functionality including real-time | PARTIAL | 18 tests + live smoke output | Strong basic direct path; several edge cases listed in section 3 unverified. |
| T55 | Evaluation: visual similarity | PARTIAL | CUA desktop and dark screenshots; section 7 | Structure/colors recognizable; exact typography/layout/interaction mismatch remains. |
| T56 | Evaluation: database design | PARTIAL | ORM model inspection + EXPLAIN; section 4 | Fresh schema reasonable; N+1 and legacy constraints are issues. |
| T57 | Evaluation: backend/API design | PARTIAL | route/service review; section 5 | Mostly layered, with boundary and route-level repository violations. |
| T58 | Evaluation: modularity/code quality | PARTIAL | file counts, lint/typecheck/build/tests | Large `ChatView.tsx` and stylesheet; compile checks are green except format. |
| T59 | Candidate can explain the code | PARTIAL | `INTERVIEW_NOTES.md`; section 10 | Notes are useful but contain inaccurate receipt/manager claims. |

## 3. Real-time and correctness audit

| Check | Result | Evidence / limitation |
|---|---|---|
| Bidirectional delivery | PASS | `backend/scripts/smoke_e2e.py` printed `status: passed` and `both-way messages`; both seeded demo accounts used. |
| Ordering | PARTIAL | Message list sorts by timestamps and newest-last on the client. No concurrent send/order race was generated. Cursor uses only `created_at`; equal timestamps can skip rows (`backend/app/repositories/message_repository.py:20-31`). |
| Duplicate prevention | PARTIAL | Sender/client ID unique constraint and sequential idempotent test pass. Concurrent duplicate request race and mismatched retry body were not tested. |
| Reconnect/resync after socket drop | UNVERIFIED | Client has exponential retry and invalidates queries on reconnect (`frontend/src/lib/ws.ts:66-74`, `useWebSocket.tsx:...`); no forced-drop test. Expired-token close can reconnect forever. |
| Multi-tab | PARTIAL | Manager stores a set per user, tests cover multi-tab; abnormal socket send failures can remove last socket without presence transition. |
| Direct receipt state | PASS | Smoke observed sender ACK and delivered/read events. No complete client-side UI tick screenshot assertion. |
| Group aggregate receipt | PARTIAL | Per-recipient receipt rows exist; `aggregate_status` test coverage is limited. It counts departed recipients (D-06). |
| Presence connect/disconnect | PARTIAL | Test suite reports presence path; normal live smoke connects both users. Unexpected errors bypass offline update (D-05). |
| Typing start/stop | PASS | Live smoke observed typing event. Auto-expire exact 5 seconds unverified. |
| Offline recipient then reconnect | PARTIAL | Test `test_offline_reconnect_marks_pending_delivered` exists and passes; no separate manual two-browser offline/reopen run. |
| Large history pagination | UNVERIFIED | API supports bounded cursor page; seeded conversations are 18 messages, below the default page size 30. |
| Disappearing purge and broadcast | UNVERIFIED | `test_disappearing_service` directly calls purge; separate live WS worker probe timed out waiting for `message.deleted`. |
| Token expiry/revocation REST and WS | PASS | Tests cover hashed/revoked/expired sessions and WS revoked token; independent probe saw OTP replay rejected 401. |
| Non-member message access | PASS | Service membership checks; removed-member history probe returned 403. |
| Admin direct API action | PASS | Live smoke’s non-admin denial check passed; tests cover group rules. |
| Removed member access | PASS | After removal endpoint returned 200, removed member message history returned 403. Send denied by common membership service inspection. |
| Self-contact | PASS | Independent TestClient probe returned 422. |
| Duplicate DM creation | PARTIAL | Sequential two-call probe returned same ID. Concurrent creation race has unique constraint but no `IntegrityError` recovery (`conversation_service.py:21-39`). |
| Empty/oversized messages | PASS | Independent probe: both empty and oversize returned 422; `MessageCreate` Pydantic bounds plus service whitespace check. |
| XSS body/display name | PARTIAL | React renders body/name as text and no `dangerouslySetInnerHTML` occurrence found. No browser payload execution test was run. |
| Upload type/size abuse | PARTIAL | Source checks allowlist, size, magic bytes, extension and UTF-8 (`upload_service.py:22-57`); tests cover unsupported exe and basic upload. Oversized/mismatched adversarial cases not run. |
| SQL injection search | PASS | Probe `q` containing SQL metacharacters returned 200 with zero results; SQLAlchemy expressions/parameterization observed. |

Live smoke output from `backend/scripts/smoke_e2e.py`: `{"status":"passed",...,"checks":["auth","direct chat","group creation","admin denial","typing","both-way messages","delivery and read receipts"]}`. Restart invocation reported `persistence passed`. This script does **not** cover group messaging/aggregate receipts, forced reconnect, concurrent idempotency, large pagination, or automatic expiration worker behavior.

## 4. Database design review

The live SQLAlchemy SQLite engine connection returned `PRAGMA foreign_keys=1`; `backend/app/db/session.py:9-21` installs the pragma on each engine connection and sets WAL. A separate raw SQLite connection returned foreign_keys=0, which is SQLite’s per-connection default and does not negate the configured application connection. Raw DB reported `journal_mode=wal`.

### Tables and constraints (fresh ORM-created schema)

| Table | Key columns / relationships | Uniques/checks/indexes and observations |
|---|---|---|
| `users` | UUID string PK; nullable phone and username; profile/about/avatar; online/last-seen; created timestamp | phone and username unique; CHECK at least one identifier. |
| `otp_challenges` | PK; identifier/code/expiry/consumed/created | identifier index. OTP code is plaintext and fixed/mock by design. |
| `auth_sessions` | PK; user FK cascade; token hash/device/created/expires/revoked | token hash unique/index; user index. Good revocation lookup. |
| `contacts` | PK; owner and target user FKs cascade; nickname/blocked/created | unique owner+target; CHECK no self contact; individual FK indexes. |
| `conversations` | PK; type/title/description/avatar/creator FK; unique nullable direct key; timer; last-message FK; activity/created | type CHECK direct/group; activity index; unique direct key. last-message FK has no delete action. |
| `conversation_participants` | PK; conversation/user FKs cascade; role, join/leave, last-read FK, mute/archive/pin | unique conversation+user; role CHECK; user/conversation indexes. Soft-leave keeps old participant row. |
| `messages` | PK; conversation FK cascade; sender FK; body/type/reply FK/client ID; created/edited/deleted/expires | unique sender+client ID; type CHECK; `(conversation_id, created_at DESC)`; FK/indexes. Cursor missing ID tie-breaker. |
| `message_receipts` | PK; message/user FKs cascade; status/timestamps | unique message+user; status CHECK sent/delivered/read; lookup indexes. Aggregate must account for active participants. |
| `message_reactions` | PK; message/user FKs cascade; emoji/created | unique message+user; message index. |
| `attachments` | PK; nullable message FK cascade; uploader FK cascade; file metadata/path/dimensions | size positive CHECK; message/uploader indexes. Files are stored outside DB; upload URLs currently public. |

`backend/app/models/user.py`, `contact.py`, `conversation.py`, `message.py`, and `auth.py` define these fields and constraints. `README.md:83-199` includes the Mermaid ER diagram; inspected relationships broadly match model relations, though diagram is a simplified relationship map and omits some columns/constraints, as a diagram should. The actual legacy `backend/signal.db` predates several model checks: its users/contacts/conversations/participants/messages DDL does not contain current CHECK constraints. The additive legacy migration does not rebuild these tables. Thus fresh DB and already-existing DB integrity differ.

### Query plan evidence and quality

`EXPLAIN QUERY PLAN` against the inspected SQLite database:

* Participant-by-user query: `SEARCH conversation_participants USING INDEX ix_participants_user (user_id=?)`.
* Message history: `SEARCH messages USING INDEX ix_messages_conversation_created (conversation_id=?)`.
* Unread query: `SEARCH messages USING INDEX ix_messages_conversation_created (conversation_id=? AND created_at>?)`.

These indexes support the predicates. However, `conversation_service.list_conversations` loops memberships and performs separate lookups for each conversation, participants, users, last message, cursor, and unread messages (`conversation_service.py:42-84`). Unread counts call `.all()` and take `len`, transferring/materializing all matching message rows. This is a clear N+1 and unbounded memory/latency risk. Activity sorting happens in Python after assembling all conversations. A grouped count query and joined/selected aggregate would be more appropriate. Message cursor compares timestamp alone and may omit rows with identical timestamps.

Timestamp values are timezone-aware UTC at service creation and serialized ISO; SQLite may return naive values depending on dialect, so consistency at serialization deserves a targeted timezone test. Restart persistence itself passed.

## 5. Backend / API design review

### Layering

The project has the requested `api/v1`, `services`, `repositories`, `models`, `schemas`, `core`, `db`, and `ws` directories. Normal API handlers usually delegate to services. Violations remain:

* `backend/app/api/v1/messages.py:61-64,79-82` imports `message_repository.by_id` and reads a message in the route to construct reaction broadcasts. This is a direct repository call in the API layer.
* Services import request Pydantic schemas (`auth_service.py`, `conversation_service.py`, `message_service.py`, `group_service.py`, `contact_service.py`), contrary to the stated “Pydantic schemas at API boundary only” rule.
* WebSocket router imports repositories and performs a `by_id` lookup at `ws/router.py:71`; it is a handler layer exception to the preferred service boundary.
* Group routes publish event broadcasts and coordinate service results, making the route layer responsible for use-case side effects.

Repositories appear thin and do not contain substantive business logic. Services do not appear to depend on HTTP request/response objects, though they raise `HTTPException`, coupling application services to FastAPI transport semantics.

### Routes, auth and errors

Protected REST route functions generally depend on `get_current_user`; OTP request/verify are intentionally public. `/health`, docs/OpenAPI and mounted `/uploads/{path}` are public. Public media is an unintended privacy exposure for private attachments. Error handlers normalize HTTP and request-validation errors into `{error:{code,message}}` (`main.py:65-86`); unhandled 500 errors retain FastAPI’s default behavior. API contracts are mostly inferred dictionaries rather than explicit response schemas, limiting OpenAPI precision. Routes return sensible common 401/403/404/409/422 status codes.

CORS uses configured origins with credentials (`main.py:56-62`); Render has a placeholder origin which must be replaced as DEPLOY.md instructs. No deployed CORS behavior can be tested. `JWT_SECRET` is configured/generated but unused: auth uses random opaque tokens and SHA-256 digests. README and deploy guide say JWT_SECRET is used/needed, which is false. Token passed in WS query string is as specified but may appear in access logs; no HTTP log redaction was verified.

### WebSockets

The event framing is consistent in the main paths. Client handles `conversation.updated` by invalidating queries, while server currently broadcasts an identifier rather than a full conversation object; README’s table is vague but implies metadata refresh. The manager has multi-tab sets and typing throttling, but catches only `(WebSocketDisconnect, RuntimeError)` on `send_json` (`ws/manager.py:34-40`). `websocket_endpoint` only disconnects/marks offline inside `except WebSocketDisconnect` (`ws/router.py:132-138`), so other exceptions can skip cleanup and stale online state. In `send_user`, cleanup from a send failure removes the last socket but does not call presence service. Client has 25-second ping, reconnect backoff, and query invalidation on reconnect; there is no explicit server heartbeat task. Invalid/expired token gets close code 4401, which the client’s generic `onclose` retries indefinitely (`lib/ws.ts:58-73`).

The lifespan worker is cancellable and test-gated (`main.py:24-52`), so startup does not block. Its live automatic broadcast could not be reproduced in the independent probe; report that as unverified, not as a confirmed implementation failure.

## 6. Frontend architecture and code quality

The `frontend/src` tree has app, components, hooks, lib, store, types and styles. It uses TypeScript strict mode, TanStack Query, Zustand and a native WebSocket wrapper. It does not follow the exact assignment subfolder decomposition everywhere, but reusable components are present.

* Files above ~300 lines: `frontend/src/components/chat/ChatView.tsx` = 440 lines; `frontend/src/app/globals.css` = 1,104 lines. Large single chat component and global stylesheet complicate change/review.
* Search found no `any`, `@ts-ignore`, `@ts-expect-error`, or `console.log` in frontend TS/TSX. No TS non-null assertions were found by the audit pattern search.
* There are API calls from screen/controller components via the API client: `Sidebar.tsx:29-47`, `NewChatModal.tsx:21-59`, `GroupInfoPanel.tsx:22-80`. This still centralizes transport in `lib`, but view components own query/mutation orchestration and the requested strict separation is only partial.
* `ChatView.tsx:38-43,87` ignores the conversation query’s loading/error state. A 403/404 or failed history query can leave “Loading conversation…” indefinitely. The history error is not rendered either.
* Modal has focus management and Escape handling (`ui/Modal.tsx:17-47`); forms have labels in many flows. Not every non-form icon/action has verified keyboard/accessibility behavior.
* `uiStore.ts:23-26`: each toast creates a timeout without cancelling an earlier timeout. If a second toast is shown within three seconds, the first timer can clear it prematurely.
* `useKeyboardShortcuts` adds/removes a listener as action object changes; likely cleanup prevents a leak, but recreated action closures cause listener churn.
* `PrivacySection.tsx:32-34` renders an inert “Blocked users Manage” row. `contact_service.toggle_block` merely toggles a flag; `message_service.create_message` does not consult it.
* `NotificationsSection.tsx:23-30` persists a sound preference that does not control sound; caption says sound support is not included.
* Static grep found no `TODO`, `FIXME`, or `console.log` in the files checked; no unused-dependency analysis tool was installed/run. `npm ci` installed dependency tree and package scripts worked.

Backend source uses type hints on public service/repository functions; full type coverage and vulture/ruff were not independently run. Backend function-length audit was not exhaustively automated. Tests: `python -m pytest -x -q` = **18 passed**. Frontend `npm run lint` passed; `npm run typecheck` passed after build generated `.next/types`; `npm run build` passed with elevated filesystem permissions. Clean-workspace typecheck-before-build remains unverified because its first local attempt saw a partially generated `.next` tree.

## 7. UI/UX similarity audit

Visual check: in-app browser at 1280×720 showed a clean desktop split layout, 64px rail, white sidebar, gray selection surfaces, blue outgoing message, light/dark theme control. A dark settings screenshot rendered the dark palette. These were visual inspections; capture files were not available to save, so there are no screenshot paths. Exact checks at 375px and 768px were not run.

| Area | Rating / 5 | Evidence and concrete gap |
|---|---:|---|
| Desktop nav/list/chat composition | 4 | Good rail and split layout (`globals.css:36-80`); sidebar overall width is 440px with 340px minimum, not the requested ~320–380px list pane. |
| Header details/actions | 3 | Name/presence/search/call/menu present in `ChatView`; exact menu affordances and last-seen formatting not fully verified. |
| Conversation rows | 3 | Avatar/title/time/preview/unread exist; visual similarity credible, no exhaustive group sender/unread matrix. |
| Bubble shape, colors, grouping | 3 | Correct blue/gray family; message max width is 75% in stylesheet versus target ~65%, group tails not exact. |
| Timestamp and receipt ticks | 3 | Timestamp and Unicode checks render; icons are plain glyphs rather than tailored Signal receipt marks. |
| Composer | 4 | Rounded composer, attach/emoji/send actions recognizable; tested send path. |
| Typography | 2 | CSS names Inter (`globals.css:17-20`) but no font import, `@font-face`, or `next/font` exists; browser uses fallback system font. |
| Avatars | 4 | Deterministic colored initial fallbacks and profile images. |
| Date dividers / typing | 3 | Source implements both; exact grouping and expiry behavior not comprehensively measured. |
| Unread badge / selection / hover | 3 | Implemented and visually plausible; fine-grain pixel match not evidenced. |
| Menus, modals, toasts | 3 | Modal focus handling exists; blocked management is inert and toast timer can race. |
| Settings structure | 3 | Profile/privacy/notifications/appearance and Coming Soon sections present; sound/block controls incomplete. |
| Dark theme | 4 | Dark screenshot and tokens look coherent; palette close to requested values. |
| Motion / scrollbar | 3 | Transitions/reduced-motion and thin scrollbar CSS exist; not measured against desktop app. |
| Responsive behavior | 2 | CSS breakpoint at 760px and mobile back button; 375/768 widths unverified, tablet layout may leave a cramped desktop split just above breakpoint. |
| Iconography/original assets | 4 | Lucide icons and original SVG mark; no Signal-branded assets observed. |

No copied Signal mark/brand assets were found in the inspected frontend. This is not a plagiarism determination.

## 8. Seed data and first-run experience

Seed source and tests report 10 users, 9 direct chats for the primary account, 3 groups, 210 messages, 60 contacts, reactions/replies, unread state, pin/mute, and a disappearing-enabled conversation. The seeded total is consistent with 9×18 direct plus 3×16 group messages. Seed test passes and the seeder returns early when users already exist. Startup creates schema, applies additive legacy upgrades, seeds only outside test mode (`main.py:25-33`).

Both documented demo accounts (`+91 90000 00001` and `+91 90000 00002`, OTP `123456`) logged in during the independent smoke. Restart persistence passed for the tested conversation, message, and group. A clean clone setup was not completed exactly: backend `pip install -r requirements.txt` could not fetch `python-jose==3.5.0` because the sandbox DNS/network could not resolve the package index. The repository also lists `python-jose` though sessions use stdlib opaque random tokens; this is unnecessary dependency/config drift.

## 9. Documentation and deliverables audit

README has setup, stack, demo credentials, architecture, Mermaid ER, schema/constraints, REST and WS overviews, state machine, assumptions, mocked functionality, deployment, tests and known limitations. Screenshot placeholder is not a screenshot. DEPLOY.md is detailed and beginner-oriented, but no deployment was attempted because there is no public remote and external platform setup is unavailable. `render.yaml` defines backend Docker root, `/health`, persistent `/data` disk and `sqlite:////data/signal.db`; frontend Vercel configuration is at `frontend/vercel.json` and DEPLOY tells user to set root directory. Production CORS and `wss://` values are documented, not verified.

`.gitignore` excludes `.env*`, DB files, uploads, `node_modules`, and `.next`; `git ls-files` showed no tracked env/DB/uploads/node_modules paths. No public remote is configured (`git remote -v` empty). No hosted URL found. Git history contains feature/fix/docs-style commits rather than one initial dump; it does not prove independent authorship. No suspicious third-party clone headers were found.

CI workflow has backend pytest and frontend install/lint/typecheck/build steps. It also runs `npm run format:check`; reproduced local failure on `frontend/tsconfig.json`. Thus workflow is expected to fail at format step until that tracked file is formatted. GitHub execution itself is unverified (no remote).

README setup commands are syntactically coherent. Literal setup was blocked at pip installation by sandbox network/DNS (`No matching distribution found for python-jose==3.5.0` after retries). Frontend `npm ci` succeeded when run with elevated filesystem permission; regular sandbox attempt failed with EPERM. Do not interpret these sandbox limits as a universal package availability issue.

## 10. Interview readiness

`INTERVIEW_NOTES.md` provides explanations and 15 questions, but the following complex points need correction/rehearsal:

1. **Connection manager**: dead-socket failure only removes socket; it does not persist offline state or publish presence. Unexpected endpoint exceptions bypass cleanup.
2. **Receipt aggregation**: notes claim aggregation derives from active recipients, but `aggregate_status` reads receipt rows; removed participants’ receipts are not filtered.
3. **List/unread query**: notes do not explain N+1 queries or full-row unread materialization.
4. **WS auth/reconnect**: opaque session hashes are DB checked; no JWT. Client will retry invalid-token close indefinitely.
5. **Disappearing-message worker**: service-level purge test is not a worker integration test; live probe timed out.
6. **Pydantic boundary**: schema classes are imported by services, against documented boundary rule.
7. **Group role lifecycle**: service lets an admin demote the last admin and has no safeguard against adminless group.
8. **Uploads**: data type and size are validated, but uploaded URLs are publicly served and there is no authenticated media read.
9. **Direct conversation race**: uniqueness is DB enforced, but concurrent create does not recover a unique-key conflict.
10. **Frontend error/loading state**: missing conversation data renders loading forever, hiding authorization/network errors.

`INTERVIEW_NOTES.md:9` says failed sockets are removed (true) but implies first/last connection behavior is robust (not robust for send failures). At line 42 it says aggregate is computed from “all active recipients”; code does not filter active memberships. README says JWT_SECRET creates opaque tokens, contradicted by `security.py`/`auth_service.py`. PROGRESS claims format check passes; it currently fails.

## 11. Claims vs reality

| Claim | Source | Audit result |
|---|---|---|
| “18 tests passed” | `PROGRESS.md:54` | **Reproduced**: `python -m pytest -x -q` reported 18 passed. |
| “format check, lint, typecheck, build all passed” | `PROGRESS.md:44,54` | **Not currently true**: `npm run format:check` flags `tsconfig.json`; lint passes; typecheck passed after build; build passed elevated. |
| “live two-account smoke passed” | `PROGRESS.md:54` | **Reproduced** for listed checks: direct/group create, admin denial, typing, both-way messages, receipts. |
| “restart verification confirmed conversation/message/group persistence” | `PROGRESS.md:54` | **Reproduced** by smoke script restart mode. |
| “automatic disappearing purge and deletion broadcast” | `PROGRESS.md:35`, `GAPS.md:11` | **Partially supported**: direct service test covers purge and broadcast helper; independent running-worker probe timed out waiting for WS deletion event. |
| “all group member role controls work” | `PROGRESS.md:41` | **Partially supported**: UI and backend paths exist and backend denial tested; last admin can be removed/demoted. |
| “blocked user management” implied by settings | README feature language / UI | **False/inert**: row is not interactive and block does not prevent message send. |
| “JWT_SECRET used to create opaque random session tokens” | README:55; DEPLOY:20-25 | **False**: random token generation/hash code does not read configured secret. |
| “conversation.updated refreshes group metadata” | README:239 | **Partial**: client invalidates queries, server payload contains conversation ID rather than conversation object. |
| “exact Signal-like layout / pixel polish” | README/PROGRESS | **Overstated**: broad layout is similar; Inter isn’t loaded, list pane width is outside target, bubbles max at 75%, exact viewport checks absent. |
| “CI-ready” | README/PROGRESS and workflow | **False at current tree**: mandatory CI format check fails locally. GitHub CI not run. |
| “public repo and hosted demo” | requested deliverable | **Absent**: empty remotes and no live URL. |
| “clean working tree / servers stopped” in prior completion summary | prior final summary referenced by task | Audit began with clean tree. Local dev listeners were absent on ports 3000 and 8000 at cleanup check. |

## 12. Prioritized defects and recommended manual checks

### Defect list (highest impact first)

| ID | Severity | Evaluation impact | Repro / evidence | Suggested fix (text only) |
|---|---|---|---|---|
| D-01 | BLOCKER | Deliverables, functionality evaluation | `git remote -v` empty; README has no live demo URL; no deploy verification | Publish repository and deploy both services, then provide a reachable demo URL and verify CORS/WS. |
| D-02 | HIGH | CI, code quality | In `frontend/`: `npm run format:check` → `[warn] tsconfig.json`, exit failure; workflow runs it before lint/build | Format the config or adjust formatter scope, then rerun the exact CI sequence on a clean checkout. |
| D-03 | HIGH | Privacy, contact workflows | `PrivacySection.tsx:32-34` is static text; `contact_service.py:48-55` only toggles; `message_service.py:17-65` does not check block | Add interactive blocked-user management and enforce block policy in contact/conversation/message authorization, with direct API tests. |
| D-04 | HIGH | Privacy/security, attachments | `main.py:96` mounts public `StaticFiles`; attachment URLs are returned by `message_service.py:220` and `upload_service.py:105` | Serve media through authenticated/authorized endpoint or short-lived access tokens; cover cross-user access in tests. |
| D-05 | HIGH | Real-time correctness, presence | `manager.py:34-40` catches only RuntimeError/WSDisconnect and removes socket; `router.py:132-138` updates presence only on WebSocketDisconnect | Put unregister/presence transition in robust `finally`, handle all disconnect send errors, and test abrupt client/network failures. |
| D-06 | HIGH | Group messaging receipts | `message_service.py:144-156` aggregate reads receipt rows; group removal only sets participant `left_at` (`group_service.py:77-92`) | Define recipient set at send time or filter receipts by policy; reconcile receipts when a member leaves and test aggregate transitions. |
| D-07 | HIGH | Backend performance/database | `conversation_service.py:42-84` multiple per-chat lookups; unread `.all()` then `len` at 59-70 | Replace loop with joined queries and SQL `COUNT`, cap/search in database, and add query-count/performance test. |
| D-08 | MEDIUM | UX/error handling | `ChatView.tsx:38-43,87` ignores query errors and reports loading whenever conversation is absent | Render explicit loading, not-found/forbidden, retryable network error, and history error states. |
| D-09 | MEDIUM | Disappearing messages/real-time | `main.py:45-52` worker; live probe timed out; only direct service test confirmed | Add TestClient lifespan integration using short timer and assert DB tombstone plus WS event; inspect worker logs. |
| D-10 | MEDIUM | Group admin authorization/lifecycle | `group_service.py:95-111` sets requested role without last-admin guard; remove supports admin self-removal | Prevent last admin demotion/removal or require transfer; test direct API behavior. |
| D-11 | MEDIUM | UI visual similarity | `globals.css:17-20` references Inter but no font load; width at 43-45 is 440px; bubble width styling 75% | Load Inter (or document fallback), match list width and bubble width, capture/compare at assigned desktop/mobile sizes. |
| D-12 | MEDIUM | Auth/reconnect correctness | `lib/ws.ts:58-73` retries every close, including server 4401 invalid/revoked session | Detect auth close, clear session and stop reconnect; test revoked token while socket is open. |
| D-13 | MEDIUM | Conversation correctness | `conversation_service.py:28-38` query-then-insert; unique direct key but no conflict recovery | Catch integrity conflict and read winner transactionally; concurrent direct-create test. |
| D-14 | MEDIUM | Layering/code quality | Routes query repository directly (`api/v1/messages.py:61-64,79-82`); services accept Pydantic request objects | Move reads/use-case orchestration into services and map request schemas at API boundary. |
| D-15 | LOW | Frontend notifications | `uiStore.ts:23-26` untracked toast timeout | Cancel/replace existing timeout or key timer to the displayed toast. |
| D-16 | LOW | Data integrity/migration | `db/migrations.py` additive changes do not rebuild legacy tables to add ORM checks | Add explicit SQLite table rebuild migration and verify constraints on upgraded DB. |
| D-17 | LOW | API/documentation | `JWT_SECRET` docs/config are unused; WS event docs imply conversation object | Remove unused secret dependency or implement its intended role; document actual event shapes. |

### Recommended fix order

1. Publish/deploy and provide live URL (D-01); fix CI format (D-02).
2. Protect media and enforce blocking (D-03, D-04).
3. Repair WebSocket cleanup/reconnect, receipt semantics, and disappearing-worker integration tests (D-05, D-06, D-09, D-12).
4. Add group last-admin safeguard and concurrent DM conflict recovery (D-10, D-13).
5. Improve conversation query shape, error states, and migration parity (D-07, D-08, D-16).
6. Finish visual polish and boundary/documentation cleanup (D-11, D-14, D-15, D-17).

### Human confirmation checklist (two browser profiles)

1. Start from an empty persistent DB and open two isolated browser profiles. Register/login as `+91 90000 00001` and `+91 90000 00002` with OTP `123456`; set different profile names/avatars; refresh both and confirm sessions remain; log out one and verify it returns to welcome.
2. From profile A, add B as a contact, create/open a direct chat, send several messages including reply and reaction. Verify B sees them without refresh, sender sees sent then delivered, opening chat on B changes to read, and timestamps/order survive refresh.
3. With B offline, send another message from A; reconnect B and verify it appears once and A’s status advances. Open the same B account in two tabs, close one, and ensure presence stays online until the second closes.
4. In direct chat, type and stop; verify typing is broadcast and disappears after stopping/timeout. Force-close a socket and verify reconnect/resync; revoke/log out while connected and ensure no infinite reconnect loop.
5. Create a group with at least three users; send a group message, record delivered/read state from each recipient, remove one member, then verify remaining participants can still advance aggregate status and removed member cannot list/read/send. Try every admin endpoint as non-admin directly; verify 403. Attempt to demote/remove the final admin.
6. Test blocked-user behavior in both directions. Upload a valid image/file, then try another account’s URL, an oversized file, mismatched MIME/signature, path-like filename, and unsupported extension.
7. Set disappearing time to a short interval, send a message, wait through the actual worker cycle, and verify tombstone in DB plus deletion broadcast in every connected client; restart backend and confirm it stays deleted.
8. Seed more than 30 messages with matching timestamps; paginate upward and confirm no duplicates or gaps. Test empty/oversize messages, script tags in body/name, SQL metacharacters in search, and duplicate DM creation from simultaneous requests.
9. Inspect at 1280×800, 768×1024 and 375×812 in light/dark modes. Exercise compose/search/escape/Alt+arrows/Enter/Shift+Enter and verify dialogs trap focus and return focus.
10. Run the exact README setup and CI commands on a clean clone. Confirm the published URL, CORS, TLS WebSocket (`wss://`), Render disk persistence, health check and deployment logs.

## Verification record

* `python -m pytest -x -q`: **18 passed**.
* `npm ci --no-audit --no-fund --prefer-offline --loglevel=error`: passed with elevated filesystem permission; regular sandbox attempt had EPERM.
* `npm run format:check`: **failed**, `frontend/tsconfig.json` reported by Prettier.
* `npm run lint`: passed.
* `npm run typecheck`: passed after production build generated `.next/types`; clean checkout ordering remains unverified.
* `npm run build`: passed with elevated filesystem permission; normal sandbox attempt hit EPERM writing `.next`.
* `backend/scripts/smoke_e2e.py` plus restart verification: **passed** for described checks.
* TestClient probes: OTP replay 401; self contact 422; sequential duplicate DM same ID; empty/oversize message 422; SQL injection-shaped search 200/0 rows; removed member read 403; application engine foreign keys enabled.
* Disappearing-message worker live probe: **timed out waiting for `message.deleted`**. Direct purge service unit test passed; worker/broadcast remains unverified.
* Browser visual inspection: desktop 1280×720 and dark settings observed; screenshots were not saved as files. 375px and 768px behavior unverified.
* Cleanup: no listener was present on ports 3000 or 8000 at the final server check. Audit began with a clean Git tree; this report is the only intended working-tree addition.
