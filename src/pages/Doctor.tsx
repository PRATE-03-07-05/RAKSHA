/** Clinical workspace — PHC doctor, CHC doctor, specialist. */
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Stethoscope, ListOrdered, HeartPulse, Siren, ArrowRight, Users, ChevronRight,
  CheckCircle2, Clock3, AlertTriangle, FileText, PlusCircle, Trash2, Send,
  ShieldAlert, Video, KeyRound, Activity, CalendarClock,
} from "lucide-react";
import { api, getDB, facilityName, nextStatuses, isOverdue, followUpState, REF_FLOW } from "../store/backend";
import { useAuth, useApi, useI18n, useToast } from "../store/providers";
import { Card, StatCard, Pill, RiskBadge, RefStatusBadge, Btn, Spinner, EmptyState, Field, Input, Select, Textarea, Modal, Banner, KV, Avatar, SectionHead, Progress } from "../components/ui";
import { PatientRecordPage } from "./RecordPages";
import { ReferralPanel } from "./FieldWorker";
import type { Assessment, Referral, RefStatus, Patient } from "../lib/types";
import { fmtD, fmtDT, fmtTime, relTime, todayISO, cx } from "../lib/utils";

const isClinical = (role?: string) => role === "PHC_DOCTOR" || role === "CHC_DOCTOR" || role === "SPECIALIST";

/* -------------------------------------------------------------- dashboard */

