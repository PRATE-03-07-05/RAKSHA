/**
 * Offline persistence layer — real IndexedDB with a localStorage fallback.
 * Stores the sync queue (SyncOp). Medical observations in the main store are
 * append-only, so replaying queued ops is non-destructive by construction.
 */
import type { SyncOp } from "./types";

const DB_NAME = "raksha-offline";
const STORE = "sync_ops";
const LS_KEY = "raksha.syncops.v1";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}

function lsRead(): SyncOp[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as SyncOp[]; } catch { return []; }
}
function lsWrite(ops: SyncOp[]) { localStorage.setItem(LS_KEY, JSON.stringify(ops)); }

export async function syncOpsAll(): Promise<SyncOp[]> {
  const db = await open();
  if (!db) return lsRead();
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      tx.onsuccess = () => resolve((tx.result as SyncOp[]) || []);
      tx.onerror = () => resolve(lsRead());
    } catch { resolve(lsRead()); }
  });
}

export async function syncOpsPut(op: SyncOp): Promise<void> {
  const db = await open();
  if (!db) {
    const ops = lsRead().filter(o => o.id !== op.id);
    ops.push(op); lsWrite(ops); return;
  }
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function syncOpsRemove(id: string): Promise<void> {
  const db = await open();
  if (!db) { lsWrite(lsRead().filter(o => o.id !== id)); return; }
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}
