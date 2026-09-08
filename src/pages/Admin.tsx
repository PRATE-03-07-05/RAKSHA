/** District Admin — command center, facilities, bottlenecks, audit, settings. */
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Signpost, HeartPulse, Siren, CheckCircle2, ClipboardList, Building2,
  AlertTriangle, Timer, ArrowRight, Search, RotateCcw, Server, ShieldCheck,
  BedDouble, Wind, FlaskConical, Pill as PillIcon, Stethoscope, MapPin,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { api, resetDB, facilityName } from "../store/backend";
import { useAuth, useApi, useI18n, useToast } from "../store/providers";
import { Card, StatCard, Pill, Btn, Spinner, EmptyState, SectionHead, AvailBadge, Input, Select, KV, RefStatusBadge, Banner } from "../components/ui";
import { isOverdue } from "../store/backend";
import { fmtDT, relTime, cx } from "../lib/utils";
import type { Referral, User, Role } from "../lib/types";
import { Avatar, Modal, Field } from "../components/ui";

const CHART_TOOLTIP = { contentStyle: { borderRadius: 10, border: "1px solid #d8eae3", fontSize: 12, fontFamily: "IBM Plex Sans" }, labelStyle: { fontWeight: 700 } };

/* -------------------------------------------------------------- dashboard */

