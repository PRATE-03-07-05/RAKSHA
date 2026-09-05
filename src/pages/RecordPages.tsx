/** Longitudinal Health Record + Care Journey — the continuity-of-care showcase. */
import React, { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  HeartPulse, FileJson, MapPin, Phone, ShieldCheck, ShieldAlert, BrainCircuit,
  Signpost, Video, FlaskConical, Pill, Stethoscope, Siren, ClipboardList,
  UserPlus, ChevronDown, Activity, CalendarClock, Sparkles, ArrowRight,
} from "lucide-react";
import { api, getDB, buildAiSummary, toFhirBundle, facilityName, followUpState, isOverdue } from "../store/backend";
import { useAuth, useApi, useI18n } from "../store/providers";
import { Card, Pill as StatusPill, RiskBadge, RefStatusBadge, Modal, Btn, Spinner, EmptyState, KV, Banner, QRCard, SectionHead, Avatar } from "../components/ui";
import type { TimelineEvent, TimelineKind, Patient, Referral, FollowUp } from "../lib/types";
import { fmtD, fmtDT, fmtShort, fmtTime, cx, daysUntil } from "../lib/utils";

/* ------------------------------------------------------------ record page */

const KIND_META: Record<TimelineKind, { icon: React.ReactNode; cls: string; label: string }> = {
  registered: { icon: <UserPlus className="h-4 w-4" />, cls: "bg-slate-200 text-slate-700", label: "Registration" },
  visit: { icon: <HeartPulse className="h-4 w-4" />, cls: "bg-brand-100 text-brand-700", label: "Visit" },
  vitals: { icon: <Activity className="h-4 w-4" />, cls: "bg-sky-100 text-sky-700", label: "Vitals" },
  assessment: { icon: <BrainCircuit className="h-4 w-4" />, cls: "bg-violet-100 text-violet-700", label: "AI Triage" },
  consultation: { icon: <Stethoscope className="h-4 w-4" />, cls: "bg-emerald-100 text-emerald-700", label: "Consultation" },
  prescription: { icon: <Pill className="h-4 w-4" />, cls: "bg-teal-100 text-teal-700", label: "Rx" },
  diagnostic: { icon: <FlaskConical className="h-4 w-4" />, cls: "bg-indigo-100 text-indigo-700", label: "Diagnostics" },
  referral: { icon: <Signpost className="h-4 w-4" />, cls: "bg-clay-400/25 text-clay-600", label: "Referral" },
  teleconsult: { icon: <Video className="h-4 w-4" />, cls: "bg-cyan-100 text-cyan-700", label: "Tele" },
  followup: { icon: <ClipboardList className="h-4 w-4" />, cls: "bg-amber-100 text-amber-700", label: "Follow-up" },
  emergency: { icon: <Siren className="h-4 w-4" />, cls: "bg-rose-100 text-rose-700", label: "Emergency" },
};

