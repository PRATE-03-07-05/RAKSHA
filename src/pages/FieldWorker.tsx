/** ASHA / ANM / PHC Staff workspace — built for small screens, low connectivity, big actions. */
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus, Search, HeartPulse, Activity, BrainCircuit, Signpost, ClipboardList,
  RefreshCw, Users, ChevronRight, CheckCircle2, AlertTriangle, CloudOff, Database,
  ArrowLeft, ArrowRight, MapPin, Phone, Baby, Stethoscope, Wifi, ShieldCheck, Clock3,
} from "lucide-react";
import { api, getDB, facilityName, followUpState, isOverdue } from "../store/backend";
import { SYMPTOM_OPTIONS, type TriageInput } from "../lib/triage";
import { useAuth, useApi, useConn, useI18n, useToast } from "../store/providers";
import { Card, StatCard, Pill, RiskBadge, RefStatusBadge, Btn, Input, Field, Select, Textarea, Spinner, EmptyState, Banner, KV, SectionHead, Avatar, Progress } from "../components/ui";
import { QRCode } from "../components/QRCode";
import type { Patient, Assessment, Referral } from "../lib/types";
import { fmtD, fmtDT, relTime, todayISO, cx, daysUntil, ageFrom } from "../lib/utils";

/* ------------------------------------------------------------ dashboard */

