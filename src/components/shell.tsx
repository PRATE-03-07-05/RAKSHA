/** App shell: role-aware sidebar, topbar (connectivity, language, notifications), offline banner. */
import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Menu, X, Bell, Wifi, WifiOff, RefreshCw, LogOut, LayoutDashboard, Users, UserPlus,
  HeartPulse, Signpost, ClipboardList, CalendarDays, Video, UserCircle, Building2,
  ScrollText, Settings, Siren, ListOrdered, Activity, BellRing, CheckCheck, CloudOff,
  AlertTriangle,
} from "lucide-react";
import { useAuth, useI18n, useConn, useApi } from "../store/providers";
import { api } from "../store/backend";
import type { Role } from "../lib/types";
import { cx, relTime } from "../lib/utils";
import { Avatar, Btn, Pill } from "./ui";
import type { TKey } from "../lib/i18n";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2l11 4v9c0 7.5-4.7 12.6-11 15C9.7 27.6 5 22.5 5 15V6l11-4z" fill="#0f3d33" />
      <path d="M9 16h4l2-5 3 9 2-4h3" stroke="#4ade80" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  PATIENT: "Patient", ASHA: "ASHA Worker", ANM: "ANM", PHC_STAFF: "PHC Staff",
  PHC_DOCTOR: "PHC Doctor", CHC_DOCTOR: "CHC Doctor", SPECIALIST: "Specialist", DISTRICT_ADMIN: "District Admin",
};

interface NavItem { to: string; key: TKey; icon: React.ReactNode; end?: boolean }

/* Shared nav lists are hoisted ABOVE `NAV` on purpose: referencing them from
 * the `NAV` initializer is safe, whereas a helper that reads `NAV` during its
 * own initialization hits the temporal dead zone (blank-page ReferenceError). */
