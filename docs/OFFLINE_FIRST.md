# RAKSHA — Offline-First Architecture

> *"Connecting Rural Healthcare. Closing the Referral Loop — even when
> connectivity is unreliable."*

Rural connectivity is intermittent by nature. RAKSHA is built so that an
ASHA/ANM in the field can keep working when the network drops, and so that
**PostgreSQL remains the single source of truth** once connectivity returns.

---

## 1. The two modes

```
ONLINE                                   OFFLINE
React → FastAPI → PostgreSQL             React → IndexedDB (pending queue)
        (authoritative)                            (local capture only)

WHEN CONNECTIVITY RETURNS
IndexedDB queue → Sync Manager → POST /sync/batch → FastAPI → PostgreSQL
                                                              ↓
                              per-op result → IndexedDB updated → UI refreshed
```

- **Online:** every read and write goes straight to FastAPI. Responses are
  mirrored into an in-memory replica (and permitted patient profiles into
  IndexedDB) purely for speed and offline availability.
- **Offline:** reads are served from the local cache; supported writes are
  validated locally, stored in IndexedDB as `PENDING`, and clearly labelled
  *"saved offline — pending synchronization"*. **Nothing is ever reported as
  submitted to the server until the server confirms it.**

## 2. Service Worker (`public/sw.js`)

Registered in `src/main.tsx` on page load. Responsibilities are deliberately
narrow:

| Concern | Behaviour |
|---|---|
| App shell | Network-first for navigations; cached shell answers when offline |
| Static assets | Cache-first (hashed, immutable) |
| Cache versioning | `raksha-shell-v1`; old caches purged on activate |
| API traffic | **Never intercepted or cached** — the FastAPI origin is cross-origin and explicitly skipped; only same-origin GETs are handled |
| Secrets | No tokens, passwords or API responses ever enter the cache |

Result: after one online visit, refreshing with the network disabled still
loads the application shell (Chrome → DevTools → Application → Service
Workers shows RAKSHA's worker activated and running).

## 3. IndexedDB (`src/lib/idb.ts`)

Database **`raksha-offline` v2** — visible in DevTools → Application →
IndexedDB:

| Store | Purpose |
|---|---|
| `sync_ops` | pending / synced / failed operation queue (keyed by operation id → idempotent) |
| `cached_patients` | role-permitted patient profiles for offline field workflows |
| `meta` | sync metadata (last cache warm, watermarks) |

A localStorage fallback exists only for browsers without IndexedDB; the
primary path is IndexedDB. **IndexedDB is a cache + queue, never the
database.** PostgreSQL is authoritative after sync.

### Offline data policy
- Only data the signed-in role is already permitted to see is cached
  (the server enforces the scoping; the client stores what it was allowed
  to fetch).
- No JWTs, passwords or raw API response blobs are stored.
- Offline authentication policy: **offline mode requires a previously
  authenticated session.** You cannot log in or switch roles while offline;
  the current session may continue permitted field capture.

## 4. The write queue

Every queued operation carries: `id` (client-generated, stable), `ts`,
`entity`, `operation`, `payload`, `status` (`PENDING` / `SYNCED` / `FAILED`),
`attempts`, `error`.

Supported offline captures (field workflow):

| Operation | Entity | Offline? |
|---|---|---|
| Register patient | `patient` | ✅ queued |
| Record visit | `visit` | ✅ queued |
| Record vitals | `vital` | ✅ queued |
| Assessment inputs | `assessment` | ✅ queued (see §6) |
| Follow-up | `followup` | ✅ queued |
| Create referral | `referral` | ✅ queued — shown as **"Pending synchronization — NOT delivered"** until the server confirms |
| Referral transitions, consultations, emergencies | — | ❌ require a live connection (fail loudly, never queued) |

Queued operations are **only removed after the server confirms success**
(`APPLIED`). Conflicts and failures are retained with their error text.

## 5. Synchronization & conflicts

`Sync Now` (and automatic sync on the `online` event) drains the queue via
`POST /sync/batch`:

- **Idempotency:** the client operation id is the ledger primary key;
  replaying a batch never creates duplicates.
- **Append-only events** (visits, vitals, referral events) merge without
  conflict by construction.
- **Optimistic concurrency:** patient updates carry a `version`; if the
  server row is newer, the operation is recorded as `CONFLICT` and reported
  as *"Sync conflict — review required"* — the server never silently
  overwrites newer data, and the client keeps the failed op for review.
- **Retry limit:** 5 attempts per operation; exhausted ops stay `FAILED`
  (never deleted) until a human retries or resolves them.
- **Partial failure:** each operation gets an individual result; one bad op
  does not block the rest of the batch.

## 6. AI / ML behaviour offline (honesty rule)

The ML triage model runs **server-side only**.

- **Online:** `POST /triage/assess` → trained model (or rule fallback) →
  result + explanation → stored as an assessment.
- **Offline:** the client queues **only the raw assessment inputs** and shows
  a clearly labelled *provisional* read from the transparent local rule
  engine (`mode: OFFLINE_PROVISIONAL`). When connectivity returns, the sync
  endpoint **re-evaluates the inputs with the active server-side engine** and
  stores the authoritative assessment. No ML result is ever fabricated
  offline, and the UI says so.

## 7. Status indicator

The header chip reflects reality, not just `navigator.onLine`:

| State | Meaning |
|---|---|
| 🟢 Online | browser online **and** backend `/health` reachable (probed every 40 s) |
| 🟠 Offline | network down or simulation toggle active |
| 🔄 Syncing | sync batch in flight |
| ⚠ Sync error · n | n operations failed to sync (retained for retry) |
| ⚠ Server unreachable | browser online but the backend health probe fails |

## 8. Limitations (stated, not hidden)

- Offline mode needs a session that was authenticated while online.
- Offline-created referrals are **not** visible to the receiving facility
  until synchronization succeeds.
- The service worker caches the app shell, not live data; stale screens show
  the offline banner rather than pretending freshness.
- SMS/FCM/push are outbox-only unless real credentials are configured.

## 9. Verifying offline behaviour (acceptance checklist)

1. `docker compose up -d --build` → open `http://localhost:5173`, log in as ASHA.
2. DevTools → Application → **Service Workers**: RAKSHA worker activated.
3. Application → **IndexedDB**: `raksha-offline` with `sync_ops`,
   `cached_patients`, `meta`.
4. DevTools → Network → **Offline** → refresh: the shell still loads.
5. Record a visit + vitals → toasts say *"saved offline / pending"*.
6. `docker compose exec db psql -U raksha -c "select count(*) from visits"` —
   count unchanged (nothing reached PostgreSQL yet).
7. Network → Online → Sync Now (or wait for auto-sync) →
   `POST /sync/batch` in the Network tab → ops flip to SYNCED.
8. Re-run the SQL count — records now persisted; UI refreshed.
9. Force a conflict (edit the same patient in two sessions, sync the stale
   one) → *"Sync conflict — review required"*, nothing overwritten.
10. Replay the same batch → `duplicates` reported, no duplicate rows.
