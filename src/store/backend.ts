/**
 * RAKSHA service layer — real FastAPI client.
 *
 * Architecture:
 *   React pages → api.* (this module) → FastAPI (VITE_API_BASE_URL) → PostgreSQL
 *
 * Rules of the house:
 *  - ONLINE: every read/write goes to the backend; responses are mirrored into
 *    an in-memory replica so `getDB()` consumers (dashboards, name lookups,
 *    AI summary, FHIR export) keep working unchanged.
 *  - OFFLINE: only operations the backend sync ledger understands
 *    (patient/visit/vital/referral/followup/assessment creates) are applied to
 *    the replica AND queued in IndexedDB as PENDING. Everything else fails
 *    loudly — we never pretend a write reached PostgreSQL while offline.
 *  - Sync: `POST /sync/batch` with client operation ids (idempotent); results
 *    are mapped to SYNCED / FAILED and persisted back to IndexedDB.
 *  - AI triage, FHIR bundle and record summary stay deterministic local
 *    utilities (decision support only — never a diagnosis).
 */
import { rq, ApiError, getToken, setToken, TOKEN_KEY } from "../lib/http";
import { syncOpsAll, syncOpsPut, syncOpsRemove } from "../lib/idb";
import { assessRisk } from "../lib/triage";
import { uid, todayISO, daysUntil } from "../lib/utils";
import type {
  DB, Role, User, Patient, Referral, RefStatus, ReferralEvent, FollowUp, TimelineEvent,
  SyncOp, Priority, Visit, Vitals, Assessment, Consultation, Prescription, DiagnosticRecord,
  Appointment, Teleconsultation, EmergencyEvent, AppNotification, Facility, AuditLog,
  Availability, TriageFactor,
} from "../lib/types";
import type { TriageInput } from "../lib/triage";

export { ApiError };
export const SESSION_KEY = TOKEN_KEY;

/* ------------------------------------------------------------------ replica */

function emptyDB(): DB {
  return {
    version: 0, seededAt: Date.now(),
    users: [], patients: [], visits: [], vitals: [], assessments: [], consultations: [],
    prescriptions: [], diagnostics: [], referrals: [], followups: [], appointments: [],
    teles: [], emergencies: [], notifications: [], facilities: [], audit: [],
    sync: [], syncBaseline: { synced: 0 }, lastSyncAt: null,
  };
}

let cache: DB = emptyDB();
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function emit() { listeners.forEach(fn => fn()); }

/** Get the local replica. FastAPI/PostgreSQL is authoritative; this cache is
 *  a convenience mirror so existing screens keep rendering between fetches. */
export function getDB(): DB { return cache; }

/** Emit after a real mutation so useApi-backed screens refresh. */
function save() { cache.version += 1; emit(); }

function upsert<T extends { id: string }>(arr: T[], item: T): void {
  const i = arr.findIndex(x => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.unshift(item);
}
function mergeMany<T extends { id: string }>(arr: T[], items: T[]): void {
  items.forEach(it => upsert(arr, it));
}

/** Clear the local replica (server data untouched). */
export function resetDB(): void {
  cache = emptyDB();
  save();
}

export function facilityName(id?: string): string {
  if (!id) return "—";
  return cache.facilities.find(f => f.id === id)?.name ?? id;
}
export function patientName(id: string): string {
  return cache.patients.find(p => p.id === id)?.name ?? id;
}

/* ---------------------------------------------------------- connectivity */

let offlineProbe: () => boolean = () => false;
export function setOfflineProbe(fn: () => boolean) { offlineProbe = fn; }

let syncBridge: { persist?: (op: SyncOp) => void; drain?: (ids: string[]) => void } = {};
export function registerSyncBridge(b: typeof syncBridge) { syncBridge = b; }

const OFFLINE_MSG = "This action needs a live connection to the RAKSHA server — retry when online.";
function requireOnline(): void {
  if (offlineProbe()) throw new ApiError(503, OFFLINE_MSG);
}

/** Queue an offline-safe create: replica + IndexedDB (PENDING). */
function queue(entity: string, operation: "create" | "update", payload: Record<string, unknown>, label: string): SyncOp {
  const op: SyncOp = { id: uid("op"), ts: Date.now(), entity, label, status: "PENDING", attempts: 0, operation, payload };
  cache.sync.unshift(op);
  syncBridge.persist?.(op);
  save();
  return op;
}
/** Record an online write in the sync history view (already persisted server-side). */
function recordSynced(entity: string, label: string): void {
  const op: SyncOp = { id: uid("op"), ts: Date.now(), entity, label, status: "SYNCED", attempts: 1 };
  cache.sync.unshift(op);
  cache.lastSyncAt = op.ts;
}

/* ----------------------------------------------------------------- mappers */

const ep = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : Date.now());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function mapUser(u: AnyObj): User {
  return {
    id: u.id, email: u.email, password: "", name: u.name, role: u.role as Role,
    facilityId: u.facility_id ?? undefined, village: u.village ?? undefined,
    phone: u.phone ?? "", specialty: u.specialty ?? undefined,
  };
}

function mapPatient(p: AnyObj): Patient {
  return {
    id: p.id, rakId: p.rak_id, name: p.name, dob: p.date_of_birth ?? "", age: p.age,
    gender: p.gender, phone: p.phone ?? "", village: p.village ?? "", address: p.address ?? "",
    emergencyContact: p.emergency_contact ?? "", emergencyPhone: p.emergency_phone ?? "",
    conditions: p.conditions ?? [], allergies: p.allergies ?? [], pregnant: p.pregnant ?? false,
    bloodGroup: p.blood_group ?? undefined, ashaId: p.asha_id ?? "", ashaName: p.asha_name ?? "",
    phcId: p.phc_id ?? "", consent: p.consent_granted ? "ACTIVE" : "LIMITED", createdAt: ep(p.created_at),
  };
}

function visitType(facilityId?: string): Visit["type"] {
  const f = cache.facilities.find(x => x.id === facilityId);
  if (f?.type === "SUBCENTRE") return "SUBCENTRE";
  if (f?.type === "PHC") return "PHC_VISIT";
  return "HOME_VISIT";
}

function mapVisit(v: AnyObj): Visit {
  return {
    id: v.id, patientId: v.patient_id, workerId: v.worker_id, workerName: v.worker_name ?? "",
    role: (v.worker_role as Role) ?? "ASHA", facilityId: v.facility_id ?? undefined,
    location: v.location ?? "", ts: ep(v.created_at), type: visitType(v.facility_id),
    symptoms: v.symptoms ?? [], complaint: v.complaint ?? "", observations: v.observations ?? "",
    notes: v.notes ?? "",
  };
}

function mapVitals(v: AnyObj): Vitals {
  return {
    id: v.id, patientId: v.patient_id, workerId: v.recorded_by_id, workerName: v.recorded_by_name ?? "",
    facilityId: v.facility_id ?? undefined, ts: ep(v.recorded_at),
    sys: v.systolic ?? undefined, dia: v.diastolic ?? undefined, temp: v.temperature ?? undefined,
    spo2: v.spo2 ?? undefined, hr: v.heart_rate ?? undefined, rr: v.respiratory_rate ?? undefined,
    weight: v.weight_kg ?? undefined, device: v.device ?? undefined,
  };
}

function mapFactor(f: AnyObj): TriageFactor {
  const w = Number(f.weight ?? 0);
  return {
    label: f.label ?? f.code ?? "Factor",
    detail: f.code ?? "FACTOR",
    severity: w >= 50 ? "critical" : w >= 25 ? "high" : w >= 15 ? "warn" : "info",
  };
}