const ASHA_NAV: NavItem[] = [
  { to: "/app/dashboard", key: "dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { to: "/app/patients", key: "patients", icon: <Users className="h-[18px] w-[18px]" /> },
  { to: "/app/register", key: "registerPatient", icon: <UserPlus className="h-[18px] w-[18px]" /> },
  { to: "/app/assess", key: "riskAssessment", icon: <HeartPulse className="h-[18px] w-[18px]" /> },
  { to: "/app/referrals", key: "referrals", icon: <Signpost className="h-[18px] w-[18px]" /> },
  { to: "/app/followups", key: "followups", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: "/app/sync", key: "syncCenter", icon: <RefreshCw className="h-[18px] w-[18px]" /> },
  { to: "/app/notifications", key: "notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
];
const DOCTOR_NAV_ITEMS: NavItem[] = [
  { to: "/app/dashboard", key: "dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { to: "/app/queue", key: "patientQueue", icon: <ListOrdered className="h-[18px] w-[18px]" /> },
  { to: "/app/patients", key: "patients", icon: <Users className="h-[18px] w-[18px]" /> },
  { to: "/app/referrals", key: "referrals", icon: <Signpost className="h-[18px] w-[18px]" /> },
  { to: "/app/tele", key: "teleconsultation", icon: <Video className="h-[18px] w-[18px]" /> },
  { to: "/app/emergency", key: "emergency", icon: <Siren className="h-[18px] w-[18px]" /> },
  { to: "/app/followups", key: "followups", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { to: "/app/notifications", key: "notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
];

const NAV: Record<Role, NavItem[]> = {
  PATIENT: [
    { to: "/app/home", key: "home", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    { to: "/app/record", key: "myRecord", icon: <HeartPulse className="h-[18px] w-[18px]" /> },
    { to: "/app/journey", key: "careJourney", icon: <Activity className="h-[18px] w-[18px]" /> },
    { to: "/app/appointments", key: "appointments", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
    { to: "/app/referrals", key: "referrals", icon: <Signpost className="h-[18px] w-[18px]" /> },
    { to: "/app/tele", key: "teleconsultation", icon: <Video className="h-[18px] w-[18px]" /> },
    { to: "/app/notifications", key: "notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
    { to: "/app/profile", key: "profile", icon: <UserCircle className="h-[18px] w-[18px]" /> },
  ],
  ASHA: ASHA_NAV,
  ANM: ASHA_NAV,
  PHC_STAFF: [
    { to: "/app/dashboard", key: "dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    { to: "/app/patients", key: "patients", icon: <Users className="h-[18px] w-[18px]" /> },
    { to: "/app/register", key: "registerPatient", icon: <UserPlus className="h-[18px] w-[18px]" /> },
    { to: "/app/referrals", key: "referrals", icon: <Signpost className="h-[18px] w-[18px]" /> },
    { to: "/app/sync", key: "syncCenter", icon: <RefreshCw className="h-[18px] w-[18px]" /> },
    { to: "/app/notifications", key: "notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
  ],
  PHC_DOCTOR: DOCTOR_NAV_ITEMS,
  CHC_DOCTOR: DOCTOR_NAV_ITEMS,
  SPECIALIST: DOCTOR_NAV_ITEMS,
  DISTRICT_ADMIN: [
    { to: "/app/dashboard", key: "dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    { to: "/app/facilities", key: "facilities", icon: <Building2 className="h-[18px] w-[18px]" /> },
    { to: "/app/patients", key: "patients", icon: <Users className="h-[18px] w-[18px]" /> },
    { to: "/app/referrals", key: "referrals", icon: <Signpost className="h-[18px] w-[18px]" /> },
    { to: "/app/bottlenecks", key: "bottlenecks", icon: <Activity className="h-[18px] w-[18px]" /> },
    { to: "/app/audit", key: "auditLogs", icon: <ScrollText className="h-[18px] w-[18px]" /> },
    { to: "/app/users", key: "users", icon: <UserCircle className="h-[18px] w-[18px]" /> },
    { to: "/app/settings", key: "settings", icon: <Settings className="h-[18px] w-[18px]" /> },
    { to: "/app/notifications", key: "notifications", icon: <Bell className="h-[18px] w-[18px]" /> },
  ],
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const nav = NAV[user!.role] ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <LogoMark />
        <div>
          <p className="font-display text-lg font-extrabold leading-none tracking-tight text-white">RAKSHA</p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-brand-300">Rural Health Net</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main navigation">
        {nav.map(item => (
          <NavLink
            key={item.to + item.key}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => cx(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-all",
              isActive ? "bg-white/12 text-white shadow-inner" : "text-brand-200 hover:bg-white/6 hover:text-white")
            }
          >
            <span className="text-brand-300 group-[.active]:text-emerald-300">{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user!.name} className="bg-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user!.name}</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-300">{ROLE_LABEL[user!.role]}</p>
          </div>
          <button onClick={() => { logout(); }} aria-label={t("logout")} title={t("logout")} className="rounded-lg p-2 text-brand-300 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-brand-400">SIH 2026 · Prototype build</p>
      </div>
    </div>
  );
}

function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data, loading } = useApi(() => api.listNotifications(user as never), [user?.id]);
  const { t } = useI18n();
  const nav = useNavigate();
  if (!open) return null;
  const kindTone = { info: "bg-sky-100 text-sky-700", warning: "bg-amber-100 text-amber-700", critical: "bg-rose-100 text-rose-700", success: "bg-emerald-100 text-emerald-700" };
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={t("notifications")}>
      <div className="absolute inset-0 bg-brand-950/40" onClick={onClose} />
      <aside className="anim-fade-in absolute right-0 top-0 h-full w-[min(94vw,400px)] overflow-y-auto border-l border-brand-900/10 bg-white shadow-pop">
        <header className="sticky top-0 flex items-center justify-between border-b border-brand-900/10 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold text-brand-950">{t("notifications")}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => { void api.markNotificationsRead(user as never); }} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
            <button onClick={onClose} aria-label={t("close")} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="space-y-2 p-4">
          {loading && <p className="py-10 text-center text-sm text-slate-400">{t("loading")}</p>}
          {!loading && (data ?? []).length === 0 && <p className="py-10 text-center text-sm text-slate-400">{t("noData")}</p>}
          {(data ?? []).map(n => (
            <button
              key={n.id}
              onClick={() => { void api.markNotificationsRead(user as never); if (n.link) { nav(n.link); } onClose(); }}
              className={cx("w-full rounded-xl border p-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/60", n.read ? "border-brand-900/8 bg-white" : "border-brand-200 bg-brand-50/70")}
            >
              <div className="flex items-start gap-3">
                <span className={cx("mt-0.5 rounded-lg p-1.5", kindTone[n.kind])}>
                  {n.kind === "critical" ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cx("truncate text-sm", n.read ? "font-medium text-slate-700" : "font-bold text-brand-950")}>{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-clay-500" />}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{relTime(n.ts)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { t, lang, setLang, langs } = useI18n();
  const { offline, syncing, simOffline, setSimOffline, counts, serverReachable, netOnline } = useConn();
  const [drawer, setDrawer] = useState(false);
  const [notif, setNotif] = useState(false);
  const loc = useLocation();
  const { data } = useApi(() => api.listNotifications(user as never), [user?.id]);
  const unread = (data ?? []).filter(n => !n.read).length;

  useEffect(() => { setDrawer(false); }, [loc.pathname]);
  if (!user) return null;

  // Status priority: offline > syncing > sync error > server unreachable > online
  const syncError = counts.failed > 0;
  const unreachable = netOnline && !serverReachable;
  const connTone = offline ? "bg-rose-50 text-rose-800 border-rose-200"
    : syncing ? "bg-amber-50 text-amber-800 border-amber-200"
    : syncError ? "bg-amber-50 text-amber-900 border-amber-300"
    : unreachable ? "bg-amber-50 text-amber-900 border-amber-300"
    : "bg-emerald-50 text-emerald-800 border-emerald-200";
  const connLabel = offline ? t("offline")
    : syncing ? t("syncing")
    : syncError ? `Sync error · ${counts.failed}`
    : unreachable ? "Server unreachable"
    : counts.pending > 0 ? `Online · ${counts.pending} queued`
    : t("online");

  return (
    <div className="flex min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[248px] bg-brand-950 lg:block">
        <SidebarContent />
      </aside>
      {drawer && (
        <div className="no-print fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-brand-950/50" onClick={() => setDrawer(false)} />
          <aside className="anim-fade-in absolute inset-y-0 left-0 w-[262px] bg-brand-950 shadow-pop">
            <button onClick={() => setDrawer(false)} aria-label={t("close")} className="absolute right-3 top-4 rounded-lg p-2 text-brand-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col lg:pl-[248px]">
        <header className="no-print sticky top-0 z-50 border-b border-brand-900/10 bg-paper/85 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-lg border border-brand-900/10 bg-white p-2 text-brand-800 shadow-sm lg:hidden"><Menu className="h-5 w-5" /></button>
              <div className="hidden sm:block">
                <p className="font-display text-[15px] font-bold tracking-tight text-brand-950">
                  {user.role === "DISTRICT_ADMIN" ? "District Command Center" : ROLE_LABEL[user.role].toUpperCase()}
                </p>
                <p className="text-[11px] text-slate-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSimOffline(!simOffline)}
                title={simOffline ? "Reconnect (demo control)" : "Simulate offline (demo control)"}
                className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition", connTone)}
              >
                {offline ? <CloudOff className="h-3.5 w-3.5" />
                  : syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : syncError || unreachable ? <AlertTriangle className="h-3.5 w-3.5" />
                  : <Wifi className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{connLabel}</span>
                {counts.pending > 0 && <span className="rounded-full bg-clay-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{counts.pending}</span>}
              </button>
              <div className="hidden items-center overflow-hidden rounded-full border border-brand-900/10 bg-white md:flex" role="group" aria-label={t("language")}>
                {langs.map(l => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={cx("px-2.5 py-1.5 text-[11px] font-bold transition", lang === l.code ? "bg-brand-800 text-white" : "text-slate-500 hover:text-brand-800")}>
                    {l.code.toUpperCase()}
                  </button>
                ))}
              </div>
              <button onClick={() => setNotif(true)} aria-label={t("notifications")} className="relative rounded-lg border border-brand-900/10 bg-white p-2 text-brand-800 shadow-sm transition hover:border-brand-300">
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-clay-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
            </div>
          </div>
          {offline && (
            <div className="flex items-center gap-2 border-t border-amber-300/60 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900 sm:px-6">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t("offlineBanner")}</span>
              <Pill tone="amber">{counts.pending} {t("pending")}</Pill>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="no-print border-t border-brand-900/10 px-6 py-4 text-center text-[11px] text-slate-400">
          RAKSHA · Responsive AI-enabled Knowledge & Smart Healthcare Assistance · {t("tagline")}
        </footer>
      </div>

      <NotificationsDrawer open={notif} onClose={() => setNotif(false)} />
    </div>
  );
}
