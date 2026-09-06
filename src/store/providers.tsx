/** App-wide providers: Toasts → Auth → i18n → Connectivity/Sync. Plus the useApi hook. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, setOfflineProbe, registerSyncBridge, subscribe, SESSION_KEY } from "./backend";
import { translate, LANGS, type Lang, type TKey } from "../lib/i18n";
import { syncOpsAll, syncOpsPut, syncOpsRemove } from "../lib/idb";
import type { User, SyncOp } from "../lib/types";

/* ------------------------------------------------------------------ toasts */

interface Toast { id: number; msg: string; kind: "success" | "error" | "info" | "warning"; }
const ToastCtx = createContext<{ toast: (msg: string, kind?: Toast["kind"]) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const toast = useCallback((msg: string, kind: Toast["kind"] = "success") => {
    const id = idRef.current++;
    setToasts(t => [...t, { id, msg, kind }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const palette: Record<Toast["kind"], string> = {
    success: "border-brand-300 bg-brand-50 text-brand-900",
    error: "border-rose-300 bg-rose-50 text-rose-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    info: "border-sky-300 bg-sky-50 text-sky-900",
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`anim-fade-up rounded-lg border px-4 py-3 text-sm font-medium shadow-pop ${palette[t.kind]}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------------------------------------------- auth */

interface SafeUser extends Omit<User, "password"> {}
interface AuthShape {
  user: SafeUser | null; booting: boolean;
  login: (email: string, password: string) => Promise<SafeUser>;
  logout: () => void;
}
const AuthCtx = createContext<AuthShape>({ user: null, booting: true, login: async () => { throw new Error("no provider"); }, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [booting, setBooting] = useState(true);
  const { toast } = useToast();
  const userRefLogout = useRef<SafeUser | null>(null);
  userRefLogout.current = user;

  useEffect(() => {
    let alive = true;
    (async () => {
      // Real session restore: validates the JWT server-side via GET /auth/me.
      if (localStorage.getItem(SESSION_KEY)) {
        try {
          const u = await api.sessionUser();
          if (alive && u) { const { password: _p, ...safe } = u; void _p; setUser(safe); }
        } catch { /* invalid/expired token — stay signed out */ }
      }
      if (alive) setBooting(false);
    })();
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem(SESSION_KEY, res.token);
    setUser(res.user);
    toast(`Signed in as ${res.user.name}`, "success");
    return res.user;
  }, [toast]);

  const logout = useCallback(() => {
    const u = userRefLogout.current;
    if (u) api.logout(u as User);
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, booting, login, logout }}>{children}</AuthCtx.Provider>;
}

/* -------------------------------------------------------------------- i18n */

interface I18nShape { lang: Lang; setLang: (l: Lang) => void; t: (key: TKey, vars?: Record<string, string | number>) => string; langs: typeof LANGS; }
const I18nCtx = createContext<I18nShape>({ lang: "en", setLang: () => {}, t: k => translate("en", k), langs: LANGS });
export const useI18n = () => useContext(I18nCtx);

function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("raksha.lang") as Lang) || "en");
  const setLang = useCallback((l: Lang) => { setLangState(l); localStorage.setItem("raksha.lang", l); }, []);
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

/* ------------------------------------------------------- connectivity+sync */

interface SyncCounts { pending: number; synced: number; failed: number; lastSyncAt: number | null; ops: SyncOp[]; }
interface ConnShape {
  netOnline: boolean; simOffline: boolean; setSimOffline: (v: boolean) => void;
  offline: boolean; syncing: boolean; counts: SyncCounts; idbCount: number;
  /** True once the backend /health probe has succeeded (not just navigator.onLine). */
  serverReachable: boolean;
  syncNow: () => Promise<void>; retryFailed: () => Promise<void>;
}
const ConnCtx = createContext<ConnShape>({
  netOnline: true, simOffline: false, setSimOffline: () => {}, offline: false, syncing: false,
  counts: { pending: 0, synced: 0, failed: 0, lastSyncAt: null, ops: [] }, idbCount: 0,
  serverReachable: true,
  syncNow: async () => {}, retryFailed: async () => {},
});
export const useConn = () => useContext(ConnCtx);

function ConnProvider({ children }: { children: React.ReactNode }) {
  const [netOnline, setNetOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [simOffline, setSimOfflineState] = useState<boolean>(() => localStorage.getItem("raksha.simOffline") === "1");
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState<SyncCounts>({ pending: 0, synced: 0, failed: 0, lastSyncAt: null, ops: [] });
  const [idbCount, setIdbCount] = useState(0);
  const [serverReachable, setServerReachable] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const offline = !netOnline || simOffline;
  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const userRef = useRef(user); userRef.current = user;

  const refresh = useCallback(async () => {
    const s = await api.syncState();
    setCounts(s);
    const ops = await syncOpsAll();
    setIdbCount(ops.filter(o => o.status !== "SYNCED").length);
  }, []);

  useEffect(() => {
    setOfflineProbe(() => offlineRef.current);
    registerSyncBridge({
      persist: op => { void syncOpsPut(op); },
      drain: ids => { ids.forEach(id => void syncOpsRemove(id)); },
    });
    void refresh();
    const unsub = subscribe(() => void refresh());
    const on = () => setNetOnline(true);
    const off = () => setNetOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { unsub(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refresh]);

  const setSimOffline = useCallback((v: boolean) => {
    setSimOfflineState(v);
    localStorage.setItem("raksha.simOffline", v ? "1" : "0");
  }, []);

  const syncNow = useCallback(async () => {
    const u = userRef.current;
    if (!u) { toast("Sign in to synchronize.", "warning"); return; }
    if (offlineRef.current) { toast(t("changesWillSync"), "warning"); return; }
    setSyncing(true);
    try {
      await api.syncNow(u as User);
      toast(`${t("synced")}: ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
      void refresh();
    }
  }, [toast, t, refresh]);

  const retryFailed = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  // Auto-sync when connectivity returns
  const prevOffline = useRef(offline);
  useEffect(() => {
    if (prevOffline.current && !offline && counts.pending + counts.failed > 0) {
      void syncNow();
    }
    prevOffline.current = offline;
  }, [offline, counts.pending, counts.failed, syncNow]);

  // Backend reachability probe — the browser can report "online" while the
  // RAKSHA server is unreachable; the status indicator must reflect reality.
  useEffect(() => {
    let alive = true;
    const ping = () => {
      api.health()
        .then(() => { if (alive) setServerReachable(true); })
        .catch(() => { if (alive) setServerReachable(false); });
    };
    ping();
    const iv = window.setInterval(ping, 40000);
    return () => { alive = false; window.clearInterval(iv); };
  }, []);

  const value = useMemo(() => ({
    netOnline, simOffline, setSimOffline, offline, syncing, counts, idbCount, serverReachable, syncNow, retryFailed,
  }), [netOnline, simOffline, setSimOffline, offline, syncing, counts, idbCount, serverReachable, syncNow, retryFailed]);

  return <ConnCtx.Provider value={value}>{children}</ConnCtx.Provider>;
}

/* ------------------------------------------------------------------ useApi */

export function useApi<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fnRef.current()
      .then(d => { if (alive) { setData(d); setError(null); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Something went wrong"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => subscribe(() => setTick(x => x + 1)), []);

  return { data, loading, error, reload: () => setTick(x => x + 1) };
}

/** IntersectionObserver reveal-on-scroll. */
export function useReveal<T extends HTMLElement>(): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { el.classList.add("is-in"); io.unobserve(el); } });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <I18nProvider>
        <AuthProvider>
          <ConnProvider>{children}</ConnProvider>
        </AuthProvider>
      </I18nProvider>
    </ToastProvider>
  );
}