export function FieldDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { counts, offline, idbCount } = useConn();
  const nav = useNavigate();
  const patQ = useApi(() => api.searchPatients(user as never, ""), [user?.id]);
  const fuQ = useApi(() => api.listFollowUps(user as never), [user?.id]);
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);

  const derived = useMemo(() => {
    const db = getDB();
    const pids = new Set((patQ.data ?? []).map(p => p.id));
    const today = todayISO();
    const latestByPatient = new Map<string, Assessment>();
    db.assessments.forEach(a => { if (pids.has(a.patientId) && !latestByPatient.has(a.patientId)) latestByPatient.set(a.patientId, a); });
    return {
      todayTasks: (fuQ.data ?? []).filter(f => f.date === today && f.status === "SCHEDULED").length,
      overdue: (fuQ.data ?? []).filter(f => followUpState(f) === "OVERDUE").length,
      highRisk: [...latestByPatient.values()].filter(a => a.level === "HIGH" || a.level === "CRITICAL"),
      pendingRefs: (refQ.data ?? []).filter(r => !["COMPLETED", "CANCELLED"].includes(r.status)),
      unconfirmed: [...latestByPatient.values()].filter(a => !a.confirmed),
      latestByPatient,
    };
  }, [patQ.data, fuQ.data, refQ.data]);

  if (patQ.loading) return <Spinner label={t("loading")} />;

  const ACTIONS: { label: string; key: Parameters<typeof t>[0]; icon: React.ReactNode; to: string; tone: string }[] = [
    { label: "Register", key: "registerPatient", icon: <UserPlus className="h-6 w-6" />, to: "/app/register", tone: "bg-brand-700 text-white" },
    { label: "Search", key: "searchPatient", icon: <Search className="h-6 w-6" />, to: "/app/patients", tone: "bg-white text-brand-900 border border-brand-200" },
    { label: "Assess", key: "riskAssessment", icon: <BrainCircuit className="h-6 w-6" />, to: "/app/assess", tone: "bg-brand-900 text-white" },
    { label: "Referral", key: "createReferral", icon: <Signpost className="h-6 w-6" />, to: "/app/assess", tone: "bg-white text-brand-900 border border-brand-200" },
    { label: "Follow-up", key: "followups", icon: <ClipboardList className="h-6 w-6" />, to: "/app/followups", tone: "bg-white text-brand-900 border border-brand-200" },
    { label: "Sync", key: "syncCenter", icon: <RefreshCw className="h-6 w-6" />, to: "/app/sync", tone: counts.pending > 0 ? "bg-clay-500 text-white" : "bg-white text-brand-900 border border-brand-200" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">{t("welcome")}, {user!.name}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">{t("dashboard")}</h1>
        </div>
        {offline
          ? <Pill tone="red" pulse><CloudOff className="h-3 w-3" /> {t("offline")} · {counts.pending} {t("pending")}</Pill>
          : <Pill tone="green"><Wifi className="h-3 w-3" /> {t("online")}</Pill>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's tasks" value={derived.todayTasks} sub="Follow-ups due today" icon={<ClipboardList className="h-4 w-4" />} onClick={() => nav("/app/followups")} />
        <StatCard label="Overdue" value={derived.overdue} sub="Follow-ups past date" icon={<AlertTriangle className="h-4 w-4" />} tone={derived.overdue > 0 ? "red" : "brand"} onClick={() => nav("/app/followups")} />
        <StatCard label={t("highRisk")} value={derived.highRisk.length} sub="Patients flagged HIGH/CRITICAL" icon={<HeartPulse className="h-4 w-4" />} tone={derived.highRisk.length > 0 ? "amber" : "brand"} onClick={() => nav("/app/patients")} />
        <StatCard label="Unsynced records" value={counts.pending} sub={offline ? "Stored safely on this device" : "All synced"} icon={<RefreshCw className="h-4 w-4" />} tone={counts.pending > 0 ? "amber" : "brand"} onClick={() => nav("/app/sync")} />
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quick actions</p>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {ACTIONS.map(a => (
            <Link key={a.label} to={a.to} className={cx("flex flex-col items-center justify-center gap-2 rounded-xl px-2 py-4 shadow-card transition-all hover:-translate-y-1 hover:shadow-pop active:scale-95", a.tone)}>
              {a.icon}
              <span className="text-[11px] font-bold leading-tight">{t(a.key)}</span>
            </Link>
          ))}
        </div>
      </div>

      {(derived.overdue > 0 || derived.pendingRefs.some(isOverdue) || derived.unconfirmed.length > 0) && (
        <div className="space-y-2">
          {(fuQ.data ?? []).filter(f => followUpState(f) === "OVERDUE").slice(0, 3).map(f => {
            const p = getDB().patients.find(x => x.id === f.patientId);
            const ref = f.referralId ? getDB().referrals.find(r => r.id === f.referralId) : undefined;
            return (
              <Banner key={f.id} tone="danger">
                <b>⚠ FOLLOW-UP OVERDUE</b> — {p?.name} ({p?.rakId}){ref ? ` · Referral: ${facilityName(ref.fromFacilityId)} → ${facilityName(ref.toFacilityId)}` : ""} · Expected {Math.abs(daysUntil(f.date))} day(s) ago.
                <b> Action:</b> contact patient / healthcare worker. <Link to="/app/followups" className="underline">Open</Link>
              </Banner>
            );
          })}
          {derived.pendingRefs.filter(isOverdue).slice(0, 2).map(r => {
            const p = getDB().patients.find(x => x.id === r.patientId);
            return (
              <Banner key={r.id} tone="warning">
                <b>Referral {r.code} not acknowledged / patient not arrived.</b> {p?.name} ({p?.rakId}) · {facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)} · expected {fmtD(r.expectedDate)}.
              </Banner>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`${t("highRisk")} — my patients`} action={<Link to="/app/patients" className="text-xs font-bold text-brand-700">All patients</Link>}>
          {derived.highRisk.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No high-risk patients right now. 🎉</p>}
          <div className="space-y-2">
            {derived.highRisk.map(a => {
              const p = getDB().patients.find(x => x.id === a.patientId);
              return (
                <Link key={a.id} to={`/app/assess?patient=${a.patientId}`} className="flex items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3 transition hover:border-brand-300 hover:bg-brand-50/50">
                  <div className="flex items-center gap-3">
                    <Avatar name={p?.name ?? "?"} />
                    <div>
                      <p className="text-sm font-bold text-brand-950">{p?.name}</p>
                      <p className="font-mono text-[10px] text-brand-500">{p?.rakId} · {relTime(a.ts)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={a.level} />
                    {!a.confirmed && <Pill tone="amber">unconfirmed</Pill>}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card title="Pending referrals">
          {derived.pendingRefs.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No pending referrals.</p>}
          <div className="space-y-2">
            {derived.pendingRefs.slice(0, 5).map(r => {
              const p = getDB().patients.find(x => x.id === r.patientId);
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3">
                  <div>
                    <p className="text-sm font-bold text-brand-950">{p?.name}</p>
                    <p className="text-[11px] text-slate-500">{facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)} · {fmtD(r.expectedDate)}</p>
                  </div>
                  <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- registration */

const CONDITIONS = ["Hypertension", "Type 2 Diabetes", "Asthma", "Heart disease", "Kidney disease", "TB (on treatment)"];

export function RegisterPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", dob: "", gender: "FEMALE" as Patient["gender"], phone: "", village: user?.village ?? "", address: "", emergencyContact: "", emergencyPhone: "", conditions: [] as string[], allergies: "", pregnant: false, consent: false });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Patient | null>(null);
  const set = (k: string, v: unknown) => setF(x => ({ ...x, [k]: v }));

  const submit = async () => {
    if (!f.name.trim() || !f.dob || !f.village.trim() || !f.consent) { toast("Name, date of birth, village and consent are required.", "warning"); return; }
    setSaving(true);
    try {
      const p = await api.registerPatient(user as never, {
        name: f.name.trim(), dob: f.dob, age: ageFrom(f.dob), gender: f.gender, phone: f.phone || "—",
        village: f.village.trim(), address: f.address || f.village, emergencyContact: f.emergencyContact || "—",
        emergencyPhone: f.emergencyPhone || "—", conditions: f.conditions,
        allergies: f.allergies ? f.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
        pregnant: f.gender === "FEMALE" ? f.pregnant : undefined,
      });
      setDone(p);
      toast("Patient successfully registered.", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Registration failed", "error"); }
    setSaving(false);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="font-display mt-3 text-2xl font-extrabold text-brand-950">Patient successfully registered.</h1>
          <p className="mt-1 text-sm text-slate-500">Print or photograph this card — the ID follows the patient across every facility.</p>
          <div className="mx-auto mt-5 w-fit rounded-2xl border-2 border-brand-800 bg-white p-5 shadow-pop">
            <p className="font-display text-lg font-extrabold text-brand-950">{done.name}</p>
            <p className="text-xs text-slate-500">{done.age} yrs · {done.gender.toLowerCase()} · {done.village}</p>
            <p className="mt-2 font-mono text-sm font-bold tracking-wider text-brand-700">{done.rakId}</p>
            <div className="mt-3 flex justify-center"><QRCode value={`${window.location.origin}/qr/patient/${done.id}`} size={132} /></div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scan to view patient info</p>
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <Btn variant="secondary" onClick={() => { setDone(null); setF({ name: "", dob: "", gender: "FEMALE", phone: "", village: user?.village ?? "", address: "", emergencyContact: "", emergencyPhone: "", conditions: [], allergies: "", pregnant: false, consent: false }); }}><UserPlus className="h-4 w-4" /> Register another</Btn>
            <Btn onClick={() => nav(`/app/patients/${done.id}`)}>View record <ArrowRight className="h-4 w-4" /></Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHead kicker="New patient" title={t("registerPatient")} />
      <Card>
        <div className="space-y-4">
          <Field label={t("name")} required><Input value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Sita Devi" /></Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Date of birth" required><Input type="date" max={todayISO()} value={f.dob} onChange={e => set("dob", e.target.value)} /></Field>
            <Field label={t("gender")} required>
              <Select value={f.gender} onChange={e => set("gender", e.target.value)}>
                <option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label={t("phone")}><Input value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="98xxx-xxxxx" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("village")} required><Input value={f.village} onChange={e => set("village", e.target.value)} /></Field>
            <Field label="Address"><Input value={f.address} onChange={e => set("address", e.target.value)} placeholder="House / landmark" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Emergency contact"><Input value={f.emergencyContact} onChange={e => set("emergencyContact", e.target.value)} placeholder="Name (relation)" /></Field>
            <Field label="Emergency phone"><Input value={f.emergencyPhone} onChange={e => set("emergencyPhone", e.target.value)} /></Field>
          </div>
          <Field label="Known medical conditions">
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map(c => (
                <button type="button" key={c} onClick={() => set("conditions", f.conditions.includes(c) ? f.conditions.filter(x => x !== c) : [...f.conditions, c])}
                  className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold transition", f.conditions.includes(c) ? "border-brand-700 bg-brand-700 text-white" : "border-brand-900/15 bg-white text-slate-600")}>
                  {c}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Allergies" hint="Comma separated"><Input value={f.allergies} onChange={e => set("allergies", e.target.value)} placeholder="Penicillin, …" /></Field>
            {f.gender === "FEMALE" && (
              <label className="flex items-center gap-3 self-end rounded-lg border border-brand-900/10 bg-brand-50/60 px-3 py-2.5">
                <input type="checkbox" checked={f.pregnant} onChange={e => set("pregnant", e.target.checked)} className="h-4 w-4 accent-brand-700" />
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-900"><Baby className="h-4 w-4 text-brand-600" /> Currently pregnant</span>
              </label>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3.5">
            <input type="checkbox" checked={f.consent} onChange={e => set("consent", e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span className="text-xs leading-relaxed text-brand-900">
              <b>Consent:</b> the patient agrees that their health information is shared with their care team (ASHA, PHC, CHC, district hospital) through RAKSHA, with every access logged. Consent can be limited at any time.
            </span>
          </label>
          <Btn size="lg" className="w-full" onClick={() => void submit()} loading={saving}><UserPlus className="h-5 w-5" /> {t("registerPatient")}</Btn>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- patients */

export function PatientsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const patQ = useApi(() => api.searchPatients(user as never, q), [q, user?.id]);
  const latest = useMemo(() => {
    const db = getDB();
    const m = new Map<string, Assessment>();
    db.assessments.forEach(a => { if (!m.has(a.patientId)) m.set(a.patientId, a); });
    return m;
  }, [patQ.data]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <SectionHead kicker="Registry" title={t("patients")} right={(user?.role === "ASHA" || user?.role === "ANM" || user?.role === "PHC_STAFF") ? <Link to="/app/register"><Btn size="sm"><UserPlus className="h-4 w-4" /> {t("registerPatient")}</Btn></Link> : undefined} />
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-10" placeholder={`${t("searchPatient")} — RAKSHA ID, name or phone…`} value={q} onChange={e => setQ(e.target.value)} aria-label={t("searchPatient")} />
      </div>
      {patQ.loading ? <Spinner /> : (patQ.data ?? []).length === 0 ? <EmptyState icon={<Users className="h-8 w-8" />} title="No patients match" hint="Try a different name, RAK-PAT ID or phone number." /> : (
        <div className="overflow-hidden rounded-xl border border-brand-900/10 bg-white shadow-card">
          {(patQ.data ?? []).map((p, i) => {
            const a = latest.get(p.id);
            return (
              <Link key={p.id} to={`/app/patients/${p.id}`} className={cx("flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-brand-50/70 sm:flex-nowrap", i > 0 && "border-t border-brand-900/8")}>
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-950">
                    {p.name}
                    {p.consent === "LIMITED" && <Pill tone="red">consent limited</Pill>}
                    {p.pregnant && <Pill tone="clay">pregnant</Pill>}
                  </p>
                  <p className="font-mono text-[11px] text-brand-500">{p.rakId} · {p.age}y {p.gender === "FEMALE" ? "F" : p.gender === "MALE" ? "M" : "O"} · {p.village} · <Phone className="inline h-3 w-3" /> {p.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a && <RiskBadge level={a.level} />}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------- assessment wizard */

export function ReferralPanel({ patient, assessment, onDone, fromFacilityId }: { patient: Patient; assessment?: Assessment | null; onDone: (r: Referral) => void; fromFacilityId?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const level = assessment?.level;
  const origin = fromFacilityId ?? patient.phcId;
  const recQ = useApi(() => api.recommendFacilities(user as never, {
    fromFacilityId: origin,
    needsEmergency: level === "CRITICAL" || level === "HIGH",
    needsOxygen: (assessment?.inputs.spo2 ?? 100) < 94,
    specialty: undefined,
  }), [patient.id, assessment?.id]);
  const [toFacilityId, setToFacilityId] = useState<string | null>(null);
  const [form, setForm] = useState({ reason: "", priority: (level === "CRITICAL" ? "EMERGENCY" : level === "HIGH" ? "URGENT" : "PRIORITY") as Referral["priority"], expectedDate: todayISO(level === "CRITICAL" || level === "HIGH" ? 0 : 1), followUpDate: todayISO(7), summary: "" });
  const [saving, setSaving] = useState(false);
  const best = recQ.data?.[0]?.facility.id ?? null;
  const dest = toFacilityId ?? best;

  const submit = async () => {
    if (!dest) { toast("Choose a destination facility.", "warning"); return; }
    if (!form.reason.trim()) { toast("Reason is required.", "warning"); return; }
    setSaving(true);
    try {
      const v = assessment?.inputs;
      const vit = v ? [v.spo2 ? `SpO₂ ${v.spo2}%` : null, v.temp ? `Temp ${v.temp}°F` : null, v.hr ? `HR ${v.hr}` : null, v.sys ? `BP ${v.sys}/${v.dia}` : null].filter(Boolean).join(" · ") : undefined;
      const r = await api.createReferral(user as never, {
        patientId: patient.id, fromFacilityId: origin, toFacilityId: dest,
        reason: form.reason, priority: form.priority, expectedDate: form.expectedDate, followUpDate: form.followUpDate,
        clinicalSummary: form.summary || `${patient.name}, ${patient.age}y. ${v?.symptoms.join(", ") ?? ""}. ${vit ?? ""} AI-assisted level: ${level ?? "—"}.`,
        vitalsSnapshot: vit,
      });
      toast(
        r.pendingSync
          ? `Referral saved offline — pending synchronization. It is NOT delivered to ${facilityName(dest)} until synced.`
          : `Referral ${r.code} created & sent to ${facilityName(dest)}.`,
        r.pendingSync ? "warning" : "success",
      );
      onDone(r);
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Recommended facility <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DEMO DATA</span></p>
        {recQ.loading ? <Spinner /> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(recQ.data ?? []).map((rc, i) => (
              <button key={rc.facility.id} onClick={() => setToFacilityId(rc.facility.id)}
                className={cx("rounded-xl border p-3.5 text-left transition", dest === rc.facility.id ? "border-brand-600 bg-brand-50 ring-2 ring-brand-200" : "border-brand-900/10 bg-white hover:border-brand-300")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-brand-950">{rc.facility.name}</p>
                  {i === 0 && <Pill tone="brand">Recommended</Pill>}
                </div>
                <p className="font-mono text-[11px] text-brand-500">{rc.facility.type} · {rc.facility.distanceKm} km · match {rc.score}%</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {rc.reasons.slice(0, 4).map(r => <span key={r} className="rounded bg-brand-100/70 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">{r}</span>)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("reason")} required><Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why refer?" /></Field>
        <Field label={t("priority")} required>
          <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as never }))}>
            <option>ROUTINE</option><option>PRIORITY</option><option>URGENT</option><option>EMERGENCY</option>
          </Select>
        </Field>
        <Field label="Expected date" required><Input type="date" min={todayISO()} value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} /></Field>
        <Field label="Follow-up date"><Input type="date" min={todayISO()} value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} /></Field>
      </div>
      <Field label="Clinical summary"><Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief history, vitals, treatment given…" /></Field>
      <Btn size="lg" className="w-full" loading={saving} onClick={() => void submit()}><Signpost className="h-5 w-5" /> {t("createReferral")} → {dest ? facilityName(dest) : "…"}</Btn>
    </div>
  );
}

export function AssessFlow() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState({ complaint: "", symptoms: [] as string[], observations: "", notes: "", location: "" });
  const [vitals, setVitals] = useState({ sys: "", dia: "", temp: "", spo2: "", hr: "", rr: "", weight: "", severity: "MILD" as TriageInput["severity"] });
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const patQ = useApi(() => (q.length >= 2 ? api.searchPatients(user as never, q) : Promise.resolve([])), [q]);
  const preselect = useMemo(() => new URLSearchParams(window.location.search).get("patient"), []);
  const preQ = useApi(() => (preselect ? api.searchPatients(user as never, "").then(l => l.filter(p => p.id === preselect)) : Promise.resolve([])), [preselect]);

  const run = async () => {
    if (!patient) return;
    if (visit.symptoms.length === 0 && !vitals.spo2 && !vitals.temp) { toast("Record at least one symptom or vital.", "warning"); return; }
    setConfirming(true);
    try {
      if (visit.complaint || visit.symptoms.length) {
        await api.createVisit(user as never, { patientId: patient.id, type: user!.role === "PHC_STAFF" ? "PHC_VISIT" : "HOME_VISIT", symptoms: visit.symptoms, complaint: visit.complaint, observations: visit.observations, notes: visit.notes, location: visit.location || `${patient.village} (home)` });
      }
      const num = (s: string) => (s === "" ? undefined : Number(s));
      const anyVital = [vitals.sys, vitals.dia, vitals.temp, vitals.spo2, vitals.hr, vitals.rr, vitals.weight].some(Boolean);
      if (anyVital) await api.createVitals(user as never, { patientId: patient.id, sys: num(vitals.sys), dia: num(vitals.dia), temp: num(vitals.temp), spo2: num(vitals.spo2), hr: num(vitals.hr), rr: num(vitals.rr), weight: num(vitals.weight), device: "Field kit" });
      const a = await api.assessTriage(user as never, patient.id, {
        symptoms: visit.symptoms, sys: num(vitals.sys), dia: num(vitals.dia), temp: num(vitals.temp), spo2: num(vitals.spo2), hr: num(vitals.hr), rr: num(vitals.rr),
        age: patient.age, pregnant: patient.pregnant, conditions: patient.conditions, severity: vitals.severity,
      });
      setAssessment(a);
      setStep(3);
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setConfirming(false);
  };

  const confirm = async () => {
    if (!assessment) return;
    await api.confirmAssessment(user as never, assessment.id);
    setAssessment({ ...assessment, confirmed: true, confirmedBy: user!.name, confirmedAt: Date.now() });
    toast("Assessment confirmed — stored with your sign-off.", "success");
  };

  const reset = () => { setStep(1); setPatient(null); setQ(""); setAssessment(null); setShowReferral(false); setVisit({ complaint: "", symptoms: [], observations: "", notes: "", location: "" }); setVitals({ sys: "", dia: "", temp: "", spo2: "", hr: "", rr: "", weight: "", severity: "MILD" }); };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionHead kicker="AI-assisted workflow" title={t("riskAssessment")} right={<Pill tone={step === 1 ? "brand" : step === 2 ? "amber" : "green"}>Step {step} / 3</Pill>} />
      <Progress value={step * 33} />

      {step === 1 && (
        <Card title={`1 · ${t("searchPatient")}`}>
          {(preQ.data ?? []).length > 0 && !patient && (
            <button onClick={() => { setPatient(preQ.data![0]); setStep(2); }} className="mb-3 flex w-full items-center justify-between rounded-lg border border-brand-300 bg-brand-50 p-3 text-left hover:bg-brand-100">
              <span className="text-sm font-bold text-brand-900">{preQ.data![0].name} <span className="font-mono text-[11px] text-brand-500">{preQ.data![0].rakId}</span></span>
              <Pill tone="brand">pre-selected</Pill>
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-10" placeholder="Type at least 2 letters — name, ID or phone…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="mt-3 space-y-2">
            {(patQ.data ?? []).slice(0, 6).map(p => (
              <button key={p.id} onClick={() => { setPatient(p); setStep(2); }} className="flex w-full items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50/60">
                <span className="flex items-center gap-3"><Avatar name={p.name} /><span><b className="text-sm text-brand-950">{p.name}</b><span className="block font-mono text-[11px] text-brand-500">{p.rakId} · {p.age}y · {p.village}</span></span></span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </button>
            ))}
            {q.length >= 2 && (patQ.data ?? []).length === 0 && <EmptyState title="No match" hint="Check the spelling or register the patient first." action={<Link to="/app/register"><Btn size="sm" variant="secondary"><UserPlus className="h-4 w-4" /> {t("registerPatient")}</Btn></Link>} />}
          </div>
        </Card>
      )}

      {step === 2 && patient && (
        <Card title={<span className="flex items-center gap-2"><ArrowLeft className="h-4 w-4 cursor-pointer text-brand-500" onClick={() => setStep(1)} /> 2 · {t("recordVisit")} + {t("recordVitals")} — {patient.name}</span>}>
          <div className="space-y-4">
            <Field label="Reported symptoms" required>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOM_OPTIONS.map(s => (
                  <button key={s} onClick={() => setVisit(v => ({ ...v, symptoms: v.symptoms.includes(s) ? v.symptoms.filter(x => x !== s) : [...v.symptoms, s] }))}
                    className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold transition", visit.symptoms.includes(s) ? "border-brand-700 bg-brand-700 text-white" : "border-brand-900/15 bg-white text-slate-600")}>{s}</button>
                ))}
              </div>
            </Field>
            <Field label="Main complaint"><Input value={visit.complaint} onChange={e => setVisit(v => ({ ...v, complaint: e.target.value }))} placeholder="In the patient's own words…" /></Field>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{t("recordVitals")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([["spo2", "SpO₂ %"], ["temp", "Temp °F"], ["hr", "HR /min"], ["rr", "RR /min"], ["sys", "BP sys"], ["dia", "BP dia"], ["weight", "Weight kg"]] as const).map(([k, label]) => (
                  <Field key={k} label={label}><Input inputMode="decimal" value={vitals[k]} onChange={e => setVitals(v => ({ ...v, [k]: e.target.value }))} placeholder="—" /></Field>
                ))}
                <Field label="Severity">
                  <Select value={vitals.severity} onChange={e => setVitals(v => ({ ...v, severity: e.target.value as never }))}>
                    <option>MILD</option><option>MODERATE</option><option>SEVERE</option>
                  </Select>
                </Field>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Observations"><Textarea value={visit.observations} onChange={e => setVisit(v => ({ ...v, observations: e.target.value }))} /></Field>
              <Field label={t("notes")}><Textarea value={visit.notes} onChange={e => setVisit(v => ({ ...v, notes: e.target.value }))} /></Field>
            </div>
            <Btn size="lg" className="w-full" loading={confirming} onClick={() => void run()}><BrainCircuit className="h-5 w-5" /> Save & run AI-assisted assessment</Btn>
            <p className="text-center text-[11px] text-slate-400">Works offline — vitals are append-only: history is never overwritten.</p>
          </div>
        </Card>
      )}

      {step === 3 && patient && assessment && (
        <div className="space-y-4">
          <Card pad={false} className="overflow-hidden">
            <div className={cx("px-6 py-5 text-white", assessment.level === "CRITICAL" ? "bg-rose-700" : assessment.level === "HIGH" ? "bg-clay-600" : assessment.level === "MEDIUM" ? "bg-amber-500" : "bg-emerald-600")}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">AI-assisted preliminary assessment</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-4xl font-extrabold tracking-tight">{assessment.level} RISK</h2>
                <p className="text-sm font-semibold opacity-90">{patient.name} · {patient.rakId}</p>
              </div>
            </div>
            <div className="p-5">
              {/* Engine transparency: which decision-support engine produced this */}
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand-900/10 bg-brand-50/60 px-3.5 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Decision support:</span>
                {assessment.mode === "ML_MODEL" && (
                  <Pill tone="brand">ML model · {assessment.version.replace(/^ml-/, "")}{typeof assessment.confidence === "number" ? ` · ${(assessment.confidence * 100).toFixed(0)}% confidence` : ""}</Pill>
                )}
                {assessment.mode === "RULE_BASED_FALLBACK" && (
                  <Pill tone="amber">Rule-based engine — ML model unavailable</Pill>
                )}
                {assessment.mode === "OFFLINE_PROVISIONAL" && (
                  <Pill tone="amber">Saved offline — server will assess on sync</Pill>
                )}
                {!assessment.mode && <Pill tone="slate">{assessment.version}</Pill>}
              </div>
              {assessment.pendingSync && (
                <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900">
                  Captured offline — this provisional reading is queued and the authoritative
                  assessment will be computed by the server when connectivity returns.
                </div>
              )}
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Why this result? — contributing factors</p>
              <ul className="space-y-2">
                {assessment.factors.map(f => (
                  <li key={f.label} className="flex items-start gap-2.5 text-sm">
                    <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", f.severity === "critical" ? "bg-rose-500" : f.severity === "high" ? "bg-orange-500" : f.severity === "warn" ? "bg-amber-500" : "bg-emerald-500")} />
                    <span><b className="text-brand-950">{f.label}.</b> <span className="text-slate-500">{f.detail}</span></span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-sm font-semibold text-brand-900">Suggested workflow: “{assessment.recommendation.replace(/_/g, " ").toLowerCase()}”</p>
              <p className="mt-3 text-xs italic text-slate-500">{t("aiDisclaimer")}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{assessment.version}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {!assessment.confirmed
                  ? <Btn onClick={() => void confirm()}><CheckCircle2 className="h-4 w-4" /> {t("confirmAssessment")}</Btn>
                  : <Pill tone="green"><ShieldCheck className="h-3 w-3" /> Confirmed by {assessment.confirmedBy}</Pill>}
                <Btn variant="warning" onClick={() => setShowReferral(s => !s)} disabled={!assessment.confirmed}><Signpost className="h-4 w-4" /> {t("createReferral")}</Btn>
                <Btn variant="secondary" onClick={reset}>New assessment</Btn>
              </div>
              {!assessment.confirmed && <p className="mt-2 text-[11px] text-slate-400">Confirm the assessment to unlock referral creation — the clinical decision is yours.</p>}
            </div>
          </Card>
          {showReferral && assessment.confirmed && (
            <Card title={`3 · ${t("createReferral")} — ${patient.name}`}>
              <ReferralPanel patient={patient} assessment={assessment} onDone={() => reset()} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}



/* -------------------------------------------------------------- followups */

export function FollowUpsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const fuQ = useApi(() => api.listFollowUps(user as never), [user?.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const isField = user!.role === "ASHA" || user!.role === "ANM";
  const complete = async (id: string) => {
    setBusy(id);
    try { await api.completeFollowUp(user as never, id); toast("Follow-up marked completed.", "success"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setBusy(null);
  };
  if (fuQ.loading) return <Spinner label={t("loading")} />;
  const list = fuQ.data ?? [];
  const tone = { OVERDUE: "red", DUE_TODAY: "amber", UPCOMING: "sky", COMPLETED: "green" } as const;
  const order = { OVERDUE: 0, DUE_TODAY: 1, UPCOMING: 2, COMPLETED: 3 } as const;
  const sorted = [...list].sort((a, b) => order[followUpState(a)] - order[followUpState(b)]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionHead kicker="Follow-up engine" title={t("followups")} />
      {sorted.length === 0 && <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No follow-ups" hint="Follow-ups appear here when referrals or consultations schedule one." />}
      {sorted.map(f => {
        const p = getDB().patients.find(x => x.id === f.patientId);
        const ref = f.referralId ? getDB().referrals.find(r => r.id === f.referralId) : undefined;
        const st = followUpState(f);
        return (
          <Card key={f.id} className={st === "OVERDUE" ? "border-rose-300" : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={p?.name ?? "?"} />
                <div>
                  <p className="text-sm font-bold text-brand-950">{p?.name} <span className="font-mono text-[11px] font-semibold text-brand-500">{p?.rakId}</span></p>
                  <p className="text-xs text-slate-500">{f.notes}</p>
                  {ref && <p className="mt-0.5 text-[11px] text-slate-400">Referral: {facilityName(ref.fromFacilityId)} → {facilityName(ref.toFacilityId)} ({ref.code})</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-right">
                  <Pill tone={tone[st]}>{st === "OVERDUE" ? `${t("overdue")} · ${Math.abs(daysUntil(f.date))}d` : st === "DUE_TODAY" ? "Due today" : fmtD(f.date)}</Pill>
                  {st === "COMPLETED" && f.completedBy && <span className="mt-1 block text-[10px] text-slate-400">by {f.completedBy}</span>}
                </span>
                {isField && st !== "COMPLETED" && <Btn size="sm" variant={st === "OVERDUE" ? "danger" : "primary"} loading={busy === f.id} onClick={() => void complete(f.id)}><CheckCircle2 className="h-4 w-4" /> Done</Btn>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- sync center */

export function SyncCenterPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { offline, syncing, counts, idbCount, syncNow, retryFailed, netOnline, simOffline, setSimOffline } = useConn();
  const opsQ = useApi(() => api.syncState(), []);
  const ops = opsQ.data?.ops ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionHead kicker="Offline-first" title={t("syncCenter")} right={
        <button onClick={() => setSimOffline(!simOffline)} className="text-xs font-bold text-brand-700 underline-offset-2 hover:underline">
          {simOffline ? "Reconnect (demo)" : "Simulate offline (demo)"}
        </button>
      } />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("pending")} value={counts.pending} icon={<Clock3 className="h-4 w-4" />} tone={counts.pending > 0 ? "amber" : "brand"} />
        <StatCard label={t("synced")} value={counts.synced} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label={t("failed")} value={counts.failed} icon={<AlertTriangle className="h-4 w-4" />} tone={counts.failed > 0 ? "red" : "slate"} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-950">
              {offline ? <CloudOff className="h-4 w-4 text-rose-600" /> : <Wifi className="h-4 w-4 text-emerald-600" />}
              {offline ? t("offline") : t("online")} <span className="font-normal text-slate-400">· network {netOnline ? "up" : "down"}{simOffline ? " · simulated offline" : ""}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{t("lastSync")}: {counts.lastSyncAt ? fmtDT(counts.lastSyncAt) : "never"} · IndexedDB queue: <Database className="inline h-3.5 w-3.5" /> {idbCount} durable op(s)</p>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => void syncNow()} loading={syncing} disabled={offline}><RefreshCw className="h-4 w-4" /> {t("syncNow")}</Btn>
            <Btn variant="secondary" onClick={() => void retryFailed()} disabled={counts.failed === 0 || offline}>{t("retryFailed")}</Btn>
          </div>
        </div>
        {offline && <div className="mt-3"><Banner tone="warning">{t("changesWillSync")}</Banner></div>}
      </Card>

      <Card title="Operation log" pad={false}>
        {ops.length === 0 ? <div className="p-5"><EmptyState title={t("noData")} hint="Operations appear here as field data is recorded." /></div> : (
          <div className="divide-y divide-brand-900/8">
            {ops.slice(0, 14).map(op => (
              <div key={op.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-950">{op.label}</p>
                  <p className="font-mono text-[10px] text-slate-400">{op.id} · {op.entity} · {fmtDT(op.ts)} · attempts {op.attempts}</p>
                </div>
                <Pill tone={op.status === "SYNCED" ? "green" : op.status === "PENDING" ? "amber" : "red"} pulse={op.status === "PENDING"}>{op.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="text-center text-[11px] text-slate-400">Medical observations are append-only and time-based — sync never overwrites history, so conflicts cannot destroy data. {user?.name ? "" : ""}</p>
    </div>
  );
}