function EventDetail({ ev }: { ev: TimelineEvent }) {
  const d = ev.data as Record<string, never>;
  if (ev.kind === "assessment") {
    const a = d as never as { level: string; factors: { label: string; detail: string; severity: string }[]; recommendation: string; confirmed: boolean; confirmedBy?: string; version: string };
    return (
      <div className="mt-2 space-y-2">
        {a.factors.map(f => (
          <div key={f.label} className="flex items-start gap-2 text-xs">
            <span className={cx("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", f.severity === "critical" ? "bg-rose-500" : f.severity === "high" ? "bg-orange-500" : f.severity === "warn" ? "bg-amber-500" : "bg-emerald-500")} />
            <span><b>{f.label}.</b> <span className="text-slate-500">{f.detail}</span></span>
          </div>
        ))}
        <p className="rounded-md bg-brand-50 px-2.5 py-1.5 text-xs text-brand-800">{a.recommendation}</p>
        <p className="text-[10px] text-slate-400">{a.version} · {a.confirmed ? `confirmed by ${a.confirmedBy}` : "awaiting clinician confirmation"} · AI-assisted, not a diagnosis</p>
      </div>
    );
  }
  if (ev.kind === "referral") {
    const r = d as never as Referral;
    return (
      <div className="mt-2">
        <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
        <div className="mt-2 space-y-1">
          {r.events.slice(0, 6).map(e => (
            <p key={e.id} className="flex items-baseline gap-2 text-[11px] text-slate-500">
              <span className="font-mono font-semibold text-brand-700">{fmtTime(e.ts)}</span> {e.to.replace("_", " ")} · {e.actorName} @ {facilityName(e.facilityId)}
            </p>
          ))}
        </div>
      </div>
    );
  }
  if (ev.kind === "prescription") {
    const rx = d as never as { meds: { name: string; dose: string; duration: string }[] };
    return <div className="mt-2 space-y-1">{rx.meds.map(m => <p key={m.name} className="text-xs text-slate-600"><b>{m.name}</b> — {m.dose} · {m.duration}</p>)}</div>;
  }
  if (ev.kind === "vitals") {
    const v = d as never as { sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; rr?: number; weight?: number; device?: string; workerName: string };
    const rows: [string, string][] = [
      ...(v.sys ? [["Blood pressure", `${v.sys}/${v.dia} mmHg`] as [string, string]] : []),
      ...(v.temp ? [["Temperature", `${v.temp}°F`] as [string, string]] : []),
      ...(v.spo2 ? [["SpO₂", `${v.spo2}%`] as [string, string]] : []),
      ...(v.hr ? [["Heart rate", `${v.hr}/min`] as [string, string]] : []),
      ...(v.rr ? [["Respiratory rate", `${v.rr}/min`] as [string, string]] : []),
      ...(v.weight ? [["Weight", `${v.weight} kg`] as [string, string]] : []),
    ];
    return (
      <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
        {rows.map(([k, val]) => <KV key={k} k={k} v={val} />)}
        <KV k="Recorded by" v={v.workerName} />
      </div>
    );
  }
  if (ev.kind === "followup") {
    const f = d as never as FollowUp;
    const st = followUpState(f);
    return <div className="mt-2 flex items-center gap-2 text-xs"><StatusPill tone={st === "OVERDUE" ? "red" : st === "COMPLETED" ? "green" : st === "DUE_TODAY" ? "amber" : "sky"}>{st.replace("_", " ")}</StatusPill><span className="text-slate-500">{f.notes}</span></div>;
  }
  const rows = Object.entries(d).filter(([k]) => !["id", "patientId", "events", "inputs"].includes(k) && typeof (d as never as Record<string, unknown>)[k] === "string").slice(0, 4) as [string, string][];
  return rows.length ? <div className="mt-2 grid gap-x-4 sm:grid-cols-2">{rows.map(([k, val]) => <KV key={k} k={k.replace(/([A-Z])/g, " $1")} v={String(val).slice(0, 90)} />)}</div> : null;
}