export function DoctorDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  const apQ = useApi(() => api.listAppointments(user as never), [user?.id]);
  const emgQ = useApi(() => api.listEmergencies(user as never), [user?.id]);
  const [q, setQ] = useState("");
  const searchQ = useApi(() => (q.length >= 2 ? api.searchPatients(user as never, q) : Promise.resolve([])), [q]);

  const derived = useMemo(() => {
    const db = getDB();
    const today = todayISO();
    const incoming = (refQ.data ?? []).filter(r => r.toFacilityId === user?.facilityId && !["COMPLETED", "CANCELLED"].includes(r.status));
    const waiting = incoming.filter(r => ["SENT", "ACKNOWLEDGED", "ACCEPTED"].includes(r.status));
    const inDept = incoming.filter(r => ["ARRIVED", "IN_CONSULTATION", "TREATMENT"].includes(r.status));
    const queue = (apQ.data ?? []).filter(a => a.date === today && a.status !== "COMPLETED" && a.status !== "CANCELLED");
    const latestByPatient = new Map<string, Assessment>();
    db.assessments.forEach(a => { if (!latestByPatient.has(a.patientId)) latestByPatient.set(a.patientId, a); });
    const highRisk = [...latestByPatient.values()].filter(a => a.level === "HIGH" || a.level === "CRITICAL").slice(0, 5);
    const activeEmg = (emgQ.data ?? []).filter(e => e.status === "ACTIVE");
    return { incoming, waiting, inDept, queue, highRisk, activeEmg };
  }, [refQ.data, apQ.data, emgQ.data, user?.facilityId]);

  if (refQ.loading) return <Spinner label={t("loading")} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">{facilityName(user!.facilityId)} · {t("welcome")}</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">{user!.name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In queue today" value={derived.queue.length + derived.inDept.length} sub={`${derived.inDept.length} referred patients in department`} icon={<ListOrdered className="h-4 w-4" />} onClick={() => nav("/app/queue")} />
        <StatCard label="Awaiting action" value={derived.waiting.length} sub="Incoming referrals to acknowledge/accept" icon={<Send className="h-4 w-4" />} tone={derived.waiting.length > 0 ? "amber" : "brand"} onClick={() => nav("/app/referrals")} />
        <StatCard label={t("highRisk")} value={derived.highRisk.length} sub="Latest AI-assisted flags" icon={<HeartPulse className="h-4 w-4" />} tone={derived.highRisk.length > 0 ? "red" : "brand"} onClick={() => nav("/app/patients")} />
        <StatCard label="Active emergencies" value={derived.activeEmg.length} sub={derived.activeEmg.length ? "Immediate attention" : "None active"} icon={<Siren className="h-4 w-4" />} tone={derived.activeEmg.length > 0 ? "red" : "slate"} onClick={() => nav("/app/emergency")} />
      </div>

      <Card title="Find a patient — full longitudinal record">
        <div className="relative">
          <Users className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-10" placeholder="RAKSHA ID, name or phone…" value={q} onChange={e => setQ(e.target.value)} aria-label={t("searchPatient")} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(searchQ.data ?? []).slice(0, 4).map(p => (
            <Link key={p.id} to={`/app/patients/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3 transition hover:border-brand-400 hover:bg-brand-50/60">
              <span className="flex items-center gap-3"><Avatar name={p.name} /><span><b className="text-sm text-brand-950">{p.name}</b><span className="block font-mono text-[11px] text-brand-500">{p.rakId} · {p.age}y · {p.village}</span></span></span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`${t("highRisk")} — latest AI flags`} action={<StatusLegend />}>
          {derived.highRisk.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No HIGH or CRITICAL flags.</p>}
          <div className="space-y-2">
            {derived.highRisk.map(a => {
              const p = getDB().patients.find(x => x.id === a.patientId);
              return (
                <Link key={a.id} to={`/app/patients/${a.patientId}`} className={cx("flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:shadow-card", a.level === "CRITICAL" ? "border-rose-300 bg-rose-50/60" : "border-orange-200 bg-orange-50/50")}>
                  <div className="flex items-center gap-3">
                    <Avatar name={p?.name ?? "?"} className={a.level === "CRITICAL" ? "bg-rose-700" : "bg-clay-600"} />
                    <div>
                      <p className="text-sm font-bold text-brand-950">{p?.name} <span className="font-mono text-[10px] text-slate-400">{p?.rakId}</span></p>
                      <p className="text-[11px] text-slate-500">{a.factors[0]?.label} · {relTime(a.ts)} · {a.confirmed ? "confirmed" : "unconfirmed"}</p>
                    </div>
                  </div>
                  <RiskBadge level={a.level} />
                </Link>
              );
            })}
          </div>
        </Card>
        <Card title="Incoming referrals" action={<Link to="/app/referrals" className="text-xs font-bold text-brand-700">All</Link>}>
          {derived.incoming.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No incoming referrals.</p>}
          <div className="space-y-2">
            {derived.incoming.slice(0, 5).map(r => {
              const p = getDB().patients.find(x => x.id === r.patientId);
              return (
                <Link key={r.id} to={`/app/referrals/${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3 transition hover:border-brand-300 hover:bg-brand-50/50">
                  <div>
                    <p className="text-sm font-bold text-brand-950">{p?.name} <span className="font-mono text-[10px] text-brand-500">{r.code}</span></p>
                    <p className="text-[11px] text-slate-500">from {facilityName(r.fromFacilityId)} · {r.priority} · {relTime(r.ts)}</p>
                  </div>
                  <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusLegend() {
  return <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">AI assists · you decide</span>;
}

/* ------------------------------------------------------------------ queue */

export function QueuePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const apQ = useApi(() => api.listAppointments(user as never), [user?.id]);
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  const today = todayISO();
  
  if (apQ.loading || refQ.loading) return <Spinner label={t("loading")} />;
  if (apQ.error || refQ.error) {
    return <EmptyState title="Failed to load patient queue" hint={apQ.error || refQ.error || "Unknown error"} />;
  }

  const rows = useMemo(() => {
    const db = getDB();
    const items: { id: string; patient: Patient; source: string; priority: string; since: number; kind: "appointment" | "referral"; refId?: string }[] = [];
    (apQ.data ?? []).filter(a => a.date === today && a.status !== "COMPLETED" && a.status !== "CANCELLED").forEach(a => {
      const p = db.patients.find(x => x.id === a.patientId);
      if (p) items.push({ id: a.id, patient: p, source: `OPD · ${a.purpose}`, priority: a.status === "IN_QUEUE" ? `Queue #${a.queuePos}` : a.status, since: new Date(`${a.date}T${a.time}:00`).getTime(), kind: "appointment" });
    });
    (refQ.data ?? []).filter(r => r.toFacilityId === user?.facilityId && ["ARRIVED", "IN_CONSULTATION", "TREATMENT"].includes(r.status)).forEach(r => {
      const p = db.patients.find(x => x.id === r.patientId);
      if (p && !items.some(i => i.patient.id === p.id)) items.push({ id: r.id, patient: p, source: `Referral · ${facilityName(r.fromFacilityId)}`, priority: r.priority, since: r.ts, kind: "referral", refId: r.id });
    });
    return items.sort((a, b) => a.since - b.since);
  }, [apQ.data, refQ.data, user?.facilityId, today]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionHead kicker="Today" title={t("patientQueue")} right={<Pill tone="brand">{rows.length} waiting</Pill>} />
      {rows.length === 0 && <EmptyState icon={<ListOrdered className="h-8 w-8" />} title="Queue is clear" hint="Appointments and arrived referrals for today appear here." />}
      <div className="space-y-2">
        {rows.map((row, i) => {
          const wait = Math.max(0, Math.round((Date.now() - row.since) / 60000));
          return (
            <Card key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-display w-8 text-center text-xl font-extrabold text-brand-300">{i + 1}</span>
                  <Avatar name={row.patient.name} />
                  <div>
                    <p className="text-sm font-bold text-brand-950">{row.patient.name} <span className="font-mono text-[10px] text-brand-500">{row.patient.rakId}</span></p>
                    <p className="text-[11px] text-slate-500">{row.source} · {row.patient.age}y · {row.patient.conditions.join(", ") || "no known conditions"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={row.priority === "EMERGENCY" || row.priority === "URGENT" ? "red" : row.priority === "PRIORITY" ? "amber" : "slate"}>{row.priority}</Pill>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-400"><Clock3 className="h-3.5 w-3.5" /> {wait}m</span>
                  <Link to={`/app/patients/${row.patient.id}`}><Btn size="sm" variant="secondary">{t("viewRecord")} <ArrowRight className="h-3.5 w-3.5" /></Btn></Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- referrals */

export function DoctorReferralsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");

  const advance = async (r: Referral, to: RefStatus) => {
    setBusy(r.id + to);
    try {
      await api.advanceReferral(user as never, r.id, to);
      toast(`${r.code}: ${r.status} → ${to}`, "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setBusy(null);
  };

  if (refQ.loading) return <Spinner label={t("loading")} />;
  const incoming = (refQ.data ?? []).filter(r => r.toFacilityId === user?.facilityId);
  const outgoing = (refQ.data ?? []).filter(r => r.fromFacilityId === user?.facilityId);
  const list = tab === "incoming" ? incoming : outgoing;

  const ACTION_LABEL: Partial<Record<RefStatus, { key: Parameters<typeof t>[0]; to: RefStatus; variant?: "primary" | "warning" }>> = {
    SENT: { key: "acknowledge", to: "ACKNOWLEDGED" },
    ACKNOWLEDGED: { key: "accept", to: "ACCEPTED" },
    ACCEPTED: { key: "markArrived", to: "ARRIVED", variant: "warning" },
    ARRIVED: { key: "stInConsultation", to: "IN_CONSULTATION" },
    IN_CONSULTATION: { key: "startTreatment", to: "TREATMENT" },
    TREATMENT: { key: "completeReferral", to: "COMPLETED" },
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SectionHead kicker="Closed loop" title={t("referrals")} right={
        <div className="flex overflow-hidden rounded-lg border border-brand-900/15 bg-white">
          {(["incoming", "outgoing"] as const).map(x => (
            <button key={x} onClick={() => setTab(x)} className={cx("px-4 py-2 text-xs font-bold capitalize transition", tab === x ? "bg-brand-800 text-white" : "text-slate-500 hover:text-brand-800")}>{x} ({x === "incoming" ? incoming.length : outgoing.length})</button>
          ))}
        </div>
      } />
      {list.length === 0 && <EmptyState title="No referrals here." hint={tab === "incoming" ? "Referrals sent to your facility will appear here." : "Referrals you create appear here."} />}
      {list.map(r => {
        const p = getDB().patients.find(x => x.id === r.patientId);
        const action = tab === "incoming" ? ACTION_LABEL[r.status] : undefined;
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-bold text-brand-600">{r.code}</p>
                  <Pill tone={r.priority === "EMERGENCY" || r.priority === "URGENT" ? "red" : r.priority === "PRIORITY" ? "amber" : "slate"}>{r.priority}</Pill>
                  <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
                </div>
                <p className="font-display mt-1 text-[15px] font-bold text-brand-950">{p?.name} · {facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)}</p>
                <p className="truncate text-xs text-slate-500">{r.reason} · expected {fmtD(r.expectedDate)} · by {r.createdByName} · {relTime(r.ts)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {action && user?.facilityId === r.toFacilityId && (
                  <Btn size="sm" variant={action.variant ?? "primary"} loading={busy === r.id + action.to} onClick={() => void advance(r, action.to)}>
                    {t(action.key)} <ArrowRight className="h-3.5 w-3.5" />
                  </Btn>
                )}
                <Link to={`/app/referrals/${r.id}`}><Btn size="sm" variant="secondary">Details</Btn></Link>
                {p && <Link to={`/app/patients/${p.id}`}><Btn size="sm" variant="ghost">{t("viewRecord")}</Btn></Link>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- referral detail */

export function ReferralDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const nav = useNavigate();
  const refQ = useApi(() => api.getReferral(user as never, id!), [id]);
  const [busy, setBusy] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [escOpen, setEscOpen] = useState(false);
  const [fu, setFu] = useState({ date: todayISO(7), notes: "" });

  const r = refQ.data;
  const p = r ? getDB().patients.find(x => x.id === r.patientId) : undefined;

  const advance = async (to: RefStatus) => {
    if (!r) return;
    setBusy(true);
    try {
      await api.advanceReferral(user as never, r.id, to);
      toast(`${r.code} moved to ${to}`, "success");
      if (to === "COMPLETED") setFuOpen(true);
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setBusy(false);
  };

  if (refQ.loading) return <Spinner label={t("loading")} />;
  if (!r || !p) return <EmptyState title="Referral not found" action={<Link to="/app/referrals"><Btn size="sm" variant="secondary">{t("back")}</Btn></Link>} />;

  const doneIdx = REF_FLOW.indexOf(r.status);
  const next = nextStatuses(r.status).filter(s => s !== "CANCELLED");
  const ACTION_LABEL: Record<string, string> = { ACKNOWLEDGED: t("acknowledge"), ACCEPTED: t("accept"), ARRIVED: t("markArrived"), IN_CONSULTATION: "Start consultation", TREATMENT: t("startTreatment"), COMPLETED: t("completeReferral") };
  const canAct = user?.facilityId === r.toFacilityId && isClinical(user?.role) || (r.status === "ACCEPTED" && (user?.role === "ASHA" || user?.role === "ANM"));
  const overdue = isOverdue(r);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card pad={false} className="overflow-hidden">
        <div className="bg-brand-950 px-6 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-bold text-emerald-300">{r.code}</p>
              <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight">{facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)}</h1>
              <p className="mt-1 text-sm text-brand-300">{p.name} · {p.rakId} · {p.age}y · {r.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={r.priority === "EMERGENCY" || r.priority === "URGENT" ? "red" : "amber"}>{r.priority}</Pill>
              <RefStatusBadge status={r.status} overdue={overdue} />
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wider text-brand-400">
              <span>{t("stCreated")}</span><span>{t("stCompleted")}</span>
            </div>
            <Progress value={r.status === "CANCELLED" ? 100 : ((doneIdx + 1) / REF_FLOW.length) * 100} tone={overdue ? "red" : "brand"} />
            <div className="mt-2 flex flex-wrap gap-1">
              {REF_FLOW.map((s, i) => (
                <span key={s} className={cx("rounded px-1.5 py-0.5 font-mono text-[9px] font-bold", i <= doneIdx && r.status !== "CANCELLED" ? "bg-emerald-500/25 text-emerald-300" : "bg-white/8 text-brand-400")}>{s.replace("_", " ")}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-1 px-6 py-4 text-sm sm:grid-cols-2">
          <KV k="Expected date" v={`${fmtD(r.expectedDate)}${overdue ? " · OVERDUE" : ""}`} />
          <KV k="Created by" v={`${r.createdByName} (${r.creatorRole.replace("_", " ")})`} />
          <KV k="Follow-up date" v={r.followUpDate ? fmtD(r.followUpDate) : "Not scheduled"} />
          <KV k="Events recorded" v={r.events.length} />
        </div>
      </Card>

      {r.clinicalSummary && (
        <Card title="Clinical summary & vitals at referral">
          <p className="text-sm leading-relaxed text-slate-700">{r.clinicalSummary}</p>
          {r.vitalsSnapshot && <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 font-mono text-xs font-bold text-sky-800">{r.vitalsSnapshot}</p>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card title="Referral event timeline" pad={false}>
          <div className="relative p-5">
            <span className="absolute bottom-6 left-[31px] top-6 w-px bg-brand-900/15" aria-hidden="true" />
            <div className="space-y-4">
              {r.events.map((e, i) => (
                <div key={e.id} className="relative flex gap-4">
                  <span className={cx("z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white font-mono text-[9px] font-bold shadow-card", i === r.events.length - 1 ? "bg-brand-700 text-white" : "bg-brand-100 text-brand-700")}>
                    {fmtTime(e.ts)}
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-brand-900/10 bg-brand-50/40 px-3.5 py-2.5">
                    <p className="text-sm font-bold text-brand-950">{e.to === "CREATED" ? "Referral created" : `Referral ${e.to.toLowerCase().replace("_", " ")}`}{i === 0 ? ` at ${facilityName(e.facilityId)}` : ` by ${facilityName(e.facilityId)}`}</p>
                    <p className="text-xs text-slate-500">{fmtDT(e.ts)} · {e.actorName} ({e.role.replace("_", " ")}){e.notes ? ` — ${e.notes}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Actions">
            {r.status === "COMPLETED"
              ? <Banner tone="success"><CheckCircle2 className="mb-1 inline h-4 w-4" /> Referral loop closed on {r.completedAt ? fmtDT(r.completedAt) : "—"}. {r.followUpDate ? `Follow-up ${fmtD(r.followUpDate)}.` : ""}</Banner>
              : r.status === "CANCELLED"
                ? <Banner tone="danger">Referral cancelled.</Banner>
                : canAct && next.length > 0
                  ? (
                    <div className="space-y-2">
                      <Btn className="w-full" size="lg" loading={busy} onClick={() => void advance(next[0])}>{ACTION_LABEL[next[0]] ?? next[0]} <ArrowRight className="h-4 w-4" /></Btn>
                      <p className="text-center text-[11px] text-slate-400">Moves {r.status} → {next[0]}. Every transition is audited.</p>
                    </div>
                  )
                  : <Banner tone="info">Waiting on {facilityName(r.toFacilityId)} to act. You'll be notified when it moves.</Banner>}
            {isClinical(user?.role) && r.status !== "COMPLETED" && r.status !== "CANCELLED" && (
              <div className="mt-3 grid gap-2">
                <Btn variant="warning" onClick={() => setEscOpen(true)}><Send className="h-4 w-4" /> {t("escalate")} ({facilityName(r.toFacilityId)} → next tier)</Btn>
                <Btn variant="secondary" onClick={() => setFuOpen(true)}><CalendarClock className="h-4 w-4" /> {t("scheduleFollowup")}</Btn>
              </div>
            )}
            <Link to={`/app/patients/${p.id}`} className="mt-3 block"><Btn variant="dark" className="w-full"><Activity className="h-4 w-4" /> Longitudinal record</Btn></Link>
          </Card>
          <Card title="Patient snapshot">
            <KV k="Name" v={p.name} />
            <KV k="RAKSHA ID" v={p.rakId} mono />
            <KV k="Age / gender" v={`${p.age}y · ${p.gender.toLowerCase()}`} />
            <KV k="Village" v={p.village} />
            <KV k="Conditions" v={p.conditions.join(", ") || "—"} />
            <KV k="ASHA" v={p.ashaName} />
            <KV k="Consent" v={p.consent} />
          </Card>
        </div>
      </div>

      <Modal open={fuOpen} onClose={() => setFuOpen(false)} title={`${t("scheduleFollowup")} — ${p.name}`}>
        <div className="space-y-4">
          <Field label="Follow-up date" required><Input type="date" min={todayISO()} value={fu.date} onChange={e => setFu(f => ({ ...f, date: e.target.value }))} /></Field>
          <Field label={t("notes")}><Textarea value={fu.notes} onChange={e => setFu(f => ({ ...f, notes: e.target.value }))} placeholder="What should the ASHA check?" /></Field>
          <Btn className="w-full" onClick={() => {
            void api.scheduleFollowUp(user as never, { patientId: p.id, referralId: r.id, date: fu.date, notes: fu.notes || "Post-referral review", assigneeRole: "ASHA" }).then(() => { toast("Follow-up scheduled — ASHA notified.", "success"); setFuOpen(false); nav("/app/followups"); }).catch(e => toast(e instanceof Error ? e.message : "Failed", "error"));
          }}><CalendarClock className="h-4 w-4" /> {t("scheduleFollowup")}</Btn>
        </div>
      </Modal>

      <Modal open={escOpen} onClose={() => setEscOpen(false)} title={`${t("escalate")} — ${p.name}`} wide>
        <Banner tone="info">Escalation creates a new referral from {facilityName(r.toFacilityId)} to the next appropriate tier. The full longitudinal record travels with it.</Banner>
        <div className="mt-4"><ReferralPanel patient={p} fromFacilityId={r.toFacilityId} onDone={() => setEscOpen(false)} /></div>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------- doctor patient page */

export function ConsultModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [f, setF] = useState({ complaint: "", findings: "", assessment: "", plan: "", followUpDate: "", investigation: "", meds: [{ name: "", dose: "", duration: "" }] });
  const [saving, setSaving] = useState(false);
  const setMed = (i: number, k: string, v: string) => setF(x => ({ ...x, meds: x.meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  const save = async () => {
    if (!f.complaint.trim() || !f.assessment.trim()) { toast("Complaint and assessment are required.", "warning"); return; }
    setSaving(true);
    try {
      await api.createConsultation(user as never, {
        patientId: patient.id, complaint: f.complaint, findings: f.findings, assessment: f.assessment, plan: f.plan,
        followUpDate: f.followUpDate || undefined, investigation: f.investigation || undefined,
        meds: f.meds.filter(m => m.name.trim()),
      });
      toast("Consultation saved to the longitudinal record.", "success");
      onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={<span className="inline-flex items-center gap-2"><Stethoscope className="h-5 w-5 text-brand-600" /> Consultation — {patient.name}</span>} wide>
      <div className="space-y-4">
        <Banner tone="info">The patient's full history (visits, vitals trends, previous prescriptions) is visible on the record page beside this form.</Banner>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Presenting complaint" required><Input value={f.complaint} onChange={e => setF(x => ({ ...x, complaint: e.target.value }))} /></Field>
          <Field label="Investigations ordered"><Input value={f.investigation} onChange={e => setF(x => ({ ...x, investigation: e.target.value }))} placeholder="CBC, X-Ray…" /></Field>
        </div>
        <Field label="Clinical observations / findings"><Textarea value={f.findings} onChange={e => setF(x => ({ ...x, findings: e.target.value }))} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Assessment" required><Textarea value={f.assessment} onChange={e => setF(x => ({ ...x, assessment: e.target.value }))} /></Field>
          <Field label="Treatment plan"><Textarea value={f.plan} onChange={e => setF(x => ({ ...x, plan: e.target.value }))} /></Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Prescription</p>
          {f.meds.map((m, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_100px_120px_36px] items-center gap-2">
              <Input placeholder="Medicine" value={m.name} onChange={e => setMed(i, "name", e.target.value)} />
              <Input placeholder="Dose" value={m.dose} onChange={e => setMed(i, "dose", e.target.value)} />
              <Input placeholder="Duration" value={m.duration} onChange={e => setMed(i, "duration", e.target.value)} />
              <button onClick={() => setF(x => ({ ...x, meds: x.meds.filter((_, j) => j !== i) }))} aria-label="Remove medicine" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Btn size="sm" variant="secondary" onClick={() => setF(x => ({ ...x, meds: [...x.meds, { name: "", dose: "", duration: "" }] }))}><PlusCircle className="h-4 w-4" /> Add medicine</Btn>
        </div>
        <Field label="Follow-up date"><Input type="date" min={todayISO()} value={f.followUpDate} onChange={e => setF(x => ({ ...x, followUpDate: e.target.value }))} /></Field>
        <Btn size="lg" className="w-full" loading={saving} onClick={() => void save()}><FileText className="h-4 w-4" /> Save consultation</Btn>
      </div>
    </Modal>
  );
}

export function DoctorPatientPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [consult, setConsult] = useState(false);
  const [emgOpen, setEmgOpen] = useState(false);
  const [emgNote, setEmgNote] = useState("");
  const [savingEmg, setSavingEmg] = useState(false);
  const patQ = useApi(() => api.searchPatients(user as never, "").then(l => l.find(p => p.id === id) ?? null), [id]);
  const clinical = isClinical(user?.role);

  const createEmg = async () => {
    if (!id || !emgNote.trim()) { toast("Add a clinical note for the emergency team.", "warning"); return; }
    setSavingEmg(true);
    try {
      const e = await api.createEmergency(user as never, id, emgNote);
      toast(`Emergency ${e.code} created — district team alerted.`, "success");
      setEmgOpen(false);
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
    setSavingEmg(false);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {clinical && (
        <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-brand-900/10 bg-white p-3 shadow-card">
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-400">Clinical actions:</span>
          <Btn size="sm" onClick={() => setConsult(true)}><Stethoscope className="h-4 w-4" /> New consultation</Btn>
          <Btn size="sm" variant="danger" onClick={() => setEmgOpen(true)}><Siren className="h-4 w-4" /> {t("markCritical")}</Btn>
          <Link to={`/app/journey/${id}`}><Btn size="sm" variant="secondary"><Activity className="h-4 w-4" /> {t("careJourney")}</Btn></Link>
          <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">Access logged · purpose: care delivery</span>
        </div>
      )}
      <PatientRecordPage />
      {consult && patQ.data && <ConsultModal patient={patQ.data} onClose={() => setConsult(false)} />}
      <Modal open={emgOpen} onClose={() => setEmgOpen(false)} title="Create emergency event">
        <div className="space-y-4">
          <Banner tone="danger"><ShieldAlert className="mb-1 inline h-4 w-4" /> This creates <b>EMG-RAK-2026-XXXXX</b>, alerts the district team in-app and queues a one-time SMS command. Use only for genuinely critical cases.</Banner>
          <Field label="Clinical note for the receiving team" required><Textarea value={emgNote} onChange={e => setEmgNote(e.target.value)} placeholder="e.g. SpO₂ 86% with respiratory distress, oxygen started…" /></Field>
          <Btn variant="danger" className="w-full" loading={savingEmg} onClick={() => void createEmg()}><Siren className="h-4 w-4" /> {t("markCritical")} — raise emergency</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------- emergency */

export function EmergencyPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const emgQ = useApi(() => api.listEmergencies(user as never), [user?.id]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const redeem = async (id: string) => {
    setBusy(id);
    try {
      await api.redeemSmsCommand(user as never, id, tokens[id] ?? "");
      toast("Command verified — alarm triggered at receiving facility.", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Rejected", "error"); }
    setBusy(null);
  };

  if (emgQ.loading) return <Spinner label={t("loading")} />;
  const list = emgQ.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionHead kicker="Critical events" title={t("emergency")} />
      <Banner tone="info">Push notifications use an isolated FCM adapter (in-app simulation here). The SMS fallback sends only <span className="font-mono font-bold">EMERGENCY|EVENT_ID|ONE_TIME_TOKEN</span> — never medical data. Tokens expire in 10 minutes and replay is blocked.</Banner>
      {list.length === 0 && <EmptyState icon={<Siren className="h-8 w-8" />} title="No emergency events" hint="Doctors can raise an emergency from any patient record." />}
      {list.map(e => {
        const p = getDB().patients.find(x => x.id === e.patientId);
        return (
          <Card key={e.id} className={e.status === "ACTIVE" ? "border-rose-300 ring-2 ring-rose-100" : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-extrabold text-rose-700">{e.code}</p>
                  <Pill tone={e.status === "ACTIVE" ? "red" : e.status === "ACKNOWLEDGED" ? "amber" : "green"} pulse={e.status === "ACTIVE"}>{e.status}</Pill>
                </div>
                <p className="font-display mt-1 text-lg font-bold text-brand-950">{p?.name} <span className="font-mono text-xs text-brand-500">{p?.rakId}</span></p>
                <p className="text-xs text-slate-500">{facilityName(e.facilityId)} · raised by {e.doctorName} · {fmtDT(e.ts)}</p>
                <p className="mt-1.5 max-w-lg text-sm text-slate-700">{e.clinicalNote}</p>
              </div>
              <Link to={`/app/patients/${e.patientId}`}><Btn size="sm" variant="secondary">{t("viewRecord")}</Btn></Link>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-dashed border-brand-300 bg-brand-50/50 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600"><KeyRound className="h-3.5 w-3.5" /> Controlled SMS fallback — prototype</p>
                <p className="font-mono text-xs font-bold text-brand-900">EMERGENCY|{e.code}|{e.smsRedeemed ? "••••••" : e.smsToken}</p>
                <p className="mt-1 text-[10px] text-slate-400">Expires {fmtTime(e.smsExpiresAt)} · {e.smsRedeemed ? "redeemed (replay blocked)" : "one-time token"}</p>
                {e.status === "ACTIVE" && (
                  <div className="mt-2 flex gap-2">
                    <Input className="py-1.5 font-mono uppercase" placeholder="Enter token" value={tokens[e.id] ?? ""} onChange={ev => setTokens(x => ({ ...x, [e.id]: ev.target.value }))} />
                    <Btn size="sm" variant="warning" loading={busy === e.id} onClick={() => void redeem(e.id)}>Verify</Btn>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-brand-950 p-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-400">Event log</p>
                {e.smsLog.map((l, i) => <p key={i} className="font-mono text-[10px] leading-relaxed text-emerald-300/90">{l}</p>)}
                {e.ackBy && <p className="mt-1 font-mono text-[10px] text-amber-300">Acknowledged by {e.ackBy} at {e.ackAt ? fmtTime(e.ackAt) : "—"}</p>}
              </div>
            </div>
            {e.status !== "RESOLVED" && (
              <div className="mt-3 flex justify-end">
                <Btn size="sm" variant="secondary" onClick={() => { void api.resolveEmergency(user as never, e.id).then(() => toast("Emergency resolved.", "success")); }}><CheckCircle2 className="h-4 w-4" /> Mark resolved</Btn>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
