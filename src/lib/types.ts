/** RAKSHA domain types — mirror of the relational PostgreSQL schema. */

export type Role =
  | "PATIENT" | "ASHA" | "ANM" | "PHC_STAFF"
  | "PHC_DOCTOR" | "CHC_DOCTOR" | "SPECIALIST" | "DISTRICT_ADMIN";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Availability = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
export type Priority = "ROUTINE" | "PRIORITY" | "URGENT" | "EMERGENCY";

export type RefStatus =
  | "CREATED" | "SENT" | "ACKNOWLEDGED" | "ACCEPTED" | "ARRIVED"
  | "IN_CONSULTATION" | "TREATMENT" | "COMPLETED" | "CANCELLED";

export interface User {
  id: string; email: string; password: string; name: string;
  role: Role; facilityId?: string; village?: string; phone: string;
  specialty?: string;
}

export interface Patient {
  id: string; rakId: string; name: string; dob: string; age: number;
  gender: "FEMALE" | "MALE" | "OTHER"; phone: string; village: string; address: string;
  emergencyContact: string; emergencyPhone: string;
  conditions: string[]; allergies: string[]; pregnant?: boolean; bloodGroup?: string;
  ashaId: string; ashaName: string; phcId: string;
  consent: "ACTIVE" | "LIMITED"; abhaId?: string; createdAt: number;
}

export interface Visit {
  id: string; patientId: string; workerId: string; workerName: string; role: Role;
  facilityId?: string; location: string; ts: number;
  type: "HOME_VISIT" | "SUBCENTRE" | "PHC_VISIT";
  symptoms: string[]; complaint: string; observations: string; notes: string;
}

export interface Vitals {
  id: string; patientId: string; workerId: string; workerName: string;
  facilityId?: string; ts: number;
  sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; rr?: number; weight?: number;
  device?: string;
}

export interface TriageFactor { label: string; detail: string; severity: "info" | "warn" | "high" | "critical"; }
export interface Assessment {
  id: string; patientId: string; workerId: string; workerName: string; role: Role; ts: number;
  inputs: { symptoms: string[]; sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; age: number; pregnant?: boolean; conditions: string[]; severity: string };
  level: RiskLevel; factors: TriageFactor[]; recommendation: string; version: string;
  confirmed: boolean; confirmedBy?: string; confirmedAt?: number;
  /** Decision-support engine that produced this result (server-reported). */
  mode?: "ML_MODEL" | "RULE_BASED_FALLBACK" | "OFFLINE_PROVISIONAL";
  /** P(predicted class) when an ML model served the request. */
  confidence?: number;
  /** True while captured offline — the server re-evaluates on sync. */
  pendingSync?: boolean;
}

export interface Consultation {
  id: string; patientId: string; doctorId: string; doctorName: string; specialty?: string;
  facilityId: string; ts: number; complaint: string; findings: string; assessment: string; plan: string;
  followUpDate?: string; isTele?: boolean;
}

export interface Prescription {
  id: string; patientId: string; doctorId: string; doctorName: string; facilityId: string; ts: number;
  meds: { name: string; dose: string; duration: string }[]; notes?: string;
}

export interface DiagnosticRecord {
  id: string; patientId: string; orderedById: string; orderedByName: string; facilityId: string; ts: number;
  test: string; result?: string; status: "ORDERED" | "COMPLETED";
}

export interface ReferralEvent {
  id: string; ts: number; actorId: string; actorName: string; role: Role;
  from: RefStatus | null; to: RefStatus; facilityId: string; notes?: string;
}

export interface Referral {
  id: string; code: string; patientId: string;
  fromFacilityId: string; toFacilityId: string;
  createdBy: string; createdByName: string; creatorRole: Role; ts: number;
  reason: string; priority: Priority; clinicalSummary: string;
  vitalsSnapshot?: string; expectedDate: string;
  status: RefStatus; completedAt?: number; followUpDate?: string;
  events: ReferralEvent[];
  /** Queued offline — NOT delivered to the receiving facility until synced. */
  pendingSync?: boolean;
}

export interface FollowUp {
  id: string; patientId: string; referralId?: string; date: string;
  assigneeRole: Role; assigneeId?: string; notes: string;
  status: "SCHEDULED" | "COMPLETED"; completedAt?: number; completedBy?: string;
}

export interface Appointment {
  id: string; patientId: string; facilityId: string; date: string; time: string;
  purpose: string; status: "REQUESTED" | "CONFIRMED" | "IN_QUEUE" | "COMPLETED" | "CANCELLED";
  queuePos?: number;
}

export interface Teleconsultation {
  id: string; patientId: string; doctorId: string; doctorName: string; specialty?: string;
  facilityId: string; scheduledAt: number; status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
  roomCode: string; startedAt?: number; completedAt?: number; summary?: string; recommendation?: string; followUp?: string;
}

export interface EmergencyEvent {
  id: string; code: string; patientId: string; doctorId: string; doctorName: string;
  facilityId: string; ts: number; severity: "CRITICAL"; clinicalNote: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  smsToken: string; smsExpiresAt: number; smsRedeemed: boolean; smsLog: string[];
  ackBy?: string; ackAt?: number;
}

export interface AppNotification {
  id: string; ts: number; targetRole: Role | "ALL"; targetFacilityId?: string; targetUserId?: string;
  title: string; body: string; kind: "info" | "warning" | "critical" | "success";
  read: boolean; link?: string;
}

export interface Facility {
  id: string; name: string; type: "SUBCENTRE" | "PHC" | "CHC" | "DH";
  village: string; distanceKm: number; phone: string;
  totalBeds: number; availableBeds: number; icuBeds: number; icuAvailable: number;
  emergency: boolean; oxygen: Availability; criticalCare: Availability;
  diagnostics: { name: string; status: Availability }[];
  medicines: { name: string; status: Availability }[];
  specialists: { specialty: string; name: string; available: boolean }[];
  workload: "LOW" | "MODERATE" | "HIGH";
  mapX: number; mapY: number;
  /** Raw coordinates from the backend (demo data) — used for distance math. */
  mapLat?: number; mapLng?: number;
}

export interface AuditLog {
  id: string; ts: number; actorId: string; actorName: string; role: Role | "SYSTEM";
  action: string; resource: string; patientId?: string; purpose?: string; details?: string;
}

export interface SyncOp {
  id: string; ts: number; entity: string; label: string;
  status: "PENDING" | "SYNCED" | "FAILED"; attempts: number; error?: string;
  /** Sync-batch fields (mirrors backend SyncOpIn) — set for queueable ops. */
  operation?: "create" | "update";
  payload?: Record<string, unknown>;
}

export interface DB {
  version: number; seededAt: number;
  users: User[]; patients: Patient[]; visits: Visit[]; vitals: Vitals[];
  assessments: Assessment[]; consultations: Consultation[]; prescriptions: Prescription[];
  diagnostics: DiagnosticRecord[]; referrals: Referral[]; followups: FollowUp[];
  appointments: Appointment[]; teles: Teleconsultation[]; emergencies: EmergencyEvent[];
  notifications: AppNotification[]; facilities: Facility[]; audit: AuditLog[];
  sync: SyncOp[]; syncBaseline: { synced: number }; lastSyncAt: number | null;
}

export type TimelineKind =
  | "visit" | "vitals" | "assessment" | "consultation" | "prescription"
  | "diagnostic" | "referral" | "teleconsult" | "followup" | "emergency" | "registered";

export interface TimelineEvent {
  kind: TimelineKind; ts: number; id: string; title: string; subtitle: string;
  facilityId?: string; data: Record<string, unknown>;
}