export function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const aQ = useApi(() => api.adminAnalytics(user as never), [user?.id]);
  if (aQ.loading) return <Spinner label={t("loading")} />;
  if (aQ.error) return <EmptyState title="Analytics unavailable" hint={aQ.error} />;
  const a = aQ.data!;
  const T = a.totals;

  const pieColors: Record<string, string> = { CREATED: "#94a3b8", SENT: "#38bdf8", ACKNOWLEDGED: "#0ea5e9", ACCEPTED: "#2c7a65", ARRIVED: "#1b6352", IN_CONSULTATION: "#f59e0b", TREATMENT: "#e08a1e", COMPLETED: "#10b981", CANCELLED: "#f43f5e" };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">District Command Center · {user!.district ?? "District"}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">Where does care get stuck?</h1>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="amber">{t("demoData")}</Pill>
          <Link to="/app/bottlenecks"><Btn size="sm" variant="dark">Bottleneck view <ArrowRight className="h-3.5 w-3.5" /></Btn></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("totalPatients")} value={T.patients} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active referrals" value={T.activeReferrals} sub={`${T.pending} awaiting action`} icon={<Signpost className="h-4 w-4" />} tone="sky" />
        <StatCard label={t("overdue")} value={T.overdue} sub="Referrals past expected date" icon={<Timer className="h-4 w-4" />} tone={T.overdue > 0 ? "red" : "brand"} />
        <StatCard label={t("highRisk")} value={T.highRisk} sub={`${T.critical} critical`} icon={<HeartPulse className="h-4 w-4" />} tone={T.highRisk > 0 ? "amber" : "brand"} />
        <StatCard label={t("missedFollowups")} value={T.missedFollowups} icon={<ClipboardList className="h-4 w-4" />} tone={T.missedFollowups > 0 ? "red" : "brand"} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("completed")} value={T.completed} sub="Referral loops closed" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Completion rate" value={`${T.completionRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} tone="brand" />
        <StatCard label="Avg. loop time" value={`${T.avgHours}h`} sub="Referral → completed" icon={<Timer className="h-4 w-4" />} tone="sky" />
        <StatCard label="Resource shortages" value={T.shortages} sub={`${T.facilities} facilities monitored`} icon={<AlertTriangle className="h-4 w-4" />} tone={T.shortages > 4 ? "amber" : "brand"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Patient & visit volume — last 8 weeks">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={a.weeks}>
                <defs>
                  <linearGradient id="gv" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="220">
                    <stop offset="0%" stopColor="#2c7a65" stopOpacity={0.35} /><stop offset="100%" stopColor="#2c7a65" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="220">
                    <stop offset="0%" stopColor="#e08a1e" stopOpacity={0.3} /><stop offset="100%" stopColor="#e08a1e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8eae3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="visits" name="Visits" stroke="#1b6352" strokeWidth={2.5} fill="url(#gv)" />
                <Area type="monotone" dataKey="patients" name="New patients" stroke="#e08a1e" strokeWidth={2} fill="url(#gp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Referral status distribution">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={a.statusDist} dataKey="count" nameKey="status" innerRadius={48} outerRadius={80} paddingAngle={3} stroke="#fff">
                  {a.statusDist.map(s => <Cell key={s.status} fill={pieColors[s.status] ?? "#94a3b8"} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Facility workload — referrals">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={a.workload} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8eae3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="open" name="Open" fill="#e08a1e" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="completed" name="Completed" fill="#2c7a65" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="High-risk flags by facility">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={a.riskByFacility}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8eae3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="high" name="HIGH" fill="#e08a1e" radius={[4, 4, 0, 0]} barSize={22} />
                <Bar dataKey="critical" name="CRITICAL" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Medicine & diagnostic shortages" action={<Link to="/app/facilities" className="text-xs font-bold text-brand-700">Facility details</Link>} pad={false}>
        <div className="grid gap-x-8 sm:grid-cols-2">
          {a.shortages.slice(0, 8).map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-dashed border-brand-900/10 px-5 py-2.5">
              <p className="text-sm"><b className="text-brand-950">{s.item}</b> <span className="text-xs text-slate-400">· {s.type} · {s.facility}</span></p>
              <AvailBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- facilities */

export function FacilitiesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const fQ = useApi(() => api.listFacilities(user as never), [user?.id]);
  const [sel, setSel] = useState<string | null>(null);
  
  if (fQ.loading) return <Spinner label={t("loading")} />;
  if (fQ.error) return <EmptyState title="Failed to load facilities" hint={fQ.error} />;
  
  const list = fQ.data ?? [];
  const selected = list.find(f => f.id === sel) ?? null;
  
  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <SectionHead kicker="Resource visibility" title={t("facilities")} right={<Pill tone="amber">{t("demoData")}</Pill>} />
        <EmptyState title="No facilities found" hint="No facilities are currently registered in the system." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SectionHead kicker="Resource visibility" title={t("facilities")} right={<Pill tone="amber">{t("demoData")} · live in production via HMIS</Pill>} />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card title="District map — schematic" pad={false}>
          <div className="relative h-[340px] overflow-hidden rounded-b-xl bg-brand-900">
            <svg className="absolute inset-0 h-full w-full opacity-25" aria-hidden="true">
              <defs><pattern id="gridp" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0v26" fill="none" stroke="#4e9783" strokeWidth="0.6" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#gridp)" />
              <path d="M16 30 Q 30 50 38 58 T 62 38 T 84 24" fill="none" stroke="#4ade80" strokeWidth="1.6" className="dash-flow" />
              <path d="M28 80 Q 45 70 56 76 T 84 24" fill="none" stroke="#4ade80" strokeWidth="1.2" className="dash-flow" />
            </svg>
            {list.map(f => (
              <button key={f.id} onClick={() => setSel(f.id)} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${f.mapX}%`, top: `${f.mapY}%` }} aria-label={f.name}>
                <span className={cx("flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-pop transition group-hover:scale-110", sel === f.id ? "border-emerald-300 bg-emerald-500 text-white" : f.type === "DH" ? "border-emerald-400/60 bg-brand-700 text-emerald-200" : "border-brand-400/50 bg-brand-800 text-brand-200")}>
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-brand-950/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-200">{f.type}</span>
              </button>
            ))}
            <span className="absolute bottom-2 left-3 font-mono text-[9px] font-bold uppercase tracking-widest text-brand-400">Demo coordinates — not to scale</span>
          </div>
        </Card>

        <div className="grid content-start gap-3 sm:grid-cols-2">
          {list.map(f => (
            <button key={f.id} onClick={() => setSel(f.id)} className={cx("rounded-xl border p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-pop", sel === f.id ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-brand-900/10 bg-white")}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-bold text-brand-950">{f.name}</p>
                <Pill tone={f.workload === "HIGH" ? "red" : f.workload === "MODERATE" ? "amber" : "green"}>{f.workload}</Pill>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-brand-500">{f.type} · {f.village} · {f.distanceKm} km</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className={cx("rounded px-1.5 py-0.5", f.availableBeds > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}><BedDouble className="mr-1 inline h-3 w-3" />{f.availableBeds}/{f.totalBeds} beds</span>
                {f.icuBeds > 0 && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">ICU {f.icuAvailable}/{f.icuBeds}</span>}
                <span className={cx("rounded px-1.5 py-0.5", f.emergency ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500")}>ER {f.emergency ? "✓" : "—"}</span>
                <span className={cx("rounded px-1.5 py-0.5", f.oxygen === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" : f.oxygen === "LIMITED" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700")}><Wind className="mr-1 inline h-3 w-3" />O₂</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <Card title={`${selected.name} — resources`} pad={false}>
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border-b border-brand-900/8 p-5 lg:border-b-0 lg:border-r">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><FlaskConical className="h-3.5 w-3.5" /> Diagnostics</p>
              {selected.diagnostics.map(d => <div key={d.name} className="flex items-center justify-between py-1 text-sm"><span className="text-brand-950">{d.name}</span><AvailBadge status={d.status} /></div>)}
            </div>
            <div className="border-b border-brand-900/8 p-5 lg:border-b-0 lg:border-r">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><PillIcon className="h-3.5 w-3.5" /> Medicines</p>
              {selected.medicines.map(d => <div key={d.name} className="flex items-center justify-between py-1 text-sm"><span className="text-brand-950">{d.name}</span><AvailBadge status={d.status} /></div>)}
            </div>
            <div className="border-b border-brand-900/8 p-5 sm:border-b-0 lg:border-r">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><Stethoscope className="h-3.5 w-3.5" /> Specialists</p>
              {selected.specialists.length === 0 && <p className="text-sm text-slate-400">None posted — refer onward.</p>}
              {selected.specialists.map(s => (
                <div key={s.specialty} className="flex items-center justify-between py-1 text-sm">
                  <span><b className="text-brand-950">{s.specialty}</b><span className="block text-[11px] text-slate-400">{s.name}</span></span>
                  <Pill tone={s.available ? "green" : "red"}>{s.available ? t("available") : t("unavailable")}</Pill>
                </div>
              ))}
            </div>
            <div className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><MapPin className="h-3.5 w-3.5" /> Capacity</p>
              <KV k="Total beds" v={selected.totalBeds} />
              <KV k="Available beds" v={selected.availableBeds} />
              <KV k="ICU beds" v={`${selected.icuAvailable} / ${selected.icuBeds}`} />
              <KV k="Emergency" v={selected.emergency ? "Yes" : "No"} />
              <KV k="Oxygen" v={selected.oxygen} />
              <KV k="Critical care" v={selected.criticalCare} />
              <KV k="Phone" v={selected.phone} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- bottlenecks */

export function BottleneckPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const aQ = useApi(() => api.adminAnalytics(user as never), [user?.id]);
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  
  if (aQ.loading || refQ.loading) return <Spinner label={t("loading")} />;
  if (aQ.error || refQ.error) {
    return <EmptyState title="Failed to load bottleneck data" hint={aQ.error || refQ.error || "Unknown error"} />;
  }
  
  const b = aQ.data?.bottlenecks ?? [];
  const phcs = b.filter(x => x.facility.type === "PHC");
  const chcs = b.filter(x => x.facility.type === "CHC");
  const dh = aQ.data!.totals;
  const all = refQ.data ?? [];
  const dhIn = all.filter(r => r.toFacilityId === "F-DH-01" && !["COMPLETED", "CANCELLED"].includes(r.status)).length;
  const dhDone = all.filter(r => r.toFacilityId === "F-DH-01" && r.status === "COMPLETED").length;

  const Col = ({ title, items }: { title: string; items: { name: string; created: number; completed: number; pending: number; overdue: number }[] }) => (
    <div className="space-y-3">
      <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-brand-500">{title}</p>
      {items.map(x => (
        <div key={x.name} className={cx("rounded-xl border bg-white p-4 shadow-card", x.overdue > 0 ? "border-rose-300" : "border-brand-900/10")}>
          <p className="font-display text-sm font-bold text-brand-950">{x.name}</p>
          <p className="font-mono text-[11px] text-brand-500">{x.created} referrals</p>
          <div className="mt-2 space-y-1 text-xs">
            <p className="flex justify-between"><span className="text-slate-500">Completed</span><b className="text-emerald-700">{x.completed}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">Pending</span><b className="text-amber-700">{x.pending}</b></p>
            <p className="flex justify-between"><span className="text-slate-500">Overdue</span><b className={x.overdue > 0 ? "text-rose-700" : "text-slate-400"}>{x.overdue}</b></p>
          </div>
          {x.overdue > 0 && <p className="mt-2 rounded bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">⚠ Stuck here — investigate</p>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionHead kicker="Referral flow" title="Where are referrals getting stuck?" right={<Pill tone="amber">{t("demoData")}</Pill>} />
      <div className="grid items-start gap-4 sm:grid-cols-[1fr_40px_1fr_40px_1fr]">
        <Col title="PHCs — origin" items={phcs.map(x => ({ name: x.facility.name, created: x.created, completed: x.completed, pending: x.pending, overdue: x.overdue }))} />
        <div className="hidden justify-center pt-16 sm:flex"><svg width="24" height="60"><line x1="12" y1="0" x2="12" y2="60" className="dash-flow" stroke="#2c7a65" strokeWidth="3" strokeLinecap="round" /></svg></div>
        <Col title="CHCs — receiving" items={chcs.map(x => ({ name: x.facility.name, created: x.created, completed: x.completed, pending: x.inFlow, overdue: x.overdue }))} />
        <div className="hidden justify-center pt-16 sm:flex"><svg width="24" height="60"><line x1="12" y1="0" x2="12" y2="60" className="dash-flow" stroke="#2c7a65" strokeWidth="3" strokeLinecap="round" /></svg></div>
        <div className="space-y-3">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.16em] text-brand-500">District Hospital</p>
          <div className="rounded-xl border border-brand-900/10 bg-brand-950 p-4 text-white shadow-pop">
            <p className="font-display text-sm font-bold">{facilityName("F-DH-01")}</p>
            <p className="font-mono text-[11px] text-emerald-300">{dh.facilities} facilities feed here</p>
            <div className="mt-2 space-y-1 text-xs">
              <p className="flex justify-between"><span className="text-brand-300">Open referrals</span><b>{dhIn}</b></p>
              <p className="flex justify-between"><span className="text-brand-300">Completed</span><b className="text-emerald-300">{dhDone}</b></p>
              <p className="flex justify-between"><span className="text-brand-300">District completion</span><b className="text-emerald-300">{dh.completionRate}%</b></p>
            </div>
          </div>
        </div>
      </div>
      <Banner tone="info">Reading the map: any column where <b>pending/overdue</b> grows while <b>completed</b> stalls is a bottleneck. RAKSHA raises automatic follow-up alerts for unacknowledged and not-arrived referrals so nothing waits silently.</Banner>
    </div>
  );
}

/* ------------------------------------------------------------------- audit */

export function AuditPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const aQ = useApi(() => api.listAudit(user as never), [user?.id]);
  const [resource, setResource] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => (aQ.data ?? []).filter(r => (resource === "all" || r.resource === resource) && (!q || r.actorName.toLowerCase().includes(q.toLowerCase()) || r.action.toLowerCase().includes(q.toLowerCase()) || (r.details ?? "").toLowerCase().includes(q.toLowerCase()))), [aQ.data, resource, q]);
  if (aQ.loading) return <Spinner label={t("loading")} />;
  const resources = [...new Set((aQ.data ?? []).map(r => r.resource))];
  const tone: Record<string, string> = { emergency: "bg-rose-100 text-rose-700", referral: "bg-brand-100 text-brand-700", auth: "bg-sky-100 text-sky-700", patient: "bg-emerald-100 text-emerald-700", sync: "bg-amber-100 text-amber-700" };
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionHead kicker="Accountability" title={t("auditLogs")} right={<Pill tone="brand">{(aQ.data ?? []).length} events</Pill>} />
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="Filter by actor, action, details…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select className="w-44" value={resource} onChange={e => setResource(e.target.value)}>
          <option value="all">All resources</option>
          {resources.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <div className="p-6"><EmptyState title={t("noData")} /></div> : (
          <div className="divide-y divide-brand-900/8">
            {rows.slice(0, 40).map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="font-mono w-28 shrink-0 text-[11px] font-bold text-brand-600">{fmtDT(r.ts)}</span>
                <span className={cx("w-24 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-extrabold uppercase", tone[r.resource] ?? "bg-slate-100 text-slate-600")}>{r.resource}</span>
                <span className="w-40 shrink-0 text-xs font-bold text-brand-950">{r.actorName} <span className="font-normal text-slate-400">({r.role.replace("_", " ")})</span></span>
                <span className="font-mono text-[11px] font-semibold text-brand-800">{r.action}</span>
                {r.purpose && <span className="text-[11px] text-slate-500">purpose: {r.purpose}</span>}
                {r.details && <span className="min-w-0 flex-1 truncate text-right text-[11px] text-slate-400">{r.details}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-center text-[11px] text-slate-400">Every login, record access, referral transition, prescription, consent change and sync batch is written here immutably.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- settings */

export function SettingsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [health, setHealth] = useState<Record<string, string> | null>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionHead kicker="System" title={t("settings")} />
      <Card title="Service health — GET /health">
        {health ? (
          <div className="grid gap-x-6 sm:grid-cols-2">
            {Object.entries(health).map(([k, v]) => <KV key={k} k={k} v={String(v)} mono />)}
          </div>
        ) : <Btn variant="secondary" size="sm" onClick={() => void api.health().then(h => setHealth(h as never))}><Server className="h-4 w-4" /> Run health check</Btn>}
      </Card>
      <Card title="Demo data">
        <p className="text-sm text-slate-600">Restore the seeded district (patients, referrals, analytics). Useful between demonstration rounds.</p>
        {confirming ? (
          <div className="mt-3 flex gap-2">
            <Btn variant="danger" onClick={() => { resetDB(); toast("Demo data reset to seed state.", "success"); setConfirming(false); }}><RotateCcw className="h-4 w-4" /> Yes, reset everything</Btn>
            <Btn variant="secondary" onClick={() => setConfirming(false)}>{t("cancel")}</Btn>
          </div>
        ) : <Btn variant="warning" className="mt-3" onClick={() => setConfirming(true)}><RotateCcw className="h-4 w-4" /> Reset demo data</Btn>}
      </Card>
      <Card title="Security posture (production design)">
        <KV k="Secrets" v="JWT signing key, DB password via .env — never committed (.env.example provided)" />
        <KV k="Passwords" v="Hashed (bcrypt) in FastAPI auth service" />
        <KV k="Authorization" v="RBAC enforced per-endpoint, not by hiding UI" />
        <KV k="Queries" v="SQLAlchemy ORM — parameterized, no string SQL" />
        <KV k="Consent" v="Record access gated + audited with purpose" />
        <KV k="Interop" v="ABDM/ABHA, FHIR R4, eSanjeevani, HMIS — isolated adapters, mocked until credentialed" />
      </Card>
      <Banner tone="info"><ShieldCheck className="mr-1 inline h-4 w-4" /> RAKSHA supports the public health system — ASHA, ANM, PHC, CHC and district roles keep their real workflows, now connected.</Banner>
    </div>
  );
}

/* ------------------------------------------------- admin referral overview */

export function AdminReferralsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  if (refQ.loading) return <Spinner label={t("loading")} />;
  const list = (refQ.data ?? []) as Referral[];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SectionHead kicker="District-wide" title={t("referrals")} right={<Pill tone="brand">{list.length} total</Pill>} />
      {list.map(r => {
        const overdue = isOverdue(r);
        return (
          <Link key={r.id} to={`/app/referrals/${r.id}`} className="block rounded-xl border border-brand-900/10 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-pop">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-brand-600">{r.code} · {relTime(r.ts)}</p>
                <p className="font-display text-[15px] font-bold text-brand-950">{facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)}</p>
                <p className="text-xs text-slate-500">{r.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={r.priority === "EMERGENCY" || r.priority === "URGENT" ? "red" : r.priority === "PRIORITY" ? "amber" : "slate"}>{r.priority}</Pill>
                <RefStatusBadge status={r.status} overdue={overdue} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- user management */

export function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const usersQ = useApi(() => api.adminListUsers(user as never), [user?.id]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  if (usersQ.loading) return <Spinner label="Loading users…" />;
  if (usersQ.error) return <EmptyState title="Failed to load users" hint={usersQ.error} />;

  const users = usersQ.data ?? [];
  const filtered = search
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase()) ||
                        u.role.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">User Management</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">System Users</h1>
        </div>
        <Btn onClick={() => setShowCreate(true)}><Users className="h-4 w-4" /> Create User</Btn>
      </div>

      <Card>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search by name, email, or role…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No users found" hint={search ? "Try a different search term" : "Create your first user"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-900/10 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Facility</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-900/5">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-brand-50/40">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} className="h-8 w-8 text-xs" />
                        <div>
                          <p className="font-semibold text-brand-950">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.specialty ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Pill tone={u.role === "DISTRICT_ADMIN" ? "amber" : u.role.includes("DOCTOR") ? "brand" : "slate"}>
                        {u.role.replace("_", " ")}
                      </Pill>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{facilityName(u.facilityId)}</td>
                    <td className="py-3 pr-4">
                      {(u as unknown as { isActive?: boolean }).isActive === false
                        ? <Pill tone="red">Inactive</Pill>
                        : <Pill tone="green">Active</Pill>}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" onClick={() => setEditing(u)}>Edit</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); usersQ.reload(); }} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onUpdated={() => { setEditing(null); usersQ.reload(); }} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const facQ = useApi(() => api.listFacilities(user as never), []);
  const [form, setForm] = useState({
    email: "", name: "", password: "", role: "ASHA", facility_id: "", phone: "", specialty: "", district: "", village: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.email || !form.name || !form.password) {
      toast("Email, name, and password are required", "error");
      return;
    }
    if (!["PATIENT", "DISTRICT_ADMIN"].includes(form.role) && !form.facility_id) {
      toast("Facility is required for facility-based roles.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        email: form.email, name: form.name, password: form.password, role: form.role,
        phone: form.phone, specialty: form.specialty, district: form.district, village: form.village,
      };
      if (form.facility_id) payload.facility_id = form.facility_id;
      await api.adminCreateUser(user as never, payload as never);
      toast("User created successfully", "success");
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create user", "error");
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="Create New User" wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name" required>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Password" required>
          <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="Role" required>
          <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="PATIENT">Patient</option>
            <option value="ASHA">ASHA</option>
            <option value="ANM">ANM</option>
            <option value="PHC_STAFF">PHC Staff</option>
            <option value="PHC_DOCTOR">PHC Doctor</option>
            <option value="CHC_DOCTOR">CHC Doctor</option>
            <option value="SPECIALIST">Specialist</option>
            <option value="DISTRICT_ADMIN">District Admin</option>
          </Select>
        </Field>
        <Field label="Facility" required={form.role !== "PATIENT" && form.role !== "DISTRICT_ADMIN"}>
          {facQ.loading ? (
            <p className="text-sm text-slate-500">Loading facilities…</p>
          ) : facQ.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Failed to load facilities
            </div>
          ) : (
            <Select value={form.facility_id} onChange={e => setForm(f => ({ ...f, facility_id: e.target.value }))}>
              <option value="">Select a facility</option>
              {(facQ.data ?? []).map(f => (
                <option key={f.id} value={f.id}>{f.name} · {f.type} · {f.village}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Specialty">
          <Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
        </Field>
        <Field label="District">
          <Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} />
        </Field>
        <Field label="Village">
          <Input value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn loading={saving} onClick={() => void submit()}>Create User</Btn>
      </div>
    </Modal>
  );
}

function EditUserModal({ user: u, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: () => void }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const facQ = useApi(() => api.listFacilities(currentUser as never), []);
  const [form, setForm] = useState({
    name: u.name, role: u.role, facility_id: u.facilityId ?? "", phone: u.phone ?? "",
    specialty: u.specialty ?? "", district: u.district ?? "", village: u.village ?? "",
    is_active: (u as unknown as { isActive?: boolean }).isActive ?? true,
  });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.facility_id) delete payload.facility_id;
      await api.adminUpdateUser(currentUser as never, u.id, payload as never);
      if (newPassword) {
        await api.adminResetPassword(currentUser as never, u.id, newPassword);
      }
      toast("User updated successfully", "success");
      onUpdated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update user", "error");
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={`Edit User — ${u.name}`} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input type="email" value={u.email} disabled />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
            <option value="PATIENT">Patient</option>
            <option value="ASHA">ASHA</option>
            <option value="ANM">ANM</option>
            <option value="PHC_STAFF">PHC Staff</option>
            <option value="PHC_DOCTOR">PHC Doctor</option>
            <option value="CHC_DOCTOR">CHC Doctor</option>
            <option value="SPECIALIST">Specialist</option>
            <option value="DISTRICT_ADMIN">District Admin</option>
          </Select>
        </Field>
        <Field label="Facility">
          {facQ.loading ? (
            <p className="text-sm text-slate-500">Loading facilities…</p>
          ) : facQ.error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Failed to load facilities
            </div>
          ) : (
            <Select value={form.facility_id} onChange={e => setForm(f => ({ ...f, facility_id: e.target.value }))}>
              <option value="">No facility</option>
              {(facQ.data ?? []).map(f => (
                <option key={f.id} value={f.id}>{f.name} · {f.type} · {f.village}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Account status">
          <Select value={form.is_active ? "active" : "inactive"} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === "active" }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Specialty">
          <Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
        </Field>
        <Field label="District">
          <Input value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} />
        </Field>
        <Field label="Village">
          <Input value={form.village} onChange={e => setForm(f => ({ ...f, village: e.target.value }))} />
        </Field>
        <Field label="Reset Password (optional)">
          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn loading={saving} onClick={() => void submit()}>Save Changes</Btn>
      </div>
    </Modal>
  );
}