function mapAssessment(a: AnyObj): Assessment {
  const snap = a.input_snapshot ?? {};
  return {
    id: a.id, patientId: a.patient_id, workerId: a.confirmed_by_id ?? "",
    workerName: a.confirmed_by_name ?? "RAKSHA triage", role: "ASHA",
    ts: ep(a.created_at),
    inputs: {
      symptoms: snap.symptoms ?? [], sys: undefined, dia: undefined, temp: snap.temperature ?? undefined,
      spo2: snap.spo2 ?? undefined, hr: snap.heart_rate ?? undefined, age: snap.age ?? 0,
      pregnant: snap.pregnant ?? false, conditions: snap.conditions ?? [],
      severity: snap.severity_reported ?? "MODERATE",
    },
    level: a.level, factors: (a.factors ?? []).map(mapFactor),
    recommendation: a.recommendation, version: a.rule_version,
    confirmed: !!a.confirmed, confirmedBy: a.confirmed_by_name ?? undefined,
    confirmedAt: a.confirmed_at ? ep(a.confirmed_at) : undefined,
  };
}

function mapConsultation(c: AnyObj): Consultation {
  return {
    id: c.id, patientId: c.patient_id, doctorId: c.doctor_id, doctorName: c.doctor_name ?? "",
    specialty: c.specialty ?? undefined, facilityId: c.facility_id ?? "", ts: ep(c.created_at),
    complaint: c.complaint, findings: c.findings ?? "", assessment: c.assessment,
    plan: c.plan ?? "", followUpDate: c.follow_up_date ?? undefined,
    isTele: typeof c.complaint === "string" && c.complaint.startsWith("Teleconsultation"),
  };
}

function prescriptionFrom(c: AnyObj): Prescription | null {
  const meds = (c.meds ?? []) as AnyObj[];
  if (!meds.length) return null;
  return {
    id: `${c.id}-rx`, patientId: c.patient_id, doctorId: c.doctor_id, doctorName: c.doctor_name ?? "",
    facilityId: c.facility_id ?? "", ts: ep(c.created_at),
    meds: meds.map(m => ({ name: m.medicine, dose: m.dose ?? "", duration: m.duration ?? "" })),
  };
}

function mapDiagnostic(d: AnyObj): DiagnosticRecord {
  return {
    id: d.id, patientId: d.patient_id, orderedById: d.ordered_by_id, orderedByName: d.ordered_by_name ?? "",
    facilityId: d.facility_id ?? "", ts: ep(d.created_at), test: d.test,
    result: d.result_text ?? undefined, status: d.status === "COMPLETED" ? "COMPLETED" : "ORDERED",
  };
}

function mapReferralEvent(e: AnyObj): ReferralEvent {
  return {
    id: e.id, ts: ep(e.created_at), actorId: e.actor_id, actorName: e.actor_name ?? "",
    role: e.actor_role as Role, from: (e.from_status as RefStatus | null) ?? null,
    to: e.to_status as RefStatus, facilityId: e.facility_id ?? "", notes: e.notes ?? undefined,
  };
}

function mapReferral(r: AnyObj, events?: AnyObj[]): Referral {
  return {
    id: r.id, code: r.code, patientId: r.patient_id,
    fromFacilityId: r.from_facility_id, toFacilityId: r.to_facility_id,
    createdBy: r.created_by_id, createdByName: r.created_by_name ?? "",
    creatorRole: (r.created_by_role as Role) ?? "PHC_DOCTOR", ts: ep(r.created_at),
    reason: r.reason, priority: r.priority as Priority, clinicalSummary: r.clinical_summary ?? "",
    vitalsSnapshot: r.vitals_snapshot ?? undefined, expectedDate: r.expected_date ?? todayISO(),
    status: r.status as RefStatus, completedAt: r.completed_at ? ep(r.completed_at) : undefined,
    followUpDate: r.follow_up_date ?? undefined,
    events: (events ?? []).map(mapReferralEvent),
  };
}

function mapFollowUp(f: AnyObj): FollowUp {
  return {
    id: f.id, patientId: f.patient_id, referralId: f.referral_id ?? undefined,
    date: f.scheduled_date, assigneeRole: f.assignee_role as Role, assigneeId: undefined,
    notes: f.notes ?? "", status: f.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED",
    completedAt: f.completed_at ? ep(f.completed_at) : undefined, completedBy: undefined,
  };
}

function mapAppointment(a: AnyObj): Appointment {
  return {
    id: a.id, patientId: a.patient_id, facilityId: a.facility_id, date: a.date, time: a.time,
    purpose: a.purpose, status: a.status === "SCHEDULED" ? "CONFIRMED" : a.status,
    queuePos: a.queue_pos ?? undefined,
  };
}

function mapTele(t: AnyObj): Teleconsultation {
  return {
    id: t.id, patientId: t.patient_id, doctorId: t.doctor_id, doctorName: t.doctor_name ?? "",
    specialty: t.specialty ?? undefined, facilityId: t.facility_id ?? "",
    scheduledAt: ep(t.scheduled_at), status: t.status === "CANCELLED" ? "COMPLETED" : t.status,
    roomCode: t.room_code, completedAt: t.status === "COMPLETED" ? ep(t.created_at) : undefined,
    summary: t.assessment ?? undefined, recommendation: t.recommendation ?? undefined,
    followUp: t.follow_up_date ?? undefined,
  };
}

function buildSmsLog(e: AnyObj): string[] {
  const log = [`EMERGENCY|${e.code}|${e.sms_token ?? "••••••"}`,
    `${e.sms_expires_at ? "one-time token generated (10 min expiry)" : ""}`].filter(Boolean);
  if (e.sms_redeemed) log.push(`ACCEPTED by ${e.ack_by ?? "receiver"} — alarm triggered (replay now blocked)`);
  return log;
}

function mapEmergency(e: AnyObj): EmergencyEvent {
  return {
    id: e.id, code: e.code, patientId: e.patient_id, doctorId: e.doctor_id,
    doctorName: e.doctor_name ?? "", facilityId: e.facility_id ?? "", ts: ep(e.created_at),
    severity: "CRITICAL", clinicalNote: e.clinical_note, status: e.status,
    smsToken: e.sms_token ?? "", smsExpiresAt: ep(e.sms_expires_at), smsRedeemed: !!e.sms_redeemed,
    smsLog: buildSmsLog(e), ackBy: e.ack_by ?? undefined, ackAt: e.ack_at ? ep(e.ack_at) : undefined,
  };
}

function mapNotification(n: AnyObj): AppNotification {
  return {
    id: n.id, ts: ep(n.created_at), targetRole: "ALL", targetUserId: n.user_id ?? undefined,
    title: n.title, body: n.body, kind: n.kind, read: !!n.read, link: n.link ?? undefined,
  };
}

const FAC_TYPE: Record<string, Facility["type"]> = {
  SUB_CENTER: "SUBCENTRE", PHC: "PHC", CHC: "CHC", RURAL_HOSPITAL: "CHC",
  DISTRICT_HOSPITAL: "DH", SPECIALIST_CENTER: "DH",
};

