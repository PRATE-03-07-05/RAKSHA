/** Patient dashboard, appointments, referrals, teleconsultation room, notifications, profile. */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, MapPin, Signpost, ClipboardList, Activity, Video, Mic, MicOff,
  Camera, CameraOff, PhoneOff, ArrowRight, ShieldCheck, Bell, UserCircle, Timer,
  CheckCircle2, AlertTriangle, PlusCircle,
} from "lucide-react";
import { api, getDB, facilityName, isOverdue, PERMS } from "../store/backend";
import { useAuth, useApi, useI18n, useToast } from "../store/providers";
import { Card, StatCard, Pill, RefStatusBadge, RiskBadge, Btn, Spinner, EmptyState, Field, Input, Select, Textarea, Modal, Banner, KV, Avatar, SectionHead } from "../components/ui";
import { TimelineList } from "./RecordPages";
import type { Appointment, Referral, Teleconsultation, Patient } from "../lib/types";
import { fmtD, fmtDT, fmtTime, relTime, todayISO, cx } from "../lib/utils";

function useSelfPatient() {
  const { user } = useAuth();
  return useApi(() => api.searchPatients(user as never, user!.name).then(l => l[0] ?? null), [user?.id]);
}

/* ------------------------------------------------------------- patient home */

export function PatientHomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const selfQ = useSelfPatient();
  const apQ = useApi(() => api.listAppointments(user as never), [user?.id]);
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  const fuQ = useApi(() => api.listFollowUps(user as never), [user?.id]);
  const emgQ = useApi(() => api.listEmergencies(user as never), [user?.id]);
  const tlQ = useApi(() => (selfQ.data ? api.getTimeline(user as never, selfQ.data.id) : Promise.resolve(null)), [selfQ.data?.id]);

  if (selfQ.loading || apQ.loading) return <Spinner label={t("loading")} />;
  const p = selfQ.data;
  if (!p) return <EmptyState title="Profile not linked" hint="Ask your ASHA worker to register you to activate the patient portal." />;

  const upcoming = (apQ.data ?? []).filter(a => a.status !== "COMPLETED" && a.status !== "CANCELLED").sort((a, b) => a.date.localeCompare(b.date))[0];
  const activeRef = (refQ.data ?? []).find(r => !["COMPLETED", "CANCELLED"].includes(r.status));
  const nextFu = (fuQ.data ?? []).find(f => f.status === "SCHEDULED");
  const latestAssessment = (tlQ.data?.events ?? []).find(e => e.kind === "assessment")?.data as { level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } | undefined;
  const myEmergency = (emgQ.data ?? []).find(e => e.patientId === p.id && e.status === "ACTIVE");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card pad={false} className="overflow-hidden">
        <div className="bg-brand-950 px-6 py-6 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-300">{t("welcome")}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{p.name}</h1>
            <div className="flex items-center gap-2">
              {latestAssessment?.level && <RiskBadge level={latestAssessment.level} />}
              <Pill tone="green"><ShieldCheck className="h-3 w-3" /> Consent active</Pill>
            </div>
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-emerald-300">{p.rakId}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-brand-200">
            <span>{p.age} yrs · {p.gender.toLowerCase()}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.village}</span>
            <span>ASHA: <b className="text-white">{p.ashaName}</b></span>
            <span>PHC: <b className="text-white">{facilityName(p.phcId)}</b></span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-4">
          <StatCard label="Next appointment" value={upcoming ? fmtD(upcoming.date) : "—"} sub={upcoming ? `${upcoming.time} · ${facilityName(upcoming.facilityId)}` : "No appointment booked"} icon={<CalendarDays className="h-4 w-4" />} onClick={() => {}} />
          <StatCard label="Active referral" value={activeRef ? activeRef.status.replace("_", " ") : "None"} sub={activeRef ? `${facilityName(activeRef.fromFacilityId)} → ${facilityName(activeRef.toFacilityId)}` : "All referrals closed"} icon={<Signpost className="h-4 w-4" />} tone={activeRef ? "amber" : "brand"} />
          <StatCard label="Follow-up" value={nextFu ? fmtD(nextFu.date) : "—"} sub={nextFu ? nextFu.notes.slice(0, 34) : "Nothing scheduled"} icon={<ClipboardList className="h-4 w-4" />} tone={nextFu ? "sky" : "slate"} />
          <StatCard label="Care status" value={myEmergency ? "Emergency" : latestAssessment?.level ?? "Stable"} sub={myEmergency ? "Emergency team alerted" : "Longitudinal record up to date"} icon={<Activity className="h-4 w-4" />} tone={myEmergency ? "red" : "brand"} />
        </div>
      </Card>

      {myEmergency && (
        <Banner tone="danger">
          <b>Active emergency alert {myEmergency.code}.</b> The emergency team at {facilityName(myEmergency.facilityId)} has been notified.
          Status: <b>{myEmergency.status}</b>{myEmergency.ackBy ? ` — acknowledged by ${myEmergency.ackBy}` : ""}.
        </Banner>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Recent health events" action={<Link to="/app/record" className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-900">Full record <ArrowRight className="h-3.5 w-3.5" /></Link>}>
          {tlQ.loading ? <Spinner /> : <TimelineList events={tlQ.data?.events ?? []} limit={4} />}
        </Card>
        <div className="space-y-4">
          <Card title="My referrals" action={<Link to="/app/referrals" className="text-xs font-bold text-brand-700 hover:text-brand-900">All</Link>}>
            {(refQ.data ?? []).length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t("noData")}</p>}
            <div className="space-y-2.5">
              {(refQ.data ?? []).slice(0, 3).map(r => (
                <div key={r.id} className="rounded-lg border border-brand-900/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-bold text-brand-600">{r.code}</p>
                    <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-brand-950">{facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)}</p>
                  <p className="text-[11px] text-slate-500">{r.reason}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Quick actions">
            <div className="grid gap-2">
              <Link to="/app/appointments"><Btn variant="secondary" className="w-full"><CalendarDays className="h-4 w-4 text-brand-600" /> Book appointment</Btn></Link>
              <Link to="/app/journey"><Btn variant="secondary" className="w-full"><Activity className="h-4 w-4 text-brand-600" /> {t("careJourney")}</Btn></Link>
              <Link to="/app/tele"><Btn variant="secondary" className="w-full"><Video className="h-4 w-4 text-brand-600" /> {t("teleconsultation")}</Btn></Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- appointments */

export function AppointmentsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const selfQ = useSelfPatient();
  const apQ = useApi(() => api.listAppointments(user as never), [user?.id]);
  const facQ = useApi(() => api.listFacilities(user as never), []);
  const [form, setForm] = useState({ facilityId: "F-PHC-01", date: todayISO(1), time: "10:00", purpose: "" });
  const [saving, setSaving] = useState(false);

  const book = async () => {
    if (!form.purpose.trim()) { toast("Please describe the purpose of the visit.", "warning"); return; }
    setSaving(true);
    try {
      await api.bookAppointment(user as never, form);
      toast("Appointment requested — the facility will confirm.", "success");
      setForm(f => ({ ...f, purpose: "" }));
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    setSaving(false);
  };

  const statusTone = { REQUESTED: "sky", CONFIRMED: "green", IN_QUEUE: "amber", COMPLETED: "slate", CANCELLED: "red" } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHead kicker="Patient services" title={t("appointments")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card title="Book a visit" pad>
          <div className="space-y-4">
            <Field label="Facility" required>
              <Select value={form.facilityId} onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}>
                {(facQ.data ?? []).filter(f => f.type === "PHC" || f.type === "CHC").map(f => <option key={f.id} value={f.id}>{f.name} · {f.village}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required><Input type="date" min={todayISO()} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Time" required>
                <Select value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
                  {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:00", "14:30", "15:00"].map(x => <option key={x}>{x}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Purpose" required><Input placeholder="e.g. BP review, fever for child…" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></Field>
            <Btn onClick={() => void book()} loading={saving} className="w-full"><PlusCircle className="h-4 w-4" /> Request appointment</Btn>
            <p className="text-[11px] text-slate-400">Requests are confirmed by facility staff. You will see your queue position on the day.</p>
          </div>
        </Card>
        <Card title="My appointments">
          {apQ.loading ? <Spinner /> : (apQ.data ?? []).length === 0 ? <EmptyState title={t("noData")} hint="Book your first visit." /> : (
            <div className="space-y-2.5">
              {(apQ.data ?? []).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-900/10 p-3">
                  <div>
                    <p className="text-sm font-bold text-brand-950">{fmtD(a.date)} · {a.time}</p>
                    <p className="text-xs text-slate-500">{a.purpose} — {facilityName(a.facilityId)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={statusTone[a.status]}>{a.status.replace("_", " ")}</Pill>
                    {a.status === "IN_QUEUE" && <span className="font-mono text-[11px] font-bold text-clay-600">Queue #{a.queuePos}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ referrals */

export function ReferralListPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const refQ = useApi(() => api.listReferrals(user as never), [user?.id]);
  const [open, setOpen] = useState<string | null>(null);
  if (refQ.loading) return <Spinner label={t("loading")} />;
  const list = refQ.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionHead kicker="Closed-loop tracking" title={t("referrals")} />
      {list.length === 0 && <EmptyState title="No pending referrals." hint="All referrals are currently up to date." />}
      {list.map(r => (
        <Card key={r.id} pad={false} className="overflow-hidden">
          <button className="w-full p-4 text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs font-bold text-brand-600">{r.code}</p>
              <RefStatusBadge status={r.status} overdue={isOverdue(r)} />
            </div>
            <p className="font-display mt-1 text-[15px] font-bold text-brand-950">{facilityName(r.fromFacilityId)} → {facilityName(r.toFacilityId)}</p>
            <p className="text-xs text-slate-500">{r.reason} · expected {fmtD(r.expectedDate)} · {r.priority}</p>
          </button>
          {open === r.id && (
            <div className="border-t border-dashed border-brand-900/10 bg-brand-50/40 px-4 py-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-500">Referral event log</p>
              <div className="space-y-1.5">
                {r.events.map(e => (
                  <p key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-600">
                    <span className="font-mono font-bold text-brand-700">{fmtTime(e.ts)}</span>
                    <b>{e.to.replace("_", " ")}</b> · {e.actorName} @ {facilityName(e.facilityId)}
                    {e.notes && <span className="text-slate-400">— {e.notes}</span>}
                  </p>
                ))}
              </div>
              {r.followUpDate && <p className="mt-2 text-xs font-semibold text-brand-800">Follow-up scheduled: {fmtD(r.followUpDate)}</p>}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------- teleconsultation */

function Wave({ on }: { on: boolean }) {
  return (
    <span className="flex h-5 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={cx("w-[3px] rounded-full bg-emerald-400", on ? "animate-[barWave_0.9s_ease-in-out_infinite]" : "h-1")} style={on ? { animationDelay: `${i * 0.12}s`, height: "100%" } : undefined} />
      ))}
    </span>
  );
}

function TeleRoom({ tele, onClose }: { tele: Teleconsultation; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isDoctor = user!.role !== "PATIENT";
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [ending, setEnding] = useState(false);
  const [note, setNote] = useState({ summary: "", recommendation: "", followUp: "" });

  useEffect(() => {
    const t0 = Date.now();
    const iv = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const finish = async () => {
    if (isDoctor) {
      if (!note.summary.trim()) { toast("Please record the consultation summary for the longitudinal record.", "warning"); return; }
      setEnding(true);
      try {
        await api.completeTele(user as never, tele.id, note);
        toast("Teleconsultation completed — note added to patient record.", "success");
        onClose();
      } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); setEnding(false); }
    } else onClose();
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Modal open onClose={onClose} title={<span className="inline-flex items-center gap-2"><Video className="h-5 w-5 text-brand-600" /> Room {tele.roomCode}</span>} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        {[{ name: user!.name, sub: isDoctor ? "Specialist" : "Patient", self: true }, { name: isDoctor ? "Patient (video link)" : tele.doctorName, sub: isDoctor ? "From village via ASHA device" : tele.specialty ?? "Specialist", self: false }].map(tl => (
          <div key={tl.name} className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl bg-brand-950 text-white">
            <div className="anim-breathe flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 font-display text-xl font-bold">{tl.name.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
            {cam || tl.self ? null : <CameraOff className="absolute h-8 w-8 text-slate-500" />}
            <div className="absolute bottom-2 left-3 flex items-center gap-2 text-xs font-semibold">
              {tl.self ? <Wave on={mic} /> : <Wave on={true} />}
              {tl.name}
            </div>
            <span className="absolute right-3 top-2 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px]">{tl.sub}</span>
            {!tl.self && <span className="absolute left-3 top-2 rounded bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold">LIVE</span>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-sm font-bold text-brand-800"><Timer className="h-4 w-4" /> {mm}:{ss}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setMic(m => !m)} aria-label="Toggle microphone" className={cx("rounded-full border p-3 transition", mic ? "border-brand-200 bg-white text-brand-800" : "border-rose-200 bg-rose-50 text-rose-700")}>{mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
          <button onClick={() => setCam(c => !c)} aria-label="Toggle camera" className={cx("rounded-full border p-3 transition", cam ? "border-brand-200 bg-white text-brand-800" : "border-rose-200 bg-rose-50 text-rose-700")}>{cam ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}</button>
          <Btn variant="danger" onClick={() => void finish()} loading={ending}><PhoneOff className="h-4 w-4" /> End</Btn>
        </div>
      </div>
      {isDoctor && (
        <div className="mt-4 space-y-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Consultation note — becomes part of the longitudinal record</p>
          <Textarea placeholder="Assessment / observations…" value={note.summary} onChange={e => setNote(n => ({ ...n, summary: e.target.value }))} />
          <Input placeholder="Recommendation…" value={note.recommendation} onChange={e => setNote(n => ({ ...n, recommendation: e.target.value }))} />
          <Input placeholder="Follow-up instruction (optional)…" value={note.followUp} onChange={e => setNote(n => ({ ...n, followUp: e.target.value }))} />
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">WebRTC-ready prototype — media simulated in-browser; signaling adapter isolated for eSanjeevani/deployment.</p>
    </Modal>
  );
}

export function TelePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const tlQ = useApi(() => api.listTele(user as never), [user?.id]);
  const [room, setRoom] = useState<Teleconsultation | null>(null);
  const isDoctor = user!.role !== "PATIENT";

  const join = async (tc: Teleconsultation) => {
    if (tc.status === "SCHEDULED" && isDoctor) {
      await api.startTele(user as never, tc.id);
      toast("Consultation started.", "info");
    }
    setRoom({ ...tc, status: "IN_PROGRESS" });
  };

  if (tlQ.loading) return <Spinner label={t("loading")} />;
  const list = tlQ.data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionHead kicker="Specialists without travel" title={t("teleconsultation")} />
      <Banner tone="info">Video consultations connect the village to the district hospital. The specialist's note is written straight into the patient's longitudinal record.</Banner>
      {list.length === 0 && <EmptyState title={t("noData")} hint="No teleconsultations scheduled." />}
      {list.map(tc => (
        <Card key={tc.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={isDoctor ? (tc.patientId ? "Patient" : tc.doctorName) : tc.doctorName} className="bg-brand-800" />
              <div>
                <p className="text-sm font-bold text-brand-950">
                  {isDoctor ? getDB().patients.find(p => p.id === tc.patientId)?.name ?? tc.patientId : tc.doctorName} {tc.specialty ? `· ${tc.specialty}` : ""}
                </p>
                <p className="text-xs text-slate-500">{fmtDT(tc.scheduledAt)} · Room <span className="font-mono font-bold">{tc.roomCode}</span> · {facilityName(tc.facilityId)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={tc.status === "COMPLETED" ? "green" : tc.status === "IN_PROGRESS" ? "amber" : "sky"} pulse={tc.status === "IN_PROGRESS"}>{tc.status.replace("_", " ")}</Pill>
              {tc.status !== "COMPLETED" && <Btn size="sm" onClick={() => void join(tc)}><Video className="h-4 w-4" /> {t("joinConsult")}</Btn>}
            </div>
          </div>
          {tc.status === "COMPLETED" && tc.summary && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
              <b>Note:</b> {tc.summary} {tc.recommendation && <><br /><b>Recommendation:</b> {tc.recommendation}</>} {tc.followUp && <><br /><b>Follow-up:</b> {tc.followUp}</>}
            </div>
          )}
        </Card>
      ))}
      {room && <TeleRoom tele={room} onClose={() => setRoom(null)} />}
    </div>
  );
}

/* ---------------------------------------------------------- notifications */

export function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const nQ = useApi(() => api.listNotifications(user as never), [user?.id]);
  if (nQ.loading) return <Spinner label={t("loading")} />;
  const list = nQ.data ?? [];
  const kindTone = { info: "sky", warning: "amber", critical: "red", success: "green" } as const;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <SectionHead kicker="Alerts & updates" title={t("notifications")} right={<Btn size="sm" variant="secondary" onClick={() => void api.markNotificationsRead(user as never)}><CheckCircle2 className="h-4 w-4" /> Mark all read</Btn>} />
      {list.length === 0 && <EmptyState icon={<Bell className="h-8 w-8" />} title={t("noData")} hint="You're all caught up." />}
      {list.map(n => (
        <div key={n.id} className={cx("flex items-start gap-3 rounded-xl border p-4 shadow-card", n.read ? "border-brand-900/8 bg-white" : "border-brand-200 bg-brand-50/60")}>
          <span className={cx("mt-0.5 rounded-lg p-2", n.kind === "critical" ? "bg-rose-100 text-rose-700" : n.kind === "warning" ? "bg-amber-100 text-amber-700" : n.kind === "success" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700")}>
            {n.kind === "critical" ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cx("text-sm", n.read ? "font-medium text-slate-700" : "font-bold text-brand-950")}>{n.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.body}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{relTime(n.ts)}</p>
          </div>
          <Pill tone={kindTone[n.kind]}>{n.kind}</Pill>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- profile */

export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const selfQ = useSelfPatient();
  const isPatient = user!.role === "PATIENT";
  const perms = PERMS[user!.role];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHead kicker="Account" title={t("profile")} />
      <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
        <Card>
          <div className="flex flex-col items-center text-center">
            <Avatar name={user!.name} className="h-20 w-20 text-2xl" />
            <h2 className="font-display mt-3 text-lg font-extrabold text-brand-950">{user!.name}</h2>
            <Pill tone="brand">{user!.role.replace("_", " ")}</Pill>
            <p className="mt-2 text-xs text-slate-500">{user!.email}</p>
            <p className="text-xs text-slate-500">{user!.phone}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Session & security">
            <KV k="JWT session" v="Active · 12h expiry (demo signing)" />
            <KV k="Password hashing" v="Server-side in production · demo build" />
            <KV k="Role-based access" v={`${perms.length} permissions granted`} />
            <KV k="Facility / village" v={user!.facilityId ? facilityName(user!.facilityId) : user!.village ?? "District office"} />
            <KV k="Audit trail" v="Every action logged with actor + purpose" />
          </Card>
          {isPatient && selfQ.data && (
            <Card title="Patient identity">
              <KV k="RAKSHA ID" v={selfQ.data.rakId} mono />
              <KV k="ABHA (ABDM)" v={selfQ.data.abhaId ?? "Not linked"} />
              <KV k="Consent" v={selfQ.data.consent} />
              <KV k="Assigned ASHA" v={selfQ.data.ashaName} />
            </Card>
          )}
          <Card title="Granted permissions (enforced in service layer)">
            <div className="flex flex-wrap gap-1.5">
              {perms.map(p => <span key={p} className="rounded-md bg-brand-50 px-2 py-1 font-mono text-[11px] font-semibold text-brand-700">{p}</span>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
