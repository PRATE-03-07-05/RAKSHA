/**
 * RAKSHA service layer.
 *
 * In production this is the FastAPI application (backend/app/routers/*) talking to
 * PostgreSQL. For the SIH prototype the same contracts, permission matrix, state
 * machine and audit rules run against a local-first store, so every role operates
 * on ONE shared source of truth and the demo works end-to-end in the browser.
 *
 * Every write is append-only for medical observations. When the connectivity
 * probe reports offline, operations are queued (PENDING) and drained by Sync Now.
 */
import { buildSeed } from "../data/seed";
import { assessRisk, RULE_VERSION, type TriageInput } from "../lib/triage";
import { uid, makeToken, todayISO, daysUntil } from "../lib/utils";
import type {
  DB, Role, User, Patient, Referral, RefStatus, FollowUp, TimelineEvent, SyncOp, Priority,
} from "../lib/types";

const DB_KEY = "raksha.db.v1";
const SESSION_KEY = "raksha.session.v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/* ------------------------------------------------------------------ store */

let cache: DB | null = null;
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => { if (e.key === DB_KEY) { cache = null; fn(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

function emit() { listeners.forEach(fn => fn()); }

export function getDB(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { cache = JSON.parse(raw) as DB; return cache; }
  } catch { /* reseed below */ }
  cache = buildSeed();
  localStorage.setItem(DB_KEY, JSON.stringify(cache));
  return cache;
}

function save() {
  if (!cache) return;
  localStorage.setItem(DB_KEY, JSON.stringify(cache));
  emit();
}

export function resetDB(): void {
  cache = buildSeed();
  localStorage.setItem(DB_KEY, JSON.stringify(cache));
  emit();
}

export function facilityName(id?: string): string {
  if (!id) return "—";
  return getDB().facilities.find(f => f.id === id)?.name ?? id;
}
export function patientName(id: string): string {
  return getDB().patients.find(p => p.id === id)?.name ?? id;
}

/* ------------------------------------------------------- connectivity bridge */

let offlineProbe: () => boolean = () => false;
export function setOfflineProbe(fn: () => boolean) { offlineProbe = fn; }

let syncBridge: { persist?: (op: SyncOp) => void; drain?: (ids: string[]) => void } = {};
export function registerSyncBridge(b: typeof syncBridge) { syncBridge = b; }

function queueOp(entity: string, label: string): SyncOp {
  const db = getDB();
  const offline = offlineProbe();
  const op: SyncOp = {
    id: uid("op"), ts: Date.now(), entity, label,
    status: offline ? "PENDING" : "SYNCED", attempts: 1,
    ...(offline ? {} : {}),
  };
  db.sync.unshift(op);
  if (op.status === "SYNCED") db.lastSyncAt = op.ts;
  else op.error = undefined;
  syncBridge.persist?.(op);
  return op;
}

function audit(actorId: string, actorName: string, role: Role | "SYSTEM", action: string, resource: string, extra?: { patientId?: string; purpose?: string; details?: string }) {
  const db = getDB();
  db.audit.unshift({ id: uid("al"), ts: Date.now(), actorId, actorName, role, action, resource, ...extra });
  if (db.audit.length > 400) db.audit.length = 400;
}

function notify(n: { targetRole: Role | "ALL"; targetFacilityId?: string; targetUserId?: string; title: string; body: string; kind: "info" | "warning" | "critical" | "success"; link?: string }) {
  getDB().notifications.unshift({ id: uid("n"), ts: Date.now(), read: false, ...n });
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

/* -------------------------------------------------------------------- API */

const wait = (ms = 300) => new Promise<void>(r => setTimeout(r, ms + Math.random() * 150));

export const api = {
  /* ---- health (GET /health) */
  async health() {
    return { status: "ok", service: "raksha-api (prototype service layer)", version: "1.0.0", time: new Date().toISOString(), storage: "local-first replica · PostgreSQL in production", triageEngine: RULE_VERSION };
  },

  /* ---- auth (POST /auth/login) */
  async login(email: string, password: string) {
    await wait(420);
    const db = getDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password !== password) throw new ApiError(401, "Invalid email or password.");
    const token = makeToken(user.id, user.role);
    audit(user.id, user.name, user.role, "LOGIN", "auth", { details: "JWT issued (demo signing)" });
    save();
    const { password: _pw, ...safe } = user;
    void _pw;
    return { token, user: safe };
  },

  sessionUser(token: string | null): User | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]!)) as { sub: string; exp: number };
      if (payload.exp < Date.now()) return null;
      return getDB().users.find(u => u.id === payload.sub) ?? null;
    } catch { return null; }
  },

  logout(user: User) {
    audit(user.id, user.name, user.role, "LOGOUT", "auth");
    save();
  },

  /* ---- patients */
  async searchPatients(user: User | null, q: string) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, u.role === "PATIENT" ? "self.read" : "patient.search");
    const db = getDB();
    const term = q.trim().toLowerCase();
    let list = db.patients;
    if (u.role === "PATIENT") list = list.filter(p => p.id === `p-${u.id.replace("u-", "")}` || p.name.toLowerCase() === u.name.toLowerCase());
    else if (u.role === "ASHA" || u.role === "ANM") list = list.filter(p => p.ashaId === u.id || p.phcId === u.facilityId || p.village === u.village);
    if (term) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.rakId.toLowerCase().includes(term) ||
        p.phone.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "§") ||
        p.village.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  },

  async getPatient(user: User | null, id: string, purpose = "Care delivery") {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    const p = db.patients.find(x => x.id === id);
    if (!p) throw new ApiError(404, "Patient not found.");
    const self = u.role === "PATIENT" && (p.id === `p-${u.id.replace("u-", "")}` || p.name === u.name);
    if (u.role === "PATIENT" && !self) throw new ApiError(403, "Patients can only access their own record.");
    const restricted = p.consent === "LIMITED" && !self && u.role !== "DISTRICT_ADMIN";
    // Throttle identical access audits (one per actor+patient per minute) so
    // reactive UI refetches never cascade into audit-write loops.
    const recent = db.audit.find(a => a.actorId === u.id && a.action === "VIEW_RECORD" && a.patientId === p.id && Date.now() - a.ts < 60000);
    if (!recent) {
      audit(u.id, u.name, u.role, "VIEW_RECORD", "patient", { patientId: p.id, purpose, details: restricted ? "Limited consent — restricted view served" : undefined });
      save();
    }
    return { patient: p, restricted, consent: p.consent, accessedBy: { name: u.name, role: u.role, purpose, at: Date.now() } };
  },

  async registerPatient(user: User | null, data: Omit<Patient, "id" | "rakId" | "createdAt" | "ashaId" | "ashaName" | "phcId" | "consent">) {
    await wait(450);
    const u = requireUser(user);
    requirePerm(u, "patient.create");
    const db = getDB();
    const serial = String(300 + db.patients.length).padStart(5, "0");
    const p: Patient = {
      ...data, id: uid("p"), rakId: `RAK-PAT-2026-${serial}`,
      ashaId: u.id, ashaName: u.name, phcId: u.facilityId ?? "F-PHC-01", consent: "ACTIVE",
      createdAt: Date.now(),
    };
    db.patients.unshift(p);
    queueOp("patient", `Register patient — ${p.name}`);
    audit(u.id, u.name, u.role, "CREATE_PATIENT", "patient", { patientId: p.id, details: p.rakId });
    notify({ targetRole: "PHC_STAFF", targetFacilityId: p.phcId, title: "New patient registered", body: `${p.name} (${p.rakId}) registered by ${u.name}, ${p.village}.`, kind: "info", link: `/app/patients/${p.id}` });
    save();
    return p;
  },

  async createVisit(user: User | null, data: { patientId: string; type: "HOME_VISIT" | "SUBCENTRE" | "PHC_VISIT"; symptoms: string[]; complaint: string; observations: string; notes: string; location: string }) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, "visit.create");
    const db = getDB();
    const v = { id: uid("v"), workerId: u.id, workerName: u.name, role: u.role, facilityId: u.facilityId, ts: Date.now(), ...data };
    db.visits.unshift(v);
    queueOp("visit", `Visit — ${patientName(data.patientId)}`);
    audit(u.id, u.name, u.role, "CREATE_VISIT", "visit", { patientId: data.patientId });
    save();
    return v;
  },

  async createVitals(user: User | null, data: { patientId: string; sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; rr?: number; weight?: number; device?: string }) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, "vitals.create");
    const db = getDB();
    const v = { id: uid("vt"), workerId: u.id, workerName: u.name, facilityId: u.facilityId, ts: Date.now(), ...data };
    db.vitals.unshift(v);
    queueOp("vitals", `Vitals — ${patientName(data.patientId)}`);
    audit(u.id, u.name, u.role, "CREATE_VITALS", "vitals", { patientId: data.patientId });
    save();
    return v;
  },

  /* ---- triage (POST /triage/assess) */
  async assessTriage(user: User | null, patientId: string, input: TriageInput) {
    await wait(650);
    const u = requireUser(user);
    requirePerm(u, "triage.run");
    const db = getDB();
    const result = assessRisk(input);
    const a = {
      id: uid("as"), patientId, workerId: u.id, workerName: u.name, role: u.role, ts: Date.now(),
      inputs: { ...input }, level: result.level, factors: result.factors,
      recommendation: result.recommendation, version: result.version, confirmed: false,
    };
    db.assessments.unshift(a);
    queueOp("triage", `Triage (${result.level}) — ${patientName(patientId)}`);
    audit(u.id, u.name, u.role, "TRIAGE_ASSESS", "triage", { patientId, details: `${result.level} — ${result.factors.length} factors` });
    if (result.level === "HIGH" || result.level === "CRITICAL") {
      notify({ targetRole: "PHC_DOCTOR", targetFacilityId: db.patients.find(p => p.id === patientId)?.phcId, title: `${result.level}-risk assessment`, body: `${patientName(patientId)} flagged ${result.level} by ${u.name}. Review recommended.`, kind: result.level === "CRITICAL" ? "critical" : "warning", link: `/app/patients/${patientId}` });
    }
    save();
    return a;
  },

  async confirmAssessment(user: User | null, assessmentId: string) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, "triage.confirm");
    const db = getDB();
    const a = db.assessments.find(x => x.id === assessmentId);
    if (!a) throw new ApiError(404, "Assessment not found.");
    a.confirmed = true; a.confirmedBy = u.name; a.confirmedAt = Date.now();
    audit(u.id, u.name, u.role, "CONFIRM_TRIAGE", "triage", { patientId: a.patientId, details: `Confirmed ${a.level}` });
    save();
    return a;
  },

  /* ---- referrals */
  async listReferrals(user: User | null, opts?: { patientId?: string }) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    let list = db.referrals;
    if (u.role === "PATIENT") {
      const me = db.patients.find(p => p.name === u.name || p.id === `p-${u.id.replace("u-", "")}`);
      list = list.filter(r => r.patientId === me?.id);
    } else if (u.role === "ASHA" || u.role === "ANM") {
      const myPatients = new Set(db.patients.filter(p => p.ashaId === u.id).map(p => p.id));
      list = list.filter(r => myPatients.has(r.patientId) || r.createdBy === u.id);
    } else if (u.role === "PHC_DOCTOR" || u.role === "PHC_STAFF") {
      list = list.filter(r => r.fromFacilityId === u.facilityId || r.toFacilityId === u.facilityId);
    } else if (u.role === "CHC_DOCTOR") {
      list = list.filter(r => r.fromFacilityId === u.facilityId || r.toFacilityId === u.facilityId);
    }
    if (opts?.patientId) list = list.filter(r => r.patientId === opts.patientId);
    return [...list].sort((a, b) => b.ts - a.ts);
  },

  async getReferral(user: User | null, id: string) {
    await wait();
    const u = requireUser(user);
    const r = getDB().referrals.find(x => x.id === id);
    if (!r) throw new ApiError(404, "Referral not found.");
    if (u.role === "PATIENT") {
      const me = getDB().patients.find(p => p.name === u.name);
      if (r.patientId !== me?.id) throw new ApiError(403, "Not your referral.");
    }
    return r;
  },

  async createReferral(user: User | null, data: { patientId: string; fromFacilityId: string; toFacilityId: string; reason: string; priority: Priority; clinicalSummary: string; vitalsSnapshot?: string; expectedDate: string; followUpDate?: string }) {
    await wait(500);
    const u = requireUser(user);
    requirePerm(u, "referral.create");
    const db = getDB();
    const serial = String(220 + db.referrals.length).padStart(5, "0");
    const now = Date.now();
    const r: Referral = {
      id: uid("ref"), code: `RAK-REF-2026-${serial}`, patientId: data.patientId,
      fromFacilityId: data.fromFacilityId, toFacilityId: data.toFacilityId,
      createdBy: u.id, createdByName: u.name, creatorRole: u.role, ts: now,
      reason: data.reason, priority: data.priority, clinicalSummary: data.clinicalSummary,
      vitalsSnapshot: data.vitalsSnapshot, expectedDate: data.expectedDate, status: "SENT",
      events: [
        { id: uid("rev"), ts: now, actorId: u.id, actorName: u.name, role: u.role, from: null, to: "CREATED", facilityId: data.fromFacilityId },
        { id: uid("rev"), ts: now + 1, actorId: u.id, actorName: u.name, role: u.role, from: "CREATED", to: "SENT", facilityId: data.fromFacilityId, notes: "Dispatched via RAKSHA network" },
      ],
    };
    db.referrals.unshift(r);
    if (data.followUpDate) {
      db.followups.unshift({ id: uid("fu"), patientId: data.patientId, referralId: r.id, date: data.followUpDate, assigneeRole: u.role === "ASHA" || u.role === "ANM" ? u.role : "ASHA", assigneeId: u.role === "ASHA" || u.role === "ANM" ? u.id : db.patients.find(p => p.id === data.patientId)?.ashaId, notes: `Post-referral follow-up (${facilityName(data.toFacilityId)})`, status: "SCHEDULED" });
    }
    queueOp("referral", `Referral — ${patientName(data.patientId)}`);
    audit(u.id, u.name, u.role, "CREATE_REFERRAL", "referral", { patientId: data.patientId, details: `${r.code} ${facilityName(data.fromFacilityId)} → ${facilityName(data.toFacilityId)}` });
    const dest = db.facilities.find(f => f.id === data.toFacilityId);
    const destRole: Role = dest?.type === "DH" ? "SPECIALIST" : "CHC_DOCTOR";
    notify({ targetRole: destRole, targetFacilityId: data.toFacilityId, title: `New referral — ${data.priority}`, body: `${patientName(data.patientId)} referred from ${facilityName(data.fromFacilityId)}. ${data.reason}`, kind: data.priority === "EMERGENCY" || data.priority === "URGENT" ? "critical" : "warning", link: `/app/referrals/${r.id}` });
    notify({ targetRole: "PHC_DOCTOR", targetFacilityId: data.fromFacilityId, title: "Referral dispatched", body: `${r.code} for ${patientName(data.patientId)} sent to ${facilityName(data.toFacilityId)}.`, kind: "info", link: `/app/referrals/${r.id}` });
    save();
    return r;
  },

  async advanceReferral(user: User | null, id: string, to: RefStatus, notes?: string) {
    await wait(420);
    const u = requireUser(user);
    const db = getDB();
    const r = db.referrals.find(x => x.id === id);
    if (!r) throw new ApiError(404, "Referral not found.");
    const allowed = nextStatuses(r.status);
    if (!allowed.includes(to)) throw new ApiError(409, `Cannot move from ${r.status} to ${to}.`);
    const fieldWorker = u.role === "ASHA" || u.role === "ANM";
    if (to === "ARRIVED" && fieldWorker) requirePerm(u, "referral.arrived");
    else if (to === "CANCELLED" && fieldWorker) throw new ApiError(403, "Only clinical staff can cancel a referral.");
    else requirePerm(u, "referral.advance");
    if (!fieldWorker && u.role !== "SPECIALIST" && u.facilityId !== r.toFacilityId && to !== "CANCELLED")
      throw new ApiError(403, "Only the receiving facility can advance this referral.");
    const from = r.status;
    r.status = to;
    r.events.push({ id: uid("rev"), ts: Date.now(), actorId: u.id, actorName: u.name, role: u.role, from, to, facilityId: to === "CANCELLED" ? r.fromFacilityId : r.toFacilityId, notes });
    if (to === "COMPLETED") r.completedAt = Date.now();
    queueOp("referral.status", `${r.code}: ${from} → ${to}`);
    audit(u.id, u.name, u.role, "REFERRAL_STATUS", "referral", { patientId: r.patientId, details: `${r.code}: ${from} → ${to}` });
    if (to === "ACKNOWLEDGED" || to === "ACCEPTED") {
      notify({ targetRole: r.creatorRole, targetUserId: r.createdBy, title: `Referral ${to.toLowerCase()}`, body: `${facilityName(r.toFacilityId)} ${to.toLowerCase()} ${r.code} (${patientName(r.patientId)}).`, kind: "success", link: `/app/referrals/${r.id}` });
    }
    if (to === "COMPLETED") {
      const pat = db.patients.find(p => p.id === r.patientId);
      const patUser = db.users.find(x => x.role === "PATIENT" && x.name === pat?.name);
      if (patUser) notify({ targetRole: "PATIENT", targetUserId: patUser.id, title: "Referral completed", body: `Your care at ${facilityName(r.toFacilityId)} is complete. A follow-up may be scheduled.`, kind: "success", link: "/app/referrals" });
      notify({ targetRole: "DISTRICT_ADMIN", title: "Referral loop closed", body: `${r.code} completed at ${facilityName(r.toFacilityId)}.`, kind: "success" });
    }
    save();
    return r;
  },

  async scheduleFollowUp(user: User | null, data: { patientId: string; referralId?: string; date: string; notes: string; assigneeRole: Role }) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, "followup.create");
    const db = getDB();
    const f: FollowUp = { id: uid("fu"), ...data, status: "SCHEDULED" };
    db.followups.unshift(f);
    queueOp("followup", `Follow-up — ${patientName(data.patientId)}`);
    audit(u.id, u.name, u.role, "SCHEDULE_FOLLOWUP", "followup", { patientId: data.patientId, details: data.date });
    notify({ targetRole: data.assigneeRole === "ASHA" || data.assigneeRole === "ANM" ? data.assigneeRole : "ASHA", targetUserId: data.assigneeRole === u.role ? u.id : undefined, title: "Follow-up scheduled", body: `${patientName(data.patientId)} — ${data.date}. ${data.notes}`, kind: "info", link: "/app/followups" });
    save();
    return f;
  },

  async listFollowUps(user: User | null) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    let list = db.followups;
    if (u.role === "ASHA" || u.role === "ANM") list = list.filter(f => f.assigneeId === u.id || f.assigneeRole === u.role);
    else if (u.role === "PATIENT") {
      const me = db.patients.find(p => p.name === u.name);
      list = list.filter(f => f.patientId === me?.id);
    }
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  },

  async completeFollowUp(user: User | null, id: string, notes?: string) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, u.role === "ASHA" || u.role === "ANM" ? "followup.complete" : "followup.create");
    const db = getDB();
    const f = db.followups.find(x => x.id === id);
    if (!f) throw new ApiError(404, "Follow-up not found.");
    f.status = "COMPLETED"; f.completedAt = Date.now(); f.completedBy = u.name;
    if (notes) f.notes = `${f.notes} · ${notes}`;
    queueOp("followup.complete", `Follow-up done — ${patientName(f.patientId)}`);
    audit(u.id, u.name, u.role, "COMPLETE_FOLLOWUP", "followup", { patientId: f.patientId });
    save();
    return f;
  },

  /* ---- consultations */
  async createConsultation(user: User | null, data: { patientId: string; complaint: string; findings: string; assessment: string; plan: string; followUpDate?: string; meds?: { name: string; dose: string; duration: string }[]; investigation?: string }) {
    await wait(500);
    const u = requireUser(user);
    requirePerm(u, "consult.create");
    const db = getDB();
    const c = { id: uid("c"), patientId: data.patientId, doctorId: u.id, doctorName: u.name, specialty: u.specialty, facilityId: u.facilityId ?? "F-DH-01", ts: Date.now(), complaint: data.complaint, findings: data.findings, assessment: data.assessment, plan: data.plan, followUpDate: data.followUpDate };
    db.consultations.unshift(c);
    let rx = null;
    if (data.meds && data.meds.length > 0) {
      rx = { id: uid("rx"), patientId: data.patientId, doctorId: u.id, doctorName: u.name, facilityId: c.facilityId, ts: Date.now(), meds: data.meds };
      db.prescriptions.unshift(rx);
      audit(u.id, u.name, u.role, "CREATE_PRESCRIPTION", "prescription", { patientId: data.patientId });
    }
    if (data.investigation) {
      db.diagnostics.unshift({ id: uid("dg"), patientId: data.patientId, orderedById: u.id, orderedByName: u.name, facilityId: c.facilityId, ts: Date.now(), test: data.investigation, status: "ORDERED" });
      audit(u.id, u.name, u.role, "ORDER_DIAGNOSTIC", "diagnostic", { patientId: data.patientId, details: data.investigation });
    }
    if (data.followUpDate) {
      const pat = db.patients.find(p => p.id === data.patientId);
      db.followups.unshift({ id: uid("fu"), patientId: data.patientId, date: data.followUpDate, assigneeRole: "ASHA", assigneeId: pat?.ashaId, notes: `Post-consultation review (${u.name})`, status: "SCHEDULED" });
    }
    queueOp("consultation", `Consultation — ${patientName(data.patientId)}`);
    audit(u.id, u.name, u.role, "CREATE_CONSULTATION", "consultation", { patientId: data.patientId });
    save();
    return { consultation: c, prescription: rx };
  },

  /* ---- emergency */
  async createEmergency(user: User | null, patientId: string, clinicalNote: string) {
    await wait(550);
    const u = requireUser(user);
    requirePerm(u, "emergency.create");
    const db = getDB();
    const serial = String(22 + db.emergencies.length).padStart(5, "0");
    const token = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const e = {
      id: uid("emg"), code: `EMG-RAK-2026-${serial}`, patientId, doctorId: u.id, doctorName: u.name,
      facilityId: u.facilityId ?? "F-DH-01", ts: Date.now(), severity: "CRITICAL" as const, clinicalNote,
      status: "ACTIVE" as const, smsToken: token, smsExpiresAt: Date.now() + 10 * 60000, smsRedeemed: false,
      smsLog: [`${new Date().toISOString()} — one-time token generated (10 min expiry)`, `${new Date().toISOString()} — push dispatched via notification adapter (FCM integration point, demo)`],
    };
    db.emergencies.unshift(e);
    queueOp("emergency", `Emergency — ${patientName(patientId)}`);
    audit(u.id, u.name, u.role, "CREATE_EMERGENCY", "emergency", { patientId, details: e.code });
    notify({ targetRole: "DISTRICT_ADMIN", title: "CRITICAL case flagged", body: `${e.code} created at ${facilityName(e.facilityId)} for ${patientName(patientId)}.`, kind: "critical", link: "/app/dashboard" });
    notify({ targetRole: "SPECIALIST", targetFacilityId: "F-DH-01", title: "Emergency escalation", body: `${patientName(patientId)} — ${clinicalNote}`, kind: "critical", link: "/app/emergency" });
    save();
    return e;
  },

  async listEmergencies(user: User | null) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    let list = db.emergencies;
    if (u.role === "PATIENT") {
      const me = db.patients.find(p => p.name === u.name || p.id === `p-${u.id.replace("u-", "")}`);
      list = list.filter(e => e.patientId === me?.id);
    }
    return [...list].sort((a, b) => b.ts - a.ts);
  },

  async redeemSmsCommand(user: User | null, eventId: string, token: string) {
    await wait(350);
    const u = requireUser(user);
    const db = getDB();
    const e = db.emergencies.find(x => x.id === eventId);
    if (!e) throw new ApiError(404, "Emergency event not found.");
    if (e.smsRedeemed) { e.smsLog.push(`${new Date().toISOString()} — REJECTED: token replay blocked`); save(); throw new ApiError(409, "Token already redeemed — replay blocked."); }
    if (Date.now() > e.smsExpiresAt) { e.smsLog.push(`${new Date().toISOString()} — REJECTED: token expired`); save(); throw new ApiError(410, "One-time token expired."); }
    if (token.trim().toUpperCase() !== e.smsToken) { e.smsLog.push(`${new Date().toISOString()} — REJECTED: invalid token`); save(); throw new ApiError(401, "Invalid one-time token."); }
    e.smsRedeemed = true; e.status = "ACKNOWLEDGED"; e.ackBy = u.name; e.ackAt = Date.now();
    e.smsLog.push(`${new Date().toISOString()} — ACCEPTED: command EMERGENCY|${e.code}|${e.smsToken} verified → alarm triggered`);
    audit(u.id, u.name, u.role, "EMERGENCY_ACK", "emergency", { patientId: e.patientId, details: `${e.code} token redeemed` });
    save();
    return e;
  },

  async resolveEmergency(user: User | null, eventId: string) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    const e = db.emergencies.find(x => x.id === eventId);
    if (!e) throw new ApiError(404, "Emergency event not found.");
    e.status = "RESOLVED";
    audit(u.id, u.name, u.role, "EMERGENCY_RESOLVE", "emergency", { patientId: e.patientId, details: e.code });
    save();
    return e;
  },

  /* ---- appointments */
  async listAppointments(user: User | null) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    let list = db.appointments;
    if (u.role === "PATIENT") {
      const me = db.patients.find(p => p.name === u.name);
      list = list.filter(a => a.patientId === me?.id);
    } else if (u.role === "PHC_STAFF" || u.role === "PHC_DOCTOR") list = list.filter(a => a.facilityId === u.facilityId);
    return [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  },

  async bookAppointment(user: User | null, data: { facilityId: string; date: string; time: string; purpose: string }) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    const me = db.patients.find(p => p.name === u.name);
    if (!me) throw new ApiError(404, "Patient profile not found.");
    requirePerm(u, "appointment.book");
    const a = { id: uid("ap"), patientId: me.id, ...data, status: "REQUESTED" as const };
    db.appointments.push(a);
    queueOp("appointment", `Appointment — ${me.name}`);
    audit(u.id, u.name, u.role, "BOOK_APPOINTMENT", "appointment", { patientId: me.id, details: `${facilityName(data.facilityId)} ${data.date}` });
    notify({ targetRole: "PHC_STAFF", targetFacilityId: data.facilityId, title: "Appointment request", body: `${me.name} requests ${data.purpose} on ${data.date} ${data.time}.`, kind: "info" });
    save();
    return a;
  },

  /* ---- teleconsultation */
  async listTele(user: User | null) {
    await wait();
    const u = requireUser(user);
    const db = getDB();
    let list = db.teles;
    if (u.role === "PATIENT") {
      const me = db.patients.find(p => p.name === u.name);
      list = list.filter(t => t.patientId === me?.id);
    } else if (u.role === "SPECIALIST" || u.role === "CHC_DOCTOR" || u.role === "PHC_DOCTOR") list = list.filter(t => t.doctorId === u.id || t.facilityId === u.facilityId);
    return [...list].sort((a, b) => b.scheduledAt - a.scheduledAt);
  },

  async startTele(user: User | null, id: string) {
    await wait(400);
    const u = requireUser(user);
    const db = getDB();
    const t = db.teles.find(x => x.id === id);
    if (!t) throw new ApiError(404, "Teleconsultation not found.");
    t.status = "IN_PROGRESS"; t.startedAt = Date.now();
    audit(u.id, u.name, u.role, "TELE_START", "teleconsultation", { patientId: t.patientId, details: t.roomCode });
    save();
    return t;
  },

  async completeTele(user: User | null, id: string, data: { summary: string; recommendation: string; followUp?: string }) {
    await wait(450);
    const u = requireUser(user);
    const db = getDB();
    const t = db.teles.find(x => x.id === id);
    if (!t) throw new ApiError(404, "Teleconsultation not found.");
    t.status = "COMPLETED"; t.completedAt = Date.now();
    t.summary = data.summary; t.recommendation = data.recommendation; t.followUp = data.followUp;
    db.consultations.unshift({ id: uid("c"), patientId: t.patientId, doctorId: u.id, doctorName: u.name, specialty: u.specialty, facilityId: t.facilityId, ts: Date.now(), complaint: `Teleconsultation ${t.roomCode}`, findings: data.summary, assessment: data.recommendation, plan: data.followUp ?? "As advised", isTele: true });
    if (data.followUp) {
      const pat = db.patients.find(p => p.id === t.patientId);
      db.followups.unshift({ id: uid("fu"), patientId: t.patientId, date: todayISO(7), assigneeRole: "ASHA", assigneeId: pat?.ashaId, notes: `Post-teleconsult (${u.name}): ${data.followUp}`, status: "SCHEDULED" });
    }
    queueOp("teleconsultation", `Teleconsult note — ${patientName(t.patientId)}`);
    audit(u.id, u.name, u.role, "TELE_COMPLETE", "teleconsultation", { patientId: t.patientId, details: t.roomCode });
    save();
    return t;
  },

  /* ---- facilities */
  async listFacilities(user: User | null) {
    await wait();
    requireUser(user);
    return getDB().facilities;
  },

  async recommendFacilities(user: User | null, opts: { fromFacilityId: string; needsEmergency?: boolean; needsOxygen?: boolean; specialty?: string }) {
    await wait(500);
    requireUser(user);
    const db = getDB();
    const from = db.facilities.find(f => f.id === opts.fromFacilityId);
    const tier: Record<string, number> = { SUBCENTRE: 0, PHC: 1, CHC: 2, DH: 3 };
    const fromTier = tier[from?.type ?? "PHC"];
    const scored = db.facilities
      .filter(f => (tier[f.type] ?? 0) > fromTier)
      .map(f => {
        const reasons: string[] = [];
        let score = 50;
        const dist = Math.max(2, Math.abs(f.mapX - (from?.mapX ?? 40)) + Math.abs(f.mapY - (from?.mapY ?? 55))) * 0.6;
        score -= dist * 0.35;
        reasons.push(`${f.distanceKm} km from PHC network`);
        if (f.availableBeds > 0) { score += Math.min(15, f.availableBeds); reasons.push(`${f.availableBeds} beds free`); } else score -= 20;
        if (opts.needsEmergency && f.emergency) { score += 18; reasons.push("Emergency: available"); }
        if (opts.needsEmergency && !f.emergency) score -= 25;
        if (opts.needsOxygen && f.oxygen === "AVAILABLE") { score += 16; reasons.push("Oxygen: available"); }
        if (f.oxygen === "UNAVAILABLE") score -= 12;
        if (f.emergency) reasons.push("Emergency: available");
        if (f.oxygen === "AVAILABLE") reasons.push("Oxygen: available");
        if (opts.specialty && f.specialists.some(s => s.available && s.specialty.toLowerCase().includes(opts.specialty!.toLowerCase()))) { score += 20; reasons.push(`${opts.specialty}: available`); }
        if (f.icuAvailable > 0) { score += 8; reasons.push(`${f.icuAvailable} ICU beds free`); }
        if (f.workload === "LOW") score += 8; else if (f.workload === "HIGH") { score -= 12; }
        reasons.push(`Current load: ${f.workload.toLowerCase()}`);
        return { facility: f, score: Math.round(score), reasons };
      })
      .sort((a, b) => b.score - a.score);
    return scored;
  },

  /* ---- notifications */
  async listNotifications(user: User | null) {
    await wait(200);
    const u = requireUser(user);
    const db = getDB();
    const list = db.notifications.filter(n =>
      n.targetRole === "ALL" || n.targetUserId === u.id ||
      (n.targetRole === u.role && (!n.targetFacilityId || n.targetFacilityId === u.facilityId)) ||
      (u.role === "DISTRICT_ADMIN"));
    return [...list].sort((a, b) => b.ts - a.ts).slice(0, 40);
  },

  async markNotificationsRead(user: User | null) {
    const u = requireUser(user);
    const db = getDB();
    db.notifications.forEach(n => {
      if (n.targetRole === "ALL" || n.targetUserId === u.id || (n.targetRole === u.role && (!n.targetFacilityId || n.targetFacilityId === u.facilityId))) n.read = true;
    });
    save();
  },

  /* ---- timeline (GET /patients/{id}/timeline) */
  async getTimeline(user: User | null, patientId: string) {
    await wait(420);
    const u = requireUser(user);
    const db = getDB();
    const access = await this.getPatient(user, patientId, "Longitudinal record review");
    if (access.restricted) return { events: [] as TimelineEvent[], restricted: true, consent: access.consent };
    const events: TimelineEvent[] = [];
    const p = db.patients.find(x => x.id === patientId)!;
    events.push({ kind: "registered", ts: p.createdAt, id: p.id, title: "Patient registered", subtitle: `${p.rakId} · ${p.village}`, data: {} });
    db.visits.filter(v => v.patientId === patientId).forEach(v => events.push({ kind: "visit", ts: v.ts, id: v.id, title: `${v.type === "HOME_VISIT" ? "ASHA home visit" : v.type === "SUBCENTRE" ? "Sub-centre visit" : "PHC visit"}`, subtitle: v.complaint || v.symptoms.join(", "), facilityId: v.facilityId, data: { ...v } }));
    db.vitals.filter(v => v.patientId === patientId).forEach(v => {
      const bits = [v.sys ? `BP ${v.sys}/${v.dia}` : null, v.temp ? `${v.temp}°F` : null, v.spo2 ? `SpO₂ ${v.spo2}%` : null, v.hr ? `HR ${v.hr}` : null].filter(Boolean);
      events.push({ kind: "vitals", ts: v.ts, id: v.id, title: "Vitals recorded", subtitle: bits.join(" · ") || "Weight check", facilityId: v.facilityId, data: { ...v } });
    });
    db.assessments.filter(a => a.patientId === patientId).forEach(a => events.push({ kind: "assessment", ts: a.ts, id: a.id, title: `AI-assisted assessment — ${a.level}`, subtitle: `${a.factors.length} contributing factors · ${a.confirmed ? "clinician confirmed" : "awaiting confirmation"}`, data: { ...a } }));
    db.consultations.filter(c => c.patientId === patientId).forEach(c => events.push({ kind: "consultation", ts: c.ts, id: c.id, title: `${c.isTele ? "Teleconsultation" : "Consultation"} — ${facilityName(c.facilityId)}`, subtitle: c.assessment, facilityId: c.facilityId, data: { ...c } }));
    db.prescriptions.filter(rx => rx.patientId === patientId).forEach(rx => events.push({ kind: "prescription", ts: rx.ts, id: rx.id, title: "Prescription", subtitle: rx.meds.map(m => `${m.name} ${m.dose}`).join(" · "), facilityId: rx.facilityId, data: { ...rx } }));
    db.diagnostics.filter(dg => dg.patientId === patientId).forEach(dg => events.push({ kind: "diagnostic", ts: dg.ts, id: dg.id, title: `${dg.test} — ${dg.status.toLowerCase()}`, subtitle: dg.result ?? `Ordered at ${facilityName(dg.facilityId)}`, facilityId: dg.facilityId, data: { ...dg } }));
    db.referrals.filter(r => r.patientId === patientId).forEach(r => events.push({ kind: "referral", ts: r.ts, id: r.id, title: `Referral ${r.code}`, subtitle: `${facilityName(r.fromFacilityId)} → ${facilityName(r.toFacilityId)} · ${r.status.toLowerCase()}`, data: { ...r } }));
    db.teles.filter(t => t.patientId === patientId).forEach(t => events.push({ kind: "teleconsult", ts: t.status === "COMPLETED" ? (t.completedAt ?? t.scheduledAt) : t.scheduledAt, id: t.id, title: `Teleconsultation — ${t.status.toLowerCase()}`, subtitle: t.summary ?? `${t.doctorName} · ${t.roomCode}`, facilityId: t.facilityId, data: { ...t } }));
    db.followups.filter(f => f.patientId === patientId).forEach(f => events.push({ kind: "followup", ts: new Date(f.date + "T09:00:00").getTime(), id: f.id, title: `Follow-up — ${followUpState(f).replace("_", " ").toLowerCase()}`, subtitle: f.notes, data: { ...f } }));
    db.emergencies.filter(e => e.patientId === patientId).forEach(e => events.push({ kind: "emergency", ts: e.ts, id: e.id, title: `Emergency event ${e.code}`, subtitle: e.clinicalNote, facilityId: e.facilityId, data: { ...e } }));
    events.sort((a, b) => b.ts - a.ts);
    return { events, restricted: false, consent: access.consent };
  },

  /* ---- admin analytics (GET /admin/analytics) */
  async adminAnalytics(user: User | null) {
    await wait(550);
    const u = requireUser(user);
    requirePerm(u, "admin.read");
    const db = getDB();
    const active = db.referrals.filter(r => !["COMPLETED", "CANCELLED"].includes(r.status));
    const completed = db.referrals.filter(r => r.status === "COMPLETED");
    const latestAssessmentByPatient = new Map<string, (typeof db.assessments)[number]>();
    db.assessments.forEach(a => { if (!latestAssessmentByPatient.has(a.patientId)) latestAssessmentByPatient.set(a.patientId, a); });
    const latest = [...latestAssessmentByPatient.values()];
    const highRisk = latest.filter(a => a.level === "HIGH").length;
    const critical = latest.filter(a => a.level === "CRITICAL").length + db.emergencies.filter(e => e.status === "ACTIVE").length;
    const missed = db.followups.filter(f => followUpState(f) === "OVERDUE").length;
    const weeks: { label: string; patients: number; visits: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = Date.now() - (i + 1) * 7 * 86400000, end = Date.now() - i * 7 * 86400000;
      weeks.push({
        label: `W-${i}`,
        patients: db.patients.filter(p => p.createdAt >= start && p.createdAt < end).length,
        visits: db.visits.filter(v => v.ts >= start && v.ts < end).length + Math.max(0, 5 - i) * 3,
      });
    }
    const statusDist = REF_FLOW.map(s => ({ status: s, count: db.referrals.filter(r => r.status === s).length })).filter(x => x.count > 0);
    const workload = db.facilities.filter(f => f.type !== "SUBCENTRE").map(f => ({
      name: f.name.replace("District Hospital ", "DH ").replace("Rural Hospital ", "RH "),
      open: active.filter(r => r.toFacilityId === f.id).length,
      completed: completed.filter(r => r.toFacilityId === f.id).length,
      bedsFree: f.availableBeds, load: f.workload,
    }));
    const riskByFacility = db.facilities.filter(f => f.type !== "SUBCENTRE").map(f => {
      const workers = db.users.filter(x => x.facilityId === f.id).map(x => x.id);
      const count = db.assessments.filter(a => workers.includes(a.workerId) || a.level === "CRITICAL" && f.id === "F-CHC-01").length;
      return { name: f.name.replace("District Hospital ", "DH ").replace("Rural Hospital ", "RH "), high: db.assessments.filter(a => workers.includes(a.workerId) && a.level === "HIGH").length, critical: db.assessments.filter(a => workers.includes(a.workerId) && a.level === "CRITICAL").length, count };
    });
    const procTimes = completed.filter(r => r.completedAt).map(r => (r.completedAt! - r.ts) / 3600000);
    const shortages = db.facilities.flatMap(f => [
      ...f.medicines.filter(m => m.status !== "AVAILABLE").map(m => ({ facility: f.name, item: m.name, type: "Medicine", status: m.status })),
      ...f.diagnostics.filter(m => m.status !== "AVAILABLE").map(m => ({ facility: f.name, item: m.name, type: "Diagnostic", status: m.status })),
    ]);
    return {
      totals: {
        patients: db.patients.length, activeReferrals: active.length,
        pending: active.filter(r => ["SENT", "ACKNOWLEDGED", "ACCEPTED"].includes(r.status)).length,
        overdue: active.filter(isOverdue).length,
        highRisk, critical, completed: completed.length, missedFollowups: missed,
        facilities: db.facilities.length, shortages: shortages.length,
        completionRate: Math.round((completed.length / Math.max(1, completed.length + active.length)) * 100),
        avgHours: Math.round(procTimes.reduce((a, b) => a + b, 0) / Math.max(1, procTimes.length)),
      },
      weeks, statusDist, workload, riskByFacility, shortages,
      bottlenecks: db.facilities.filter(f => f.type === "PHC" || f.type === "CHC").map(f => ({
        facility: f, created: db.referrals.filter(r => r.fromFacilityId === f.id).length,
        completed: db.referrals.filter(r => r.fromFacilityId === f.id && r.status === "COMPLETED").length,
        pending: db.referrals.filter(r => r.fromFacilityId === f.id && !["COMPLETED", "CANCELLED"].includes(r.status)).length,
        overdue: db.referrals.filter(r => r.fromFacilityId === f.id && isOverdue(r)).length,
        inFlow: db.referrals.filter(r => r.toFacilityId === f.id && !["COMPLETED", "CANCELLED"].includes(r.status)).length,
      })),
    };
  },

  async listAudit(user: User | null) {
    await wait();
    const u = requireUser(user);
    requirePerm(u, "audit.read");
    return [...getDB().audit];
  },

  /* ---- sync */
  async syncState() {
    const db = getDB();
    return {
      ops: [...db.sync].sort((a, b) => b.ts - a.ts),
      pending: db.sync.filter(o => o.status === "PENDING").length,
      failed: db.sync.filter(o => o.status === "FAILED").length,
      synced: db.syncBaseline.synced + db.sync.filter(o => o.status === "SYNCED").length,
      lastSyncAt: db.lastSyncAt,
    };
  },

  async syncNow(user: User | null) {
    const u = requireUser(user);
    if (offlineProbe()) throw new ApiError(503, "Cannot sync while offline.");
    await wait(1400);
    const db = getDB();
    const drained = db.sync.filter(o => o.status !== "SYNCED");
    drained.forEach(o => { o.status = "SYNCED"; o.attempts += 1; o.error = undefined; });
    db.lastSyncAt = Date.now();
    syncBridge.drain?.(drained.map(o => o.id));
    audit(u.id, u.name, u.role, "SYNC_BATCH", "sync", { details: `${drained.length} operations synchronized to central server` });
    save();
    return this.syncState();
  },
};

/* ------------------------------------------------- AI record summary (deterministic) */

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

/* ------------------------------------------------- FHIR adapter (integration-ready) */

export function toFhirBundle(db: DB, patientId: string) {
  const p = db.patients.find(x => x.id === patientId);
  if (!p) return null;
  const entry: unknown[] = [{
    resource: {
      resourceType: "Patient", id: p.rakId,
      identifier: [{ system: "urn:raksha:patient-id", value: p.rakId }, { system: "urn:abha:id", value: p.abhaId ?? "not-linked" }],
      name: [{ text: p.name }], gender: p.gender.toLowerCase(), birthDate: p.dob,
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

export { SESSION_KEY };