function facilityDistanceKm(lat?: number, lng?: number): number {
  const me = cache.facilities.find(f => f.id === sessionUserFacilityId()) ?? cache.facilities[0];
  if (!lat || !lng || !me) return 0;
  const R = 6371, dLat = ((me.mapLat ?? lat) - lat) * Math.PI / 180;
  const dLng = ((me.mapLng ?? lng) - lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos((me.mapLat ?? lat) * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
/* mapLat/mapLng are optional coordinates carried alongside the UI projection. */
let _sessionFacilityId: string | undefined;
function sessionUserFacilityId() { return _sessionFacilityId; }

function mapFacility(f: AnyObj, res: AnyObj | null): Facility {
  const lat: number | undefined = f.latitude ?? undefined;
  const lng: number | undefined = f.longitude ?? undefined;
  const avail = (v: string | undefined): Availability =>
    v === "AVAILABLE" || v === "LIMITED" || v === "UNAVAILABLE" ? v as Availability : "UNAVAILABLE";
  return {
    id: f.id, name: f.name, type: FAC_TYPE[f.facility_type] ?? "PHC",
    village: f.village ?? "", distanceKm: facilityDistanceKm(lat, lng), phone: f.phone ?? "",
    totalBeds: res?.total_beds ?? 0, availableBeds: res?.available_beds ?? 0,
    icuBeds: res?.icu_beds ?? 0, icuAvailable: res?.icu_beds ?? 0,
    emergency: !!res?.emergency_available,
    oxygen: res?.oxygen_available ? "AVAILABLE" : "UNAVAILABLE",
    criticalCare: (res?.icu_beds ?? 0) > 0 ? "AVAILABLE" : "UNAVAILABLE",
    diagnostics: [
      { name: "CBC", status: avail(res?.cbc) },
      { name: "X-Ray", status: avail(res?.xray) },
      { name: "Ultrasound", status: avail(res?.ultrasound) },
    ],
    medicines: ((res?.medicines ?? []) as AnyObj[]).map(m => ({ name: m.name, status: avail(m.status) })),
    specialists: ((res?.specialists ?? []) as AnyObj[]).map(s => ({
      specialty: s.specialty, name: s.days || "—", available: !!s.available,
    })),
    workload: res?.workload_level ?? "MODERATE",
    mapX: lng != null ? Math.min(100, Math.max(0, ((lng - 73.8) / 1.2) * 100)) : 50,
    mapY: lat != null ? Math.min(100, Math.max(0, 100 - ((lat - 18.2) / 0.4) * 100)) : 50,
    ...(lat != null ? { mapLat: lat } : {}),
    ...(lng != null ? { mapLng: lng } : {}),
  } as Facility & { mapLat?: number; mapLng?: number } as Facility;
}

function mapAudit(a: AnyObj): AuditLog {
  const detail = a.detail ?? {};
  const bits = Object.entries(detail)
    .filter(([k]) => k !== "purpose")
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  return {
    id: a.id, ts: ep(a.created_at), actorId: a.actor_id ?? "system", actorName: a.actor_name,
    role: a.actor_role as Role | "SYSTEM", action: a.action, resource: a.resource_kind,
    patientId: a.patient_id ?? undefined, purpose: detail.purpose, details: bits.join(" · ") || undefined,
  };
}

/* -------------------------------------------------------------------- RBAC */

export const PERMS: Record<Role, string[]> = {
  PATIENT: ["appointment.book", "tele.join", "self.read"],
  ASHA: ["patient.create", "patient.search", "patient.record", "visit.create", "vitals.create", "triage.run", "triage.confirm", "referral.create", "referral.arrived", "followup.create", "followup.complete", "sync.use"],
  ANM: ["patient.create", "patient.search", "patient.record", "visit.create", "vitals.create", "triage.run", "triage.confirm", "referral.create", "referral.arrived", "followup.create", "followup.complete", "sync.use"],
  PHC_STAFF: ["patient.create", "patient.search", "patient.record", "visit.create", "vitals.create", "triage.run", "triage.confirm", "referral.create", "appointment.manage", "sync.use"],
  PHC_DOCTOR: ["patient.search", "patient.record", "consult.create", "prescription.create", "diagnostic.order", "referral.create", "referral.advance", "followup.create", "emergency.create", "tele.conduct"],
  CHC_DOCTOR: ["patient.search", "patient.record", "consult.create", "prescription.create", "diagnostic.order", "referral.create", "referral.advance", "followup.create", "emergency.create", "tele.conduct"],
  SPECIALIST: ["patient.search", "patient.record", "consult.create", "prescription.create", "diagnostic.order", "referral.create", "referral.advance", "followup.create", "emergency.create", "tele.conduct"],
  DISTRICT_ADMIN: ["admin.read", "patient.search", "patient.record", "audit.read"],
};

function requireUser(tokenUser: User | null): User {
  if (!tokenUser) throw new ApiError(401, "Authentication required.");
  return tokenUser;
}
function requirePerm(user: User, perm: string) {
  if (!PERMS[user.role].includes(perm))
    throw new ApiError(403, `Role ${user.role} does not have permission "${perm}".`);
}

/* ------------------------------------------------------- referral machine */

export const REF_FLOW: RefStatus[] = ["CREATED", "SENT", "ACKNOWLEDGED", "ACCEPTED", "ARRIVED", "IN_CONSULTATION", "TREATMENT", "COMPLETED"];

const NEXT: Record<RefStatus, RefStatus[]> = {
  CREATED: ["SENT", "CANCELLED"],
  SENT: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_CONSULTATION"],
  IN_CONSULTATION: ["TREATMENT"],
  TREATMENT: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStatuses(status: RefStatus): RefStatus[] { return NEXT[status] ?? []; }

export function isOverdue(r: Referral): boolean {
  if (["ARRIVED", "IN_CONSULTATION", "TREATMENT", "COMPLETED", "CANCELLED"].includes(r.status)) return false;
  return daysUntil(r.expectedDate) < 0;
}

export function followUpState(f: FollowUp): "COMPLETED" | "DUE_TODAY" | "OVERDUE" | "UPCOMING" {
  if (f.status === "COMPLETED") return "COMPLETED";
  const d = daysUntil(f.date);
  if (d < 0) return "OVERDUE";
  if (d === 0) return "DUE_TODAY";
  return "UPCOMING";
}

/* ---------------------------------------------------------------- warm-up */

/** Populate the replica after sign-in (facilities + role-scoped patients +
 *  latest assessments + sync baseline). Failures are non-fatal: the offline
 *  banner and empty states handle a downed server. */
async function warmCacheFor(user: User): Promise<void> {
  try {
    const facs = await rq<AnyObj[]>("GET", "/facilities");
    cache.facilities = await Promise.all(facs.map(async f => {
      let res: AnyObj | null = null;
      try { res = await rq<AnyObj>("GET", `/facilities/${f.id}/resources`); } catch { res = null; }
      return mapFacility(f, res);
    }));
    const page = await rq<AnyObj>("GET", user.role === "PATIENT" ? "/patients?limit=10" : "/patients?q=&limit=200");
    mergeMany(cache.patients, (page.items ?? []).map(mapPatient));
    if (user.role !== "PATIENT") {
      const asess = await rq<AnyObj[]>("GET", "/triage/assessments/latest").catch(() => [] as AnyObj[]);
      mergeMany(cache.assessments, asess.map(mapAssessment));
    }
    const sync = await rq<AnyObj>("GET", "/sync/status").catch(() => null);
    if (sync) {
      cache.syncBaseline.synced = sync.applied ?? 0;
      cache.lastSyncAt = sync.last_sync_at ? ep(sync.last_sync_at) : cache.lastSyncAt;
    }
    save();
  } catch {
    /* offline or server down — replica stays as-is */
  }
}

/* ------------------------------------------- shared internals (no `this`) */

async function fetchPatientAccess(u: User, id: string, purpose: string) {
  const p = mapPatient(await rq<AnyObj>("GET", `/patients/${id}`, { headers: { "X-Access-Purpose": purpose } }));
  upsert(cache.patients, p);
  const restricted = p.consent === "LIMITED";
  return {
    patient: p, restricted, consent: p.consent,
    accessedBy: { name: u.name, role: u.role, purpose, at: Date.now() },
  };
}

async function listReferralsFor(u: User, opts?: { patientId?: string }): Promise<Referral[]> {
  if (offlineProbe()) {
    let list = cache.referrals;
    if (opts?.patientId) list = list.filter(r => r.patientId === opts.patientId);
    return [...list].sort((a, b) => b.ts - a.ts);
  }
  const page = await rq<{ items?: AnyObj[] }>("GET", "/referrals?limit=200");
  const list: Referral[] = (page.items ?? []).map((r: AnyObj) => mapReferral(r));
  mergeMany(cache.referrals, list);
  const filtered = opts?.patientId ? list.filter((r: Referral) => r.patientId === opts.patientId) : list;
  void u;
  return [...filtered].sort((a: Referral, b: Referral) => b.ts - a.ts);
}

async function loadFacilities(): Promise<Facility[]> {
  const facs = await rq<AnyObj[]>("GET", "/facilities");
  const mapped = await Promise.all(facs.map(async f => {
    let res: AnyObj | null = null;
    try { res = await rq<AnyObj>("GET", `/facilities/${f.id}/resources`); } catch { res = null; }
    return mapFacility(f, res);
  }));
  cache.facilities = mapped;
  save();
  return mapped;
}

async function buildSyncState() {
  const idbOps = await syncOpsAll().catch(() => [] as SyncOp[]);
  // Merge queued ops the replica doesn't know about (e.g. fresh page load).
  idbOps.forEach(o => { if (o.status !== "SYNCED" && !cache.sync.some(x => x.id === o.id)) cache.sync.unshift(o); });
  return {
    ops: [...cache.sync].sort((a, b) => b.ts - a.ts),
    pending: cache.sync.filter(o => o.status === "PENDING").length,
    failed: cache.sync.filter(o => o.status === "FAILED").length,
    synced: cache.syncBaseline.synced + cache.sync.filter(o => o.status === "SYNCED").length,
    lastSyncAt: cache.lastSyncAt,
  };
}

/* -------------------------------------------------------------------- API */

export const api = {
  /* ---- health (GET /health) */
  async health() {
    return rq<{ status: string; database: string; version: string }>("GET", "/health");
  },

  /* ---- auth */
  async login(email: string, password: string) {
    const res = await rq<{ access_token: string; token_type: string; user: AnyObj }>(
      "POST", "/auth/login", { body: { email: email.trim().toLowerCase(), password } });
    setToken(res.access_token);
    const user = mapUser(res.user);
    _sessionFacilityId = user.facilityId;
    void warmCacheFor(user);
    return { token: res.access_token, user };
  },

  /** Restore the session via GET /auth/me (real JWT validation server-side). */
  async sessionUser(): Promise<User | null> {
    if (!getToken()) return null;
    try {
      const me = await rq<AnyObj>("GET", "/auth/me");
      const user = mapUser(me);
      _sessionFacilityId = user.facilityId;
      void warmCacheFor(user);
      return user;
    } catch {
      setToken(null);
      return null;
    }
  },

  logout(user: User) {
    void user;
    setToken(null);
    _sessionFacilityId = undefined;
  },

  /* ---- patients */
  async searchPatients(user: User | null, q: string) {
    const u = requireUser(user);
    if (offlineProbe()) {
      const term = q.trim().toLowerCase();
      return cache.patients.filter(p => !term ||
        p.name.toLowerCase().includes(term) || p.rakId.toLowerCase().includes(term) ||
        p.phone.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "§") || p.village.toLowerCase().includes(term));
    }
    const page = await rq<{ items?: AnyObj[] }>("GET", `/patients?q=${encodeURIComponent(q)}&limit=100`);
    const list: Patient[] = (page.items ?? []).map(mapPatient);
    mergeMany(cache.patients, list);
    void u;
    return list;
  },

  async getPatient(user: User | null, id: string, purpose = "Care delivery") {
    return fetchPatientAccess(requireUser(user), id, purpose);
  },

  async registerPatient(user: User | null, data: Omit<Patient, "id" | "rakId" | "createdAt" | "ashaId" | "ashaName" | "phcId" | "consent">) {
    const u = requireUser(user);
    const payload: AnyObj = {
      name: data.name, date_of_birth: data.dob || null, age: data.age, gender: data.gender,
      phone: data.phone || null, village: data.village || null, address: data.address || null,
      emergency_contact: data.emergencyContact || null, emergency_phone: data.emergencyPhone || null,
      blood_group: data.bloodGroup || null, conditions: data.conditions, allergies: data.allergies,
      pregnant: !!data.pregnant, consent_granted: true,
    };
    if (offlineProbe()) {
      const localId = uid("p");
      const p: Patient = {
        ...data, id: localId, rakId: "RAK-PAT-2026-·····", ashaId: u.id, ashaName: u.name,
        phcId: u.facilityId ?? "", consent: "ACTIVE", createdAt: Date.now(),
      };
      upsert(cache.patients, p);
      queue("patient", "create", { ...payload, id: localId }, `Register patient — ${p.name}`);
      return p;
    }
    const p = mapPatient(await rq<AnyObj>("POST", "/patients", { body: payload }));
    upsert(cache.patients, p);
    recordSynced("patient", `Register patient — ${p.name}`);
    save();
    return p;
  },

  /* ---- records */
  async createVisit(user: User | null, data: { patientId: string; type: Visit["type"]; symptoms: string[]; complaint: string; observations: string; notes: string; location: string }) {
    const u = requireUser(user);
    if (offlineProbe()) {
      const v: Visit = {
        id: uid("v"), workerId: u.id, workerName: u.name, role: u.role, facilityId: u.facilityId,
        ts: Date.now(), type: data.type, patientId: data.patientId, symptoms: data.symptoms,
        complaint: data.complaint, observations: data.observations, notes: data.notes, location: data.location,
      };
      upsert(cache.visits, v);
      queue("visit", "create", {
        id: v.id, patient_id: data.patientId, worker_id: u.id, symptoms: data.symptoms,
        complaint: data.complaint, observations: data.observations, notes: data.notes,
        location: data.location, source: "FIELD",
      }, `Visit — ${patientName(data.patientId)}`);
      return v;
    }
    const v = mapVisit(await rq<AnyObj>("POST", `/patients/${data.patientId}/visits`, {
      body: { symptoms: data.symptoms, complaint: data.complaint, observations: data.observations, notes: data.notes, location: data.location },
    }));
    upsert(cache.visits, v);
    recordSynced("visit", `Visit — ${patientName(data.patientId)}`);
    save();
    return v;
  },

  async createVitals(user: User | null, data: { patientId: string; sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; rr?: number; weight?: number; device?: string }) {
    const u = requireUser(user);
    if (offlineProbe()) {
      const v: Vitals = {
        id: uid("vt"), workerId: u.id, workerName: u.name, facilityId: u.facilityId, ts: Date.now(),
        patientId: data.patientId, sys: data.sys, dia: data.dia, temp: data.temp, spo2: data.spo2,
        hr: data.hr, rr: data.rr, weight: data.weight, device: data.device,
      };
      upsert(cache.vitals, v);
      queue("vital", "create", {
        id: v.id, patient_id: data.patientId, recorded_by_id: u.id,
        systolic: data.sys, diastolic: data.dia, temperature: data.temp, spo2: data.spo2,
        heart_rate: data.hr, respiratory_rate: data.rr, weight_kg: data.weight, device: data.device,
      }, `Vitals — ${patientName(data.patientId)}`);
      return v;
    }
    const v = mapVitals(await rq<AnyObj>("POST", `/patients/${data.patientId}/vitals`, {
      body: {
        systolic: data.sys, diastolic: data.dia, temperature: data.temp, spo2: data.spo2,
        heart_rate: data.hr, respiratory_rate: data.rr, weight_kg: data.weight, device: data.device,
      },
    }));
    upsert(cache.vitals, v);
    recordSynced("vitals", `Vitals — ${patientName(data.patientId)}`);
    save();
    return v;
  },

  /* ---- triage (POST /triage/assess — decision support, not a diagnosis) */
  async assessTriage(user: User | null, patientId: string, input: TriageInput) {
    const u = requireUser(user);
    const has = (...keys: string[]) => input.symptoms.some(s => keys.some(k => s.toLowerCase().includes(k)));
    if (offlineProbe()) {
      // Same deterministic rules run locally; queued for the server as an assessment event.
      const result = assessRisk(input);
      const weights: Record<TriageFactor["severity"], number> = { critical: 50, high: 25, warn: 15, info: 5 };
      const factors = result.factors.map(f => ({ code: f.detail || "FACTOR", label: f.label, weight: weights[f.severity] }));
      const a: Assessment = {
        id: uid("as"), patientId, workerId: u.id, workerName: u.name, role: u.role, ts: Date.now(),
        inputs: { ...input }, level: result.level, factors: result.factors,
        recommendation: result.recommendation, version: result.version, confirmed: false,
      };
      upsert(cache.assessments, a);
      queue("assessment", "create", {
        id: a.id, patient_id: patientId, level: result.level,
        score: factors.reduce((s, f) => s + f.weight, 0), factors,
        red_flags: result.factors.filter(f => f.severity === "critical" || f.severity === "high").map(f => f.label),
        recommendation: result.recommendation, rule_version: result.version,
        input_snapshot: {
          age: input.age, spo2: input.spo2, temperature: input.temp, heart_rate: input.hr,
          respiratory_rate: input.rr, cough: has("cough"), breathing_difficulty: has("breath"),
          chest_pain: has("chest"), pregnant: !!input.pregnant, conditions: input.conditions,
          severity_reported: input.severity, symptoms: input.symptoms,
        },
        confirmed: false,
      }, `Triage (${result.level}) — ${patientName(patientId)}`);
      return a;
    }
    const res = await rq<AnyObj>("POST", "/triage/assess", {
      body: {
        patient_id: patientId, age: input.age, spo2: input.spo2, respiratory_rate: input.rr,
        temperature: input.temp, heart_rate: input.hr, cough: has("cough"),
        breathing_difficulty: has("breath"), chest_pain: has("chest"),
        pregnant: !!input.pregnant, conditions: input.conditions,
        severity_reported: input.severity, symptoms: input.symptoms,
      },
    });
    const a: Assessment = {
      id: res.assessment_id ?? uid("as"), patientId, workerId: u.id, workerName: u.name, role: u.role,
      ts: Date.now(), inputs: { ...input }, level: res.risk_level,
      factors: (res.contributing_factors ?? []).map(mapFactor),
      recommendation: res.recommended_action, version: res.rule_version, confirmed: false,
    };
    upsert(cache.assessments, a);
    recordSynced("triage", `Triage (${a.level}) — ${patientName(patientId)}`);
    save();
    return a;
  },

  async confirmAssessment(user: User | null, assessmentId: string) {
    const u = requireUser(user);
    requireOnline();
    await rq("POST", `/triage/assessments/${assessmentId}/confirm`);
    const a = cache.assessments.find(x => x.id === assessmentId);
    if (a) { a.confirmed = true; a.confirmedBy = u.name; a.confirmedAt = Date.now(); }
    save();
    return a;
  },

  /* ---- referrals */
  async listReferrals(user: User | null, opts?: { patientId?: string }) {
    return listReferralsFor(requireUser(user), opts);
  },

  async getReferral(user: User | null, id: string) {
    requireUser(user);
    const detail = await rq<AnyObj>("GET", `/referrals/${id}`);
    const r = mapReferral(detail, detail.events ?? []);
    upsert(cache.referrals, r);
    return r;
  },

  async createReferral(user: User | null, data: { patientId: string; fromFacilityId: string; toFacilityId: string; reason: string; priority: Priority; clinicalSummary: string; vitalsSnapshot?: string; expectedDate: string; followUpDate?: string }) {
    const u = requireUser(user);
    requirePerm(u, "referral.create");
    const payload: AnyObj = {
      patient_id: data.patientId, from_facility_id: data.fromFacilityId, to_facility_id: data.toFacilityId,
      reason: data.reason, priority: data.priority, clinical_summary: data.clinicalSummary,
      vitals_snapshot: data.vitalsSnapshot, expected_date: data.expectedDate,
    };
    if (offlineProbe()) {
      const now = Date.now();
      const localId = uid("ref");
      const r: Referral = {
        id: localId, code: "REF-PENDING-SYNC", patientId: data.patientId,
        fromFacilityId: data.fromFacilityId, toFacilityId: data.toFacilityId,
        createdBy: u.id, createdByName: u.name, creatorRole: u.role, ts: now,
        reason: data.reason, priority: data.priority, clinicalSummary: data.clinicalSummary,
        vitalsSnapshot: data.vitalsSnapshot, expectedDate: data.expectedDate, status: "SENT",
        events: [
          { id: uid("rev"), ts: now, actorId: u.id, actorName: u.name, role: u.role, from: null, to: "CREATED", facilityId: data.fromFacilityId },
          { id: uid("rev"), ts: now + 1, actorId: u.id, actorName: u.name, role: u.role, from: "CREATED", to: "SENT", facilityId: data.fromFacilityId, notes: "Queued offline — dispatches on sync" },
        ],
      };
      upsert(cache.referrals, r);
      queue("referral", "create", { ...payload, id: localId, created_by_id: u.id }, `Referral — ${patientName(data.patientId)}`);
      if (data.followUpDate) {
        const f: FollowUp = { id: uid("fu"), patientId: data.patientId, referralId: localId, date: data.followUpDate, assigneeRole: "ASHA", notes: `Post-referral follow-up (${facilityName(data.toFacilityId)})`, status: "SCHEDULED" };
        upsert(cache.followups, f);
        queue("followup", "create", { id: f.id, patient_id: data.patientId, referral_id: localId, scheduled_date: data.followUpDate, notes: f.notes, assignee_role: "ASHA" }, `Follow-up — ${patientName(data.patientId)}`);
      }
      return r;
    }
    const created = await rq<AnyObj>("POST", "/referrals", { body: payload });
    if (data.followUpDate) {
      await rq("POST", `/referrals/${created.id}/followup`, {
        body: { scheduled_date: data.followUpDate, notes: `Post-referral follow-up (${facilityName(data.toFacilityId)})`, assignee_role: "ASHA" },
      });
    }
    const detail = await rq<AnyObj>("GET", `/referrals/${created.id}`);
    const r = mapReferral(detail, detail.events ?? []);
    upsert(cache.referrals, r);
    recordSynced("referral", `Referral — ${patientName(data.patientId)}`);
    save();
    return r;
  },

  async advanceReferral(user: User | null, id: string, to: RefStatus, notes?: string) {
    requireUser(user);
    requireOnline();
    const detail = await rq<AnyObj>("POST", `/referrals/${id}/transition`, { body: { target: to, notes } });
    const r = mapReferral(detail, detail.events ?? []);
    upsert(cache.referrals, r);
    recordSynced("referral.status", `${r.code} → ${to}`);
    save();
    return r;
  },

  /* ---- follow-ups */
  async scheduleFollowUp(user: User | null, data: { patientId: string; referralId?: string; date: string; notes: string; assigneeRole: Role }) {
    const u = requireUser(user);
    if (offlineProbe()) {
      const f: FollowUp = { id: uid("fu"), ...data, status: "SCHEDULED" };
      upsert(cache.followups, f);
      queue("followup", "create", {
        id: f.id, patient_id: data.patientId, referral_id: data.referralId,
        scheduled_date: data.date, notes: data.notes, assignee_role: data.assigneeRole,
      }, `Follow-up — ${patientName(data.patientId)}`);
      return f;
    }
    const body = { scheduled_date: data.date, notes: data.notes, assignee_role: data.assigneeRole };
    const raw = data.referralId
      ? await rq<AnyObj>("POST", `/referrals/${data.referralId}/followup`, { body })
      : await rq<AnyObj>("POST", `/patients/${data.patientId}/followups`, { body: { ...body, referral_id: data.referralId } });
    const f = mapFollowUp(raw);
    upsert(cache.followups, f);
    recordSynced("followup", `Follow-up — ${patientName(data.patientId)}`);
    save();
    return f;
  },

  async listFollowUps(user: User | null) {
    requireUser(user);
    if (offlineProbe()) return [...cache.followups].sort((a, b) => a.date.localeCompare(b.date));
    const rows = await rq<AnyObj[]>("GET", "/followups/all");
    const list = rows.map(mapFollowUp);
    mergeMany(cache.followups, list);
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  },

  async completeFollowUp(user: User | null, id: string, notes?: string) {
    requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("PATCH", `/followups/${id}/complete`);
    const f = mapFollowUp(raw);
    if (notes) f.notes = `${f.notes} · ${notes}`;
    upsert(cache.followups, f);
    save();
    return f;
  },

  /* ---- consultations */
  async createConsultation(user: User | null, data: { patientId: string; complaint: string; findings: string; assessment: string; plan: string; followUpDate?: string; meds?: { name: string; dose: string; duration: string }[]; investigation?: string }) {
    const u = requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("POST", `/patients/${data.patientId}/consultations`, {
      body: {
        complaint: data.complaint, findings: data.findings, assessment: data.assessment, plan: data.plan,
        investigation: data.investigation, follow_up_date: data.followUpDate || null,
        meds: (data.meds ?? []).map(m => ({ medicine: m.name, dose: m.dose, duration: m.duration })),
      },
    });
    const c = mapConsultation(raw);
    upsert(cache.consultations, c);
    const rx = prescriptionFrom(raw);
    if (rx) upsert(cache.prescriptions, rx);
    if (data.investigation) {
      upsert(cache.diagnostics, {
        id: uid("dg"), patientId: data.patientId, orderedById: u.id, orderedByName: u.name,
        facilityId: c.facilityId, ts: Date.now(), test: data.investigation, status: "ORDERED",
      });
    }
    recordSynced("consultation", `Consultation — ${patientName(data.patientId)}`);
    save();
    return { consultation: c, prescription: rx };
  },

  /* ---- emergency (POST /emergency-events) */
  async createEmergency(user: User | null, patientId: string, clinicalNote: string) {
    requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("POST", "/emergency-events", { body: { patient_id: patientId, clinical_note: clinicalNote } });
    const e = mapEmergency(raw);
    upsert(cache.emergencies, e);
    save();
    return e;
  },

  async listEmergencies(user: User | null) {
    requireUser(user);
    const rows = await rq<AnyObj[]>("GET", "/emergency-events");
    const list = rows.map(mapEmergency);
    mergeMany(cache.emergencies, list);
    return [...list].sort((a, b) => b.ts - a.ts);
  },

  async redeemSmsCommand(user: User | null, eventId: string, token: string) {
    requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("POST", `/emergency-events/${eventId}/redeem`, { body: { token } });
    const e = mapEmergency(raw);
    upsert(cache.emergencies, e);
    save();
    return e;
  },

  async resolveEmergency(user: User | null, eventId: string) {
    requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("PATCH", `/emergency-events/${eventId}/status`, { body: { status: "RESOLVED" } });
    const e = mapEmergency(raw);
    upsert(cache.emergencies, e);
    save();
    return e;
  },

  /* ---- appointments */
  async listAppointments(user: User | null) {
    requireUser(user);
    const rows = await rq<AnyObj[]>("GET", "/appointments");
    const list = rows.map(mapAppointment);
    mergeMany(cache.appointments, list);
    return [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  },

  async bookAppointment(user: User | null, data: { facilityId: string; date: string; time: string; purpose: string }) {
    const u = requireUser(user);
    requirePerm(u, "appointment.book");
    requireOnline();
    const page = await rq<AnyObj>("GET", "/patients?limit=10");
    const me = (page.items ?? []).map(mapPatient)[0];
    if (!me) throw new ApiError(404, "Patient profile not found for this login.");
    const raw = await rq<AnyObj>("POST", "/appointments", {
      body: { patient_id: me.id, facility_id: data.facilityId, date: data.date, time: data.time, purpose: data.purpose, appointment_type: "OPD" },
    });
    const a = mapAppointment(raw);
    a.status = "REQUESTED";
    upsert(cache.appointments, a);
    save();
    return a;
  },

  /* ---- teleconsultation (session metadata only — no video provider wired) */
  async listTele(user: User | null) {
    requireUser(user);
    const rows = await rq<AnyObj[]>("GET", "/teleconsultations");
    const list = rows.map(mapTele);
    mergeMany(cache.teles, list);
    return [...list].sort((a, b) => b.scheduledAt - a.scheduledAt);
  },

  /** Local prototype step: the backend has no in-call status, so "joining"
   *  only flips the replica until the outcome is recorded. */
  async startTele(user: User | null, id: string) {
    requireUser(user);
    const t = cache.teles.find(x => x.id === id);
    if (!t) throw new ApiError(404, "Teleconsultation not found.");
    t.status = "IN_PROGRESS"; t.startedAt = Date.now();
    save();
    return t;
  },

  async completeTele(user: User | null, id: string, data: { summary: string; recommendation: string; followUp?: string }) {
    const u = requireUser(user);
    requireOnline();
    const raw = await rq<AnyObj>("PATCH", `/teleconsultations/${id}/complete`, {
      body: { assessment: data.summary, recommendation: data.recommendation, follow_up_date: data.followUp || null },
    });
    const t = mapTele(raw);
    t.completedAt = Date.now();
    upsert(cache.teles, t);
    upsert(cache.consultations, {
      id: uid("c"), patientId: t.patientId, doctorId: u.id, doctorName: u.name, specialty: u.specialty,
      facilityId: t.facilityId, ts: Date.now(), complaint: `Teleconsultation ${t.roomCode}`,
      findings: data.summary, assessment: data.recommendation, plan: data.followUp ?? "As advised", isTele: true,
    });
    if (data.followUp) {
      await rq("POST", `/patients/${t.patientId}/followups`, {
        body: { scheduled_date: todayISO(7), notes: `Post-teleconsult (${u.name}): ${data.followUp}`, assignee_role: "ASHA" },
      }).catch(() => undefined);
    }
    save();
    return t;
  },

  /* ---- facilities */
  async listFacilities(user: User | null) {
    requireUser(user);
    return loadFacilities();
  },

  async recommendFacilities(user: User | null, opts: { fromFacilityId: string; needsEmergency?: boolean; needsOxygen?: boolean; specialty?: string }) {
    requireUser(user);
    const needs: string[] = [];
    if (opts.needsEmergency) needs.push("emergency");
    if (opts.needsOxygen) needs.push("oxygen");
    if (opts.specialty) needs.push(`specialty:${opts.specialty}`);
    const recs = await rq<AnyObj[]>("POST", "/facilities/recommend", {
      body: { from_facility_id: opts.fromFacilityId, priority: "PRIORITY", needs },
    });
    return Promise.all(recs.map(async rec => {
      let facility = cache.facilities.find(f => f.id === rec.facility?.id);
      if (!facility) {
        let res: AnyObj | null = null;
        try { res = await rq<AnyObj>("GET", `/facilities/${rec.facility.id}/resources`); } catch { res = null; }
        facility = mapFacility(rec.facility, res);
        upsert(cache.facilities, facility);
      }
      return { facility, score: rec.score as number, reasons: rec.reasons as string[] };
    }));
  },

  /* ---- notifications */
  async listNotifications(user: User | null) {
    requireUser(user);
    const rows = await rq<AnyObj[]>("GET", "/notifications");
    const list = rows.map(mapNotification);
    cache.notifications = list;
    return list;
  },

  async markNotificationsRead(user: User | null) {
    requireUser(user);
    await rq("POST", "/notifications/read-all");
    cache.notifications.forEach(n => { n.read = true; });
    save();
  },

  /* ---- timeline (GET /patients/{id}/timeline + records hydration) */
  async getTimeline(user: User | null, patientId: string) {
    const u = requireUser(user);
    const access = await fetchPatientAccess(u, patientId, "Longitudinal record review");
    if (access.restricted) return { events: [] as TimelineEvent[], restricted: true, consent: access.consent };

    const [rawEvents, records, refs] = await Promise.all([
      rq<AnyObj[]>("GET", `/patients/${patientId}/timeline`),
      rq<AnyObj>("GET", `/patients/${patientId}/records`).catch(() => null),
      listReferralsFor(u, { patientId }).catch(() => [] as Referral[]),
    ]);

    if (records) {
      mergeMany(cache.visits, (records.visits ?? []).map(mapVisit));
      mergeMany(cache.vitals, (records.vitals ?? []).map(mapVitals));
      (records.consultations ?? []).forEach((c: AnyObj) => {
        upsert(cache.consultations, mapConsultation(c));
        const rx = prescriptionFrom(c);
        if (rx) upsert(cache.prescriptions, rx);
      });
      mergeMany(cache.diagnostics, (records.diagnostics ?? []).map(mapDiagnostic));
      mergeMany(cache.followups, (records.followups ?? []).map(mapFollowUp));
    }

    const byId = <T extends { id: string }>(arr: T[], id: string) => arr.find(x => x.id === id);
    const events: TimelineEvent[] = rawEvents.map(e => {
      const kind = e.kind === "teleconsultation" ? "teleconsult" : e.kind;
      let data: Record<string, unknown> = {};
      if (e.kind === "visit") data = { ...(byId(cache.visits, e.id) ?? {}) };
      else if (e.kind === "vitals") data = { ...(byId(cache.vitals, e.id) ?? {}) };
      else if (e.kind === "assessment") {
        const a = byId(cache.assessments, e.id);
        const level = a?.level ?? /—\s*([A-Z]+)$/.exec(e.title)?.[1];
        data = a ? { ...a } : { level, workerName: "RAKSHA triage" };
      }
      else if (e.kind === "consultation") data = { ...(byId(cache.consultations, e.id) ?? {}) };
      else if (e.kind === "diagnostic") data = { ...(byId(cache.diagnostics, e.id) ?? {}) };
      else if (e.kind === "referral") data = { ...(byId(refs, e.id) ?? byId(cache.referrals, e.id) ?? {}) };
      else if (e.kind === "followup") data = { ...(byId(cache.followups, e.id) ?? {}) };
      else if (e.kind === "teleconsultation") data = { ...(byId(cache.teles, e.id) ?? {}) };
      else if (e.kind === "emergency") data = { ...(byId(cache.emergencies, e.id) ?? {}) };
      return { kind, ts: ep(e.ts), id: e.id, title: e.title, subtitle: e.subtitle ?? "", facilityId: undefined, data };
    });
    events.sort((a, b) => b.ts - a.ts);
    return { events, restricted: false, consent: access.consent };
  },

  /* ---- admin */
  async adminAnalytics(user: User | null) {
    const u = requireUser(user);
    requirePerm(u, "admin.read");
    const [an, bn, refsRaw] = await Promise.all([
      rq<AnyObj>("GET", "/admin/analytics"),
      rq<AnyObj[]>("GET", "/admin/bottlenecks"),
      rq<AnyObj>("GET", "/referrals?limit=500"),
    ]);
    const refs = (refsRaw.items ?? []) as AnyObj[];
    if (!cache.facilities.length) await loadFacilities().catch(() => undefined);

    const short = (n: string) => n.replace("District Hospital", "DH").replace("Primary Health Centre", "PHC")
      .replace("Community Health Centre", "CHC").replace("Rural Hospital", "RH");
    const activeOf = (fid: string) => refs.filter(r => r.to_facility_id === fid && r.status !== "COMPLETED" && r.status !== "CANCELLED");
    const shortages = cache.facilities.flatMap(f => [
      ...f.medicines.filter(m => m.status !== "AVAILABLE").map(m => ({ facility: f.name, item: m.name, type: "Medicine", status: m.status })),
      ...f.diagnostics.filter(m => m.status !== "AVAILABLE").map(m => ({ facility: f.name, item: m.name, type: "Diagnostic", status: m.status })),
    ]);
    const weeks = (an.patients_by_month ?? []).map((m: AnyObj) => ({ label: m.month, patients: m.patients, visits: 0 }));
    const statusDist = Object.entries(an.referral_status_distribution ?? {}).map(([status, count]) => ({ status, count: count as number }));
    const workload = (an.facility_workload ?? []).map((w: AnyObj) => ({
      name: short(w.name), open: w.active_referrals ?? 0,
      completed: refs.filter(r => r.to_facility_id === w.facility_id && r.status === "COMPLETED").length,
      bedsFree: w.available_beds ?? 0, load: w.workload_level ?? "MODERATE",
    }));
    const riskByFacility = (an.high_risk_by_facility ?? []).map((x: AnyObj) => ({
      name: short(facilityName(x.facility_id)), high: x.high ?? 0, critical: x.critical ?? 0,
      count: x.high_risk_cases ?? 0,
    }));
    const bottlenecks = bn.map(b => ({
      facility: cache.facilities.find(f => f.id === b.facility_id) ?? {
        id: b.facility_id, name: b.name, type: "PHC" as const, village: "", distanceKm: 0, phone: "",
        totalBeds: 0, availableBeds: 0, icuBeds: 0, icuAvailable: 0, emergency: false,
        oxygen: "UNAVAILABLE" as Availability, criticalCare: "UNAVAILABLE" as Availability,
        diagnostics: [], medicines: [], specialists: [], workload: "MODERATE" as const, mapX: 50, mapY: 50,
      },
      created: b.total, completed: b.completed, pending: b.pending, overdue: b.overdue,
      inFlow: activeOf(b.facility_id).length,
    }));
    return {
      totals: {
        patients: an.total_patients, activeReferrals: an.active_referrals, pending: an.pending_referrals,
        overdue: an.overdue_referrals, highRisk: an.high_risk_cases, critical: an.critical_cases,
        completed: an.completed_referrals, missedFollowups: an.missed_followups, facilities: an.facilities,
        shortages: an.resource_shortages, completionRate: Math.round((an.completion_rate ?? 0) * 100),
        avgHours: an.avg_completion_hours ?? 0,
      },
      weeks, statusDist, workload, riskByFacility, shortages, bottlenecks,
    };
  },

  async listAudit(user: User | null) {
    const u = requireUser(user);
    requirePerm(u, "audit.read");
    const rows = await rq<AnyObj[]>("GET", "/admin/audit-logs?limit=300");
    return rows.map(mapAudit);
  },

  /* ---- sync (POST /sync/batch — idempotent by client operation id) */
  async syncState() {
    return buildSyncState();
  },

  async syncNow(user: User | null) {
    requireUser(user);
    if (offlineProbe()) throw new ApiError(503, "Cannot sync while offline.");
    const queued = (await syncOpsAll()).filter(o => o.status !== "SYNCED");
    if (queued.length === 0) {
      cache.lastSyncAt = Date.now();
      save();
      return buildSyncState();
    }
    const res = await rq<{ applied: number; conflicts: number; duplicates: number; results: AnyObj[] }>(
      "POST", "/sync/batch", {
        body: {
          ops: queued.map(o => ({
            id: o.id, entity: o.entity, operation: o.operation ?? "create",
            payload: o.payload ?? {}, client_ts: new Date(o.ts).toISOString(),
          })),
        },
      });
    for (const r of res.results) {
      const local = cache.sync.find(o => o.id === r.id);
      if (r.status === "APPLIED") {
        if (local) { local.status = "SYNCED"; local.attempts += 1; local.error = undefined; }
        await syncOpsRemove(r.id);
      } else if (r.status === "CONFLICT") {
        const err = (r.result?.error as string) ?? "Server reported a conflict — review before retrying.";
        if (local) { local.status = "FAILED"; local.attempts += 1; local.error = err; }
        await syncOpsPut({ ...queued.find(o => o.id === r.id)!, status: "FAILED", error: err });
      }
    }
    cache.lastSyncAt = Date.now();
    cache.syncBaseline.synced += res.applied;
    save();
    return buildSyncState();
  },
};

/* ------------------------------------- AI record summary (deterministic) */

export function buildAiSummary(db: DB, patientId: string): string[] {
  const p = db.patients.find(x => x.id === patientId);
  if (!p) return [];
  const lines: string[] = [];
  const visits = db.visits.filter(v => v.patientId === patientId);
  const vts = db.vitals.filter(v => v.patientId === patientId).sort((a, b) => b.ts - a.ts);
  lines.push(`${visits.length} recorded visit${visits.length === 1 ? "" : "s"}, ${vts.length} vitals observations on record.`);
  const sysReadings = vts.filter(v => v.sys).map(v => v.sys!);
  if (sysReadings.length >= 2) {
    const high = sysReadings.filter(s => s >= 140).length;
    if (high >= 2) lines.push(`Repeatedly elevated blood pressure — ${high} of ${sysReadings.length} readings at or above 140 mmHg (latest ${sysReadings[0]}/${vts.find(v => v.sys)?.dia ?? "–"}).`);
    else if (sysReadings[0]! < sysReadings[1]!) lines.push(`Blood pressure trending down (latest ${sysReadings[0]} mmHg systolic).`);
    else lines.push(`Latest BP ${sysReadings[0]} mmHg systolic.`);
  }
  const lastTemp = vts.find(v => v.temp);
  if (lastTemp) lines.push(lastTemp.temp! >= 100.4 ? `Latest temperature raised (${lastTemp.temp}°F).` : "Latest temperature within normal range.");
  const refs = db.referrals.filter(r => r.patientId === patientId).sort((a, b) => b.ts - a.ts);
  if (refs[0]) {
    const r = refs[0];
    lines.push(r.status === "COMPLETED"
      ? `Previous referral (${facilityName(r.fromFacilityId)} → ${facilityName(r.toFacilityId)}) completed on ${new Date(r.completedAt ?? r.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`
      : `Active referral (${facilityName(r.fromFacilityId)} → ${facilityName(r.toFacilityId)}) currently ${r.status.toLowerCase().replace("_", " ")}.`);
  }
  const fus = db.followups.filter(f => f.patientId === patientId && f.status === "SCHEDULED").sort((a, b) => a.date.localeCompare(b.date));
  if (fus[0]) {
    const d = daysUntil(fus[0].date);
    lines.push(d < 0 ? `Follow-up overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} — ASHA contact recommended.` : d === 0 ? "Follow-up due today." : `Follow-up due in ${d} day${d === 1 ? "" : "s"}.`);
  }
  const latestA = db.assessments.filter(a => a.patientId === patientId).sort((a, b) => b.ts - a.ts)[0];
  if (latestA) lines.push(`Most recent AI-assisted risk level: ${latestA.level} (${latestA.factors.length} factors, ${latestA.confirmed ? "clinician-confirmed" : "unconfirmed"}).`);
  const rx = db.prescriptions.filter(x => x.patientId === patientId).sort((a, b) => b.ts - a.ts)[0];
  if (rx) lines.push(`Current therapy per latest prescription: ${rx.meds.map(m => m.name).join(", ")}.`);
  if (p.conditions.length) lines.push(`Known conditions: ${p.conditions.join(", ")}.`);
  return lines;
}

/* ------------------------------------- FHIR adapter (integration-ready) */

export function toFhirBundle(db: DB, patientId: string) {
  const p = db.patients.find(x => x.id === patientId);
  if (!p) return null;
  const entry: unknown[] = [{
    resource: {
      resourceType: "Patient", id: p.rakId,
      identifier: [{ system: "urn:raksha:patient-id", value: p.rakId }, { system: "urn:abha:id", value: p.abhaId ?? "not-linked" }],
      name: [{ text: p.name }], gender: p.gender.toLowerCase(), birthDate: p.dob || undefined,
      address: [{ city: p.village, text: p.address }],
    },
  }];
  const LOINC: Record<string, string> = { sys: "8480-6", dia: "8462-4", temp: "8310-5", spo2: "59408-5", hr: "8867-4", rr: "9279-1", weight: "29463-7" };
  db.vitals.filter(v => v.patientId === patientId).forEach(v => {
    (Object.keys(LOINC) as (keyof typeof LOINC)[]).forEach(k => {
      const val = v[k as "sys"];
      if (val) entry.push({ resource: { resourceType: "Observation", status: "final", code: { coding: [{ system: "http://loinc.org", code: LOINC[k] }] }, effectiveDateTime: new Date(v.ts).toISOString(), valueQuantity: { value: val }, performer: [{ display: v.workerName }] } });
    });
  });
  db.visits.filter(v => v.patientId === patientId).forEach(v => entry.push({ resource: { resourceType: "Encounter", status: "finished", class: { code: v.type }, period: { start: new Date(v.ts).toISOString() }, subject: { reference: `Patient/${p.rakId}` } } }));
  p.conditions.forEach(c => entry.push({ resource: { resourceType: "Condition", code: { text: c, coding: [{ system: "http://snomed.info/sct", display: c }] }, subject: { reference: `Patient/${p.rakId}` } } }));
  db.prescriptions.filter(x => x.patientId === patientId).forEach(rx => rx.meds.forEach(m => entry.push({ resource: { resourceType: "MedicationRequest", status: "active", medicationCodeableConcept: { text: m.name }, dosageInstruction: [{ text: `${m.dose} × ${m.duration}` }] } })));
  db.diagnostics.filter(x => x.patientId === patientId).forEach(dg => entry.push({ resource: { resourceType: "DiagnosticReport", status: dg.status === "COMPLETED" ? "final" : "preliminary", code: { text: dg.test }, conclusion: dg.result } }));
  return { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), total: entry.length, entry };
}
