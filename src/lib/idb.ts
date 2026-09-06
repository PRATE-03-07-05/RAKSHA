/**
 * RAKSHA offline persistence — IndexedDB (with a localStorage fallback for
 * environments without IDB).
 *
 * Database: "raksha-offline" (v2)
 *  - sync_ops        pending/synced/failed operation queue (idempotent by op id)
 *  - cached_patients permitted patient profiles for offline field workflows
 *  - meta            sync metadata (last warm, sync watermark, …)
 *
 * Rules:
 *  - PostgreSQL stays authoritative; this DB is cache + queue only.
 *  - Queued ops are only ever removed after the server CONFIRMS success.
 *  - No API responses, tokens or passwords are stored here.
 */
import type { SyncOp } from "./types";

const DB_NAME = "raksha-offline";
const DB_VERSION = 2;
const OPS = "sync_ops";
const PATIENTS = "cached_patients";
const META = "meta";
const LS_KEY = "raksha.syncops.v1";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(PATIENTS)) db.createObjectStore(PATIENTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function lsRead(): SyncOp[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as SyncOp[]; } catch { return []; }
}
function lsWrite(ops: SyncOp[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(ops)); } catch { /* full */ } }

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest, fallback: T): Promise<T> {
  return open().then(db => new Promise<T>(resolve => {
    if (!db) { resolve(fallback); return; }
    try {
      const t = db.transaction(store, mode);
      const r = run(t.objectStore(store));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => resolve(fallback);
    } catch { resolve(fallback); }
  }));
}

/* ------------------------------------------------------------- sync queue */

export async function syncOpsAll(): Promise<SyncOp[]> {
  const ops = await tx<SyncOp[]>(OPS, "readonly", s => s.getAll(), lsRead());
  return ops ?? lsRead();
}

export async function syncOpsPut(op: SyncOp): Promise<void> {
  const db = await open();
  if (!db) {
    const ops = lsRead().filter(o => o.id !== op.id);
    ops.push(op); lsWrite(ops); return;
  }
  await tx(OPS, "readwrite", s => s.put(op), null);
}

export async function syncOpsRemove(id: string): Promise<void> {
  const db = await open();
  if (!db) { lsWrite(lsRead().filter(o => o.id !== id)); return; }
  await tx(OPS, "readwrite", s => s.delete(id), null);
}

/* -------------------------------------------------------- patient cache */

export interface CachedPatientRecord { id: string; cachedAt: number; data: unknown }

export async function cachedPatientsPutMany(patients: { id: string }[]): Promise<void> {
  const db = await open();
  if (!db || patients.length === 0) return;
  return new Promise(resolve => {
    try {
      const t = db.transaction(PATIENTS, "readwrite");
      const store = t.objectStore(PATIENTS);
      patients.slice(0, 250).forEach(p => store.put({ id: p.id, cachedAt: Date.now(), data: p }));
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function cachedPatientsAll(): Promise<{ id: string }[]> {
  const rows = await tx<CachedPatientRecord[]>(PATIENTS, "readonly", s => s.getAll(), []);
  return (rows ?? []).map(r => r.data as { id: string });
}

/* ----------------------------------------------------------------- metadata */

export async function metaSet(key: string, value: unknown): Promise<void> {
  await tx(META, "readwrite", s => s.put({ key, value, at: Date.now() }), null);
}

export async function metaGet<T>(key: string): Promise<T | null> {
  const row = await tx<{ key: string; value: T } | undefined>(META, "readonly", s => s.get(key), undefined);
  return row?.value ?? null;
}