export function TimelineList({ events, limit }: { events: TimelineEvent[]; limit?: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const shown = limit ? events.slice(0, limit) : events;
  const groups = useMemo(() => {
    const m = new Map<string, TimelineEvent[]>();
    shown.forEach(e => {
      const k = fmtD(e.ts);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return [...m.entries()];
  }, [shown]);
  return (
    <div className="relative">
      <span className="absolute bottom-2 left-[19px] top-2 w-px bg-brand-900/15" aria-hidden="true" />
      <div className="space-y-6">
        {groups.map(([day, evs]) => (
          <div key={day}>
            <p className="relative mb-2 ml-10 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-500">
              <span className="absolute -left-[25px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-paper bg-brand-400" />{day}
            </p>
            <div className="ml-10 space-y-2">
              {evs.map(ev => {
                const meta = KIND_META[ev.kind];
                const open = expanded === ev.id;
                return (
                  <div key={ev.id} className="overflow-hidden rounded-xl border border-brand-900/10 bg-white shadow-card transition hover:border-brand-300">
                    <button className="flex w-full items-start gap-3 p-3.5 text-left" onClick={() => setExpanded(open ? null : ev.id)} aria-expanded={open}>
                      <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.cls)}>{meta.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <b className="text-sm text-brand-950">{ev.title}</b>
                          <StatusPill tone="slate">{fmtTime(ev.ts)}</StatusPill>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{ev.subtitle}{ev.facilityId ? ` · ${facilityName(ev.facilityId)}` : ""}</span>
                      </span>
                      <ChevronDown className={cx("mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
                    </button>
                    {open && <div className="border-t border-dashed border-brand-900/10 px-4 pb-3.5 pt-1"><EventDetail ev={ev} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatientRecordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");
  const [fhirOpen, setFhirOpen] = useState(false);

  const selfQ = useApi(() => (id ? Promise.resolve(null) : api.searchPatients(user as never, user!.name)), [id, user?.id]);
  const pid = id ?? selfQ.data?.[0]?.id;
  const recQ = useApi(() => (pid ? api.getPatient(user as never, pid) : Promise.resolve(null)), [pid]);
  const tlQ = useApi(() => (pid ? api.getTimeline(user as never, pid) : Promise.resolve(null)), [pid]);

  if (selfQ.loading || recQ.loading || tlQ.loading) return <Spinner label={t("loading")} />;
  const rec = recQ.data;
  if (!rec || !pid) return <EmptyState title="Patient not found" hint="Search for a patient from the Patients screen." />;
  const p = rec.patient as Patient;
  const events = (tlQ.data?.events ?? []).filter(e => filter === "all" || e.kind === filter);
  const summary = rec.restricted ? [] : buildAiSummary(getDB(), pid);
  const bundle = rec.restricted ? null : toFhirBundle(getDB(), pid);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card pad={false} className="overflow-hidden">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Avatar name={p.name} className="h-16 w-16 text-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-950">{p.name}</h1>
                {p.consent === "ACTIVE"
                  ? <StatusPill tone="green"><ShieldCheck className="h-3 w-3" /> {t("consentActive")}</StatusPill>
                  : <StatusPill tone="red"><ShieldAlert className="h-3 w-3" /> Consent LIMITED</StatusPill>}
                {p.pregnant && <StatusPill tone="clay">Pregnant</StatusPill>}
              </div>
              <p className="mt-1 font-mono text-xs font-bold tracking-wide text-brand-600">{p.rakId}{p.abhaId ? ` · ${p.abhaId}` : ""}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{p.age} yrs · {p.gender.toLowerCase()}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.village}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {p.phone}</span>
                <span>ASHA: <b className="text-brand-800">{p.ashaName}</b></span>
                <span>PHC: <b className="text-brand-800">{facilityName(p.phcId)}</b></span>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setFhirOpen(true)} disabled={!!rec.restricted}><FileJson className="h-4 w-4" /> FHIR R4</Btn>
              <Link to={`/app/journey${user?.role === "PATIENT" ? "" : `/${p.id}`}`}><Btn size="sm" variant="dark"><Activity className="h-4 w-4" /> {t("careJourney")}</Btn></Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 border-t border-brand-900/8 px-5 py-3 text-xs sm:grid-cols-4">
            <div><p className="text-slate-400">Conditions</p><p className="font-semibold text-brand-950">{p.conditions.join(", ") || "None recorded"}</p></div>
            <div><p className="text-slate-400">Allergies</p><p className="font-semibold text-brand-950">{p.allergies.join(", ") || "None recorded"}</p></div>
            <div><p className="text-slate-400">Blood group</p><p className="font-semibold text-brand-950">{p.bloodGroup ?? "—"}</p></div>
            <div><p className="text-slate-400">Emergency contact</p><p className="font-semibold text-brand-950">{p.emergencyContact} · {p.emergencyPhone}</p></div>
          </div>
        </Card>
        <div className="flex items-center justify-center rounded-xl border border-brand-900/10 bg-white p-4 shadow-card">
          <div className="text-center">
            <QRCard text={p.rakId} size={112} />
            <p className="mt-2 font-mono text-[10px] font-semibold text-brand-500">RAKSHA ID QR · demo</p>
          </div>
        </div>
      </div>

      {rec.restricted && (
        <Banner tone="warning">
          <b>Consent is LIMITED for this patient.</b> Clinical details are hidden. Access attempt has been logged with your identity and purpose. Request explicit consent to view the full record.
        </Banner>
      )}

      {!rec.restricted && summary.length > 0 && (
        <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-clay-600" /> AI health record summary</span>} action={<StatusPill tone="amber">{t("demoData")}</StatusPill>}>
          <ul className="space-y-1.5">
            {summary.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />{s}</li>)}
          </ul>
          <p className="mt-3 border-t border-dashed border-brand-900/10 pt-2.5 text-[11px] italic text-slate-400">{t("aiSummaryNote")}</p>
        </Card>
      )}

      <div>
        <SectionHead kicker="Longitudinal health record" title="Every event, one timeline" right={
          <div className="flex flex-wrap gap-1.5">
            {(["all", "visit", "vitals", "assessment", "consultation", "referral", "followup"] as const).map(k => (
              <button key={k} onClick={() => setFilter(k)} className={cx("rounded-full border px-3 py-1 text-[11px] font-bold capitalize transition", filter === k ? "border-brand-700 bg-brand-800 text-white" : "border-brand-900/15 bg-white text-slate-500 hover:border-brand-400")}>{k}</button>
            ))}
          </div>
        } />
        {events.length === 0
          ? <EmptyState title={t("noData")} hint="No events match this filter yet." />
          : <TimelineList events={events} />}
      </div>

      <Modal open={fhirOpen} onClose={() => setFhirOpen(false)} title="HL7 FHIR R4 export (adapter preview)" wide>
        <Banner tone="info">Integration-ready adapter — maps RAKSHA records to FHIR resources (Patient, Observation, Encounter, Condition, MedicationRequest, DiagnosticReport). Sends nowhere until ABDM/HMIS credentials are configured.</Banner>
        <pre className="mt-4 max-h-[50vh] overflow-auto rounded-xl bg-brand-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-200">
          {JSON.stringify(bundle, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------- care journey */

interface JourneyNode {
  key: string; icon: React.ReactNode; title: string; date: number; facility?: string;
  role: string; status: string; tone: "done" | "active" | "warn" | "danger" | "todo";
  detail?: string; badge?: React.ReactNode;
}

export function CareJourneyPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const selfQ = useApi(() => (id ? Promise.resolve(null) : api.searchPatients(user as never, user!.name)), [id, user?.id]);
  const pid = id ?? selfQ.data?.[0]?.id;
  const recQ = useApi(() => (pid ? api.getPatient(user as never, pid, "Care journey view") : Promise.resolve(null)), [pid]);
  const tlQ = useApi(() => (pid ? api.getTimeline(user as never, pid) : Promise.resolve(null)), [pid]);

  const nodes = useMemo<JourneyNode[]>(() => {
    const evs = [...(tlQ.data?.events ?? [])].sort((a, b) => a.ts - b.ts);
    const out: JourneyNode[] = [];
    evs.forEach(ev => {
      const d = ev.data as never as Referral & FollowUp & { level?: string; workerName?: string; doctorName?: string; isTele?: boolean; type?: string; status?: string };
      if (ev.kind === "registered") out.push({ key: ev.id, icon: <UserPlus className="h-4 w-4" />, title: "Patient registered", date: ev.ts, role: "System", status: "RAKSHA ID issued", tone: "done", detail: ev.subtitle });
      else if (ev.kind === "visit") out.push({ key: ev.id, icon: <HeartPulse className="h-4 w-4" />, title: d.type === "HOME_VISIT" ? "ASHA home visit" : "Facility visit", date: ev.ts, facility: ev.facilityId ? facilityName(ev.facilityId) : undefined, role: d.workerName ?? "Health worker", status: "Visit recorded", tone: "done", detail: ev.subtitle });
      else if (ev.kind === "assessment") out.push({ key: ev.id, icon: <BrainCircuit className="h-4 w-4" />, title: "AI-assisted risk assessment", date: ev.ts, role: d.workerName ?? "Health worker", status: d.level ?? "", tone: d.level === "CRITICAL" ? "danger" : d.level === "HIGH" ? "warn" : "done", detail: ev.subtitle, badge: d.level ? <RiskBadge level={d.level as never} /> : undefined });
      else if (ev.kind === "consultation") out.push({ key: ev.id, icon: <Stethoscope className="h-4 w-4" />, title: d.isTele ? "Teleconsultation note" : "Clinical consultation", date: ev.ts, facility: ev.facilityId ? facilityName(ev.facilityId) : undefined, role: d.doctorName ?? "Doctor", status: "Care documented", tone: "done", detail: ev.subtitle });
      else if (ev.kind === "referral") {
        const r = d as unknown as Referral;
        const overdue = isOverdue(r);
        out.push({
          key: ev.id, icon: <Signpost className="h-4 w-4" />, title: `Referral · ${facilityName(r.fromFacilityId)} → ${facilityName(r.toFacilityId)}`, date: ev.ts,
          facility: facilityName(r.toFacilityId), role: r.createdByName, status: r.status.replace("_", " "),
          tone: r.status === "COMPLETED" ? "done" : overdue ? "danger" : "active",
          detail: `${r.code} · ${r.reason}`, badge: <RefStatusBadge status={r.status} overdue={overdue} />,
        });
      } else if (ev.kind === "teleconsult") out.push({ key: ev.id, icon: <Video className="h-4 w-4" />, title: "Specialist teleconsultation", date: ev.ts, facility: ev.facilityId ? facilityName(ev.facilityId) : undefined, role: "Specialist", status: (d.status as string)?.toLowerCase() ?? "", tone: d.status === "COMPLETED" ? "done" : "active", detail: ev.subtitle });
      else if (ev.kind === "followup") {
        const f = d as unknown as FollowUp;
        const st = followUpState(f);
        out.push({ key: ev.id, icon: <ClipboardList className="h-4 w-4" />, title: "Follow-up", date: ev.ts, role: "ASHA", status: st.replace("_", " "), tone: st === "OVERDUE" ? "danger" : st === "COMPLETED" ? "done" : st === "DUE_TODAY" ? "warn" : "active", detail: f.notes });
      } else if (ev.kind === "emergency") out.push({ key: ev.id, icon: <Siren className="h-4 w-4" />, title: "Emergency event", date: ev.ts, facility: ev.facilityId ? facilityName(ev.facilityId) : undefined, role: d.doctorName ?? "Doctor", status: (d.status as string) ?? "ACTIVE", tone: "danger", detail: ev.subtitle });
    });
    return out;
  }, [tlQ.data]);

  if (selfQ.loading || recQ.loading || tlQ.loading) return <Spinner label={t("loading")} />;
  const p = recQ.data?.patient as Patient | undefined;
  if (!p) return <EmptyState title="Patient not found" />;

  const doneCount = nodes.filter(n => n.tone === "done").length;
  const progress = nodes.length ? Math.round((doneCount / nodes.length) * 100) : 0;
  const overall = nodes.some(n => n.tone === "danger") ? "Needs attention" : nodes.some(n => n.tone === "active" || n.tone === "warn") ? "Care in progress" : "Loop closed";

  const toneCls: Record<JourneyNode["tone"], string> = {
    done: "bg-emerald-600 text-white border-emerald-600",
    active: "bg-brand-700 text-white border-brand-700",
    warn: "bg-amber-500 text-white border-amber-500",
    danger: "bg-rose-600 text-white border-rose-600",
    todo: "bg-white text-slate-400 border-slate-300",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={p.name} className="h-12 w-12 text-lg" />
            <div>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-brand-950">{p.name} · {t("careJourney")}</h1>
              <p className="font-mono text-xs font-bold text-brand-600">{p.rakId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill tone={overall === "Loop closed" ? "green" : overall === "Needs attention" ? "red" : "sky"} pulse={overall !== "Loop closed"}>{overall}</StatusPill>
            <span className="font-mono text-xs font-bold text-slate-500">{progress}% complete</span>
          </div>
        </div>
        <div className="border-t border-brand-900/8 px-5 py-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-900/10">
            <div className="anim-breathe h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-1000" style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
        </div>
      </Card>

      {nodes.length === 0 && <EmptyState title={t("noData")} hint="No journey recorded yet." />}

      <div className="relative">
        <span className="absolute bottom-4 left-6 top-4 w-[3px] rounded bg-gradient-to-b from-brand-600 via-brand-300 to-brand-100 sm:left-1/2 sm:-translate-x-1/2" aria-hidden="true" />
        <div className="space-y-8">
          {nodes.map((n, i) => (
            <div key={n.key} className={cx("relative flex sm:w-1/2", i % 2 === 0 ? "sm:pr-10" : "sm:ml-auto sm:pl-10")}>
              <span className={cx("absolute left-6 top-5 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border-4 border-paper shadow-card sm:left-auto", i % 2 === 0 ? "sm:-right-[22px]" : "sm:-left-[22px]", toneCls[n.tone])}>
                {n.icon}
              </span>
              <div className={cx("ml-12 w-full rounded-xl border border-brand-900/10 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop sm:ml-0")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">{fmtDT(n.date)}</p>
                  {n.badge ?? <StatusPill tone={n.tone === "done" ? "green" : n.tone === "danger" ? "red" : n.tone === "warn" ? "amber" : "sky"}>{n.status}</StatusPill>}
                </div>
                <h3 className="font-display mt-1 text-[15px] font-bold leading-tight text-brand-950">{n.title}</h3>
                {n.detail && <p className="mt-1 text-xs leading-relaxed text-slate-500">{n.detail}</p>}
                <p className="mt-2 text-[11px] font-medium text-slate-400">
                  {n.role}{n.facility ? ` · ${n.facility}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-col items-center gap-2 text-center">
          <CalendarClock className="h-6 w-6 text-brand-500" />
          <p className="font-display text-lg font-bold text-brand-950">Continuity of care</p>
          <p className="max-w-md text-sm text-slate-500">
            Every stage above — field visit, risk flag, referral, specialist care, follow-up — is written to the same longitudinal record. Nothing is re-collected, nothing disappears.
          </p>
          <Link to={user?.role === "PATIENT" ? "/app/record" : `/app/patients/${p.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-900">
            Open full record <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
