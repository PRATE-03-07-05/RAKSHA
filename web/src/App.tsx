import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  HeartPulse,
  Hospital,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import './App.css'

type DashboardRole = 'doctor' | 'facility' | 'admin'
type ReferralStatus =
  | 'CREATED'
  | 'ACCEPTED'
  | 'APPOINTMENT_PENDING'
  | 'APPOINTMENT_BOOKED'
  | 'PATIENT_NOTIFIED'
  | 'PATIENT_ARRIVED'
  | 'CONSULTATION_COMPLETED'
  | 'REFERRED_BACK'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
type AppointmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_QUEUE'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
type TriageRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT'
type SyncState = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT'
type BannerState = 'ready' | 'success' | 'warning' | 'error'

type SyntheticCase = {
  id: string
  patientName: string
  externalId: string
  age: number
  village: string
  facility: string
  riskLevel: TriageRiskLevel
  triageSummary: string
  humanReviewRequired: boolean
  reviewed: boolean
  spo2: number
  respiratoryRate: number
  referralStatus: ReferralStatus
  appointmentStatus: AppointmentStatus
  syncState: SyncState
  assignedDoctor: string
}

const initialCases: SyntheticCase[] = [
  {
    id: 'case-asha',
    patientName: 'Asha Devi',
    externalId: 'SYNTH-RAKSHA-001',
    age: 40,
    village: 'Rampur',
    facility: 'Rampur Primary Health Centre',
    riskLevel: 'HIGH',
    triageSummary:
      'Decision support only: SpO2 91%, respiratory rate 32/min, fever and breathlessness reported.',
    humanReviewRequired: true,
    reviewed: false,
    spo2: 91,
    respiratoryRate: 32,
    referralStatus: 'CREATED',
    appointmentStatus: 'REQUESTED',
    syncState: 'PENDING',
    assignedDoctor: 'Dr. Meera Singh',
  },
  {
    id: 'case-imran',
    patientName: 'Imran Khan',
    externalId: 'SYNTH-RAKSHA-002',
    age: 67,
    village: 'Maholi',
    facility: 'Sitapur District Hospital',
    riskLevel: 'MODERATE',
    triageSummary:
      'Decision support only: cough and fever reported; pulse oximetry reading is pending confirmation.',
    humanReviewRequired: true,
    reviewed: false,
    spo2: 95,
    respiratoryRate: 24,
    referralStatus: 'ACCEPTED',
    appointmentStatus: 'CONFIRMED',
    syncState: 'SYNCED',
    assignedDoctor: 'Dr. Arvind Rao',
  },
  {
    id: 'case-lata',
    patientName: 'Lata Verma',
    externalId: 'SYNTH-RAKSHA-003',
    age: 29,
    village: 'Biswan',
    facility: 'Rampur Primary Health Centre',
    riskLevel: 'LOW',
    triageSummary:
      'Decision support only: stable vitals entered; clinician review remains required before disposition.',
    humanReviewRequired: true,
    reviewed: true,
    spo2: 98,
    respiratoryRate: 18,
    referralStatus: 'COMPLETED',
    appointmentStatus: 'COMPLETED',
    syncState: 'SYNCED',
    assignedDoctor: 'Dr. Meera Singh',
  },
]

const roleLabels: Record<DashboardRole, string> = {
  doctor: 'Doctor',
  facility: 'Facility',
  admin: 'Admin',
}

const statusLabels: Record<BannerState, string> = {
  ready: 'Ready',
  success: 'Updated',
  warning: 'Needs attention',
  error: 'Server error',
}

function App() {
  const [role, setRole] = useState<DashboardRole>('doctor')
  const [cases, setCases] = useState<SyntheticCase[]>(initialCases)
  const [selectedCaseId, setSelectedCaseId] = useState(initialCases[0].id)
  const [banner, setBanner] = useState<{
    state: BannerState
    message: string
  }>({
    state: 'ready',
    message: 'Synthetic dashboard data is loaded. Clinical actions still require authorized human review.',
  })
  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? cases[0]

  const metrics = useMemo(() => {
    const awaitingReview = cases.filter((item) => item.humanReviewRequired && !item.reviewed).length
    const urgentOrHigh = cases.filter((item) => item.riskLevel === 'HIGH' || item.riskLevel === 'URGENT').length
    const activeReferrals = cases.filter(
      (item) => !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(item.referralStatus),
    ).length
    const syncExceptions = cases.filter((item) => item.syncState === 'FAILED' || item.syncState === 'CONFLICT').length
    return { awaitingReview, urgentOrHigh, activeReferrals, syncExceptions }
  }, [cases])

  function updateCase(caseId: string, update: Partial<SyntheticCase>) {
    setCases((current) => current.map((item) => (item.id === caseId ? { ...item, ...update } : item)))
  }

  function markReviewed(caseId: string) {
    updateCase(caseId, { reviewed: true })
    setBanner({
      state: 'success',
      message: 'Human review recorded for the selected synthetic triage assessment.',
    })
  }

  function prepareConsultation(caseId: string) {
    updateCase(caseId, { appointmentStatus: 'IN_CONSULTATION' })
    setBanner({
      state: 'success',
      message: 'Consultation workspace prepared. Diagnosis and treatment fields remain clinician-authored.',
    })
  }

  function advanceReferral(caseId: string) {
    const item = cases.find((candidate) => candidate.id === caseId)
    if (!item) {
      return
    }
    const nextStatus = nextReferralStatus(item.referralStatus)
    updateCase(caseId, { referralStatus: nextStatus })
    setBanner({
      state: 'success',
      message: `Referral moved to ${nextStatus}.`,
    })
  }

  function advanceAppointment(caseId: string) {
    const item = cases.find((candidate) => candidate.id === caseId)
    if (!item) {
      return
    }
    const nextStatus = nextAppointmentStatus(item.appointmentStatus)
    updateCase(caseId, { appointmentStatus: nextStatus })
    setBanner({
      state: 'success',
      message: `Appointment moved to ${nextStatus}.`,
    })
  }

  function simulateSyncException(caseId: string, syncState: SyncState) {
    updateCase(caseId, { syncState })
    setBanner({
      state: syncState === 'CONFLICT' ? 'warning' : 'error',
      message:
        syncState === 'CONFLICT'
          ? 'Conflict flagged for review. Clinical data must not be silently overwritten.'
          : 'Sync failure flagged. The record needs retry or field support.',
    })
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar" aria-labelledby="page-title">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={28} />
          </span>
          <div>
            <h1 id="page-title">RAKSHA Operations</h1>
            <p>Synthetic clinical coordination dashboard</p>
          </div>
        </div>
        <div className="role-tabs" role="tablist" aria-label="Dashboard role">
          {(Object.keys(roleLabels) as DashboardRole[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={role === item}
              className={role === item ? 'active' : ''}
              onClick={() => setRole(item)}
            >
              {roleIcon(item)}
              <span>{roleLabels[item]}</span>
            </button>
          ))}
        </div>
      </header>

      <StatusBanner state={banner.state} message={banner.message} />

      <section className="metric-strip" aria-label="Operational summary">
        <Metric
          icon={<ClipboardCheck />}
          label="Awaiting human review"
          value={metrics.awaitingReview}
          tone="blue"
        />
        <Metric
          icon={<HeartPulse />}
          label="High priority respiratory risk"
          value={metrics.urgentOrHigh}
          tone="red"
        />
        <Metric icon={<Hospital />} label="Active referrals" value={metrics.activeReferrals} tone="amber" />
        <Metric icon={<RefreshCw />} label="Sync exceptions" value={metrics.syncExceptions} tone="violet" />
      </section>

      <div className="workspace-grid">
        <CaseWorklist
          cases={cases}
          selectedCaseId={selectedCase.id}
          onSelectCase={setSelectedCaseId}
          role={role}
        />
        {role === 'doctor' && (
          <DoctorPanel
            selectedCase={selectedCase}
            onMarkReviewed={markReviewed}
            onPrepareConsultation={prepareConsultation}
          />
        )}
        {role === 'facility' && (
          <FacilityPanel
            selectedCase={selectedCase}
            onAdvanceReferral={advanceReferral}
            onAdvanceAppointment={advanceAppointment}
          />
        )}
        {role === 'admin' && (
          <AdminPanel
            cases={cases}
            selectedCase={selectedCase}
            onSyncException={simulateSyncException}
          />
        )}
      </div>
    </main>
  )
}

function StatusBanner({ state, message }: { state: BannerState; message: string }) {
  const icon = state === 'success' ? <CheckCircle2 /> : state === 'ready' ? <BadgeCheck /> : <AlertTriangle />

  return (
    <section className={`status-banner ${state}`} aria-live="polite">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{statusLabels[state]}</strong>
        <p>{message}</p>
      </div>
    </section>
  )
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: number
  tone: 'blue' | 'red' | 'amber' | 'violet'
}) {
  return (
    <div className={`metric ${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{value}</strong>
        <p>{label}</p>
      </div>
    </div>
  )
}

function CaseWorklist({
  cases,
  selectedCaseId,
  role,
  onSelectCase,
}: {
  cases: SyntheticCase[]
  selectedCaseId: string
  role: DashboardRole
  onSelectCase: (caseId: string) => void
}) {
  const title = role === 'doctor' ? 'Triage review queue' : role === 'facility' ? 'Referral and queue board' : 'Demo operations'

  return (
    <section className="worklist" aria-labelledby="case-worklist-title">
      <div className="section-heading">
        <div>
          <h2 id="case-worklist-title">{title}</h2>
          <p>All rows are synthetic and for workflow demonstration only.</p>
        </div>
        <ListChecks aria-hidden="true" />
      </div>
      <div className="case-table" aria-label="Synthetic case worklist">
        <div className="case-table-header">
          <span>Patient</span>
          <span>Risk</span>
          <span>Review</span>
          <span>Sync</span>
        </div>
        {cases.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`case-row ${selectedCaseId === item.id ? 'selected' : ''}`}
            aria-label={`Select ${item.patientName}`}
            onClick={() => onSelectCase(item.id)}
          >
            <span>
              <strong>{item.patientName}</strong>
              <small>
                {item.externalId} / {item.village}
              </small>
            </span>
            <span>
              <StatusPill label={item.riskLevel} tone={riskTone(item.riskLevel)} />
            </span>
            <span>
              <StatusPill label={item.reviewed ? 'REVIEWED' : 'REQUIRED'} tone={item.reviewed ? 'green' : 'blue'} />
            </span>
            <span>
              <StatusPill label={item.syncState} tone={syncTone(item.syncState)} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function DoctorPanel({
  selectedCase,
  onMarkReviewed,
  onPrepareConsultation,
}: {
  selectedCase: SyntheticCase
  onMarkReviewed: (caseId: string) => void
  onPrepareConsultation: (caseId: string) => void
}) {
  return (
    <section className="detail-panel" aria-labelledby="doctor-panel-title">
      <div className="section-heading">
        <div>
          <h2 id="doctor-panel-title">Doctor triage review</h2>
          <p>Decision support only. Human review is required before clinical decisions.</p>
        </div>
        <Stethoscope aria-hidden="true" />
      </div>
      <CaseHeader selectedCase={selectedCase} />
      <dl className="vitals-grid">
        <div>
          <dt>SpO2</dt>
          <dd>{selectedCase.spo2}%</dd>
        </div>
        <div>
          <dt>Respiratory rate</dt>
          <dd>{selectedCase.respiratoryRate}/min</dd>
        </div>
        <div>
          <dt>Assigned clinician</dt>
          <dd>{selectedCase.assignedDoctor}</dd>
        </div>
      </dl>
      <div className="clinical-note">
        <FileText aria-hidden="true" />
        <p>{selectedCase.triageSummary}</p>
      </div>
      <div className="action-row">
        <button
          type="button"
          className="primary-action"
          onClick={() => onMarkReviewed(selectedCase.id)}
          disabled={selectedCase.reviewed}
        >
          <ClipboardCheck aria-hidden="true" />
          <span>{selectedCase.reviewed ? 'Human review recorded' : 'Record human review'}</span>
        </button>
        <button type="button" className="secondary-action" onClick={() => onPrepareConsultation(selectedCase.id)}>
          <ArrowRight aria-hidden="true" />
          <span>Prepare consultation</span>
        </button>
      </div>
    </section>
  )
}

function FacilityPanel({
  selectedCase,
  onAdvanceReferral,
  onAdvanceAppointment,
}: {
  selectedCase: SyntheticCase
  onAdvanceReferral: (caseId: string) => void
  onAdvanceAppointment: (caseId: string) => void
}) {
  const canAdvanceReferral = nextReferralStatus(selectedCase.referralStatus) !== selectedCase.referralStatus
  const canAdvanceAppointment = nextAppointmentStatus(selectedCase.appointmentStatus) !== selectedCase.appointmentStatus

  return (
    <section className="detail-panel" aria-labelledby="facility-panel-title">
      <div className="section-heading">
        <div>
          <h2 id="facility-panel-title">Facility coordination</h2>
          <p>Queue and referral actions follow the canonical status sequence.</p>
        </div>
        <Hospital aria-hidden="true" />
      </div>
      <CaseHeader selectedCase={selectedCase} />
      <div className="workflow-lanes">
        <WorkflowLane
          icon={<Hospital />}
          title="Referral"
          status={selectedCase.referralStatus}
          nextStatus={nextReferralStatus(selectedCase.referralStatus)}
        />
        <WorkflowLane
          icon={<CalendarClock />}
          title="Appointment"
          status={selectedCase.appointmentStatus}
          nextStatus={nextAppointmentStatus(selectedCase.appointmentStatus)}
        />
      </div>
      <div className="action-row">
        <button
          type="button"
          className="primary-action"
          onClick={() => onAdvanceReferral(selectedCase.id)}
          disabled={!canAdvanceReferral}
        >
          <ArrowRight aria-hidden="true" />
          <span>{canAdvanceReferral ? 'Advance referral' : 'Referral closed'}</span>
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => onAdvanceAppointment(selectedCase.id)}
          disabled={!canAdvanceAppointment}
        >
          <Clock3 aria-hidden="true" />
          <span>{canAdvanceAppointment ? 'Advance queue' : 'Appointment closed'}</span>
        </button>
      </div>
    </section>
  )
}

function AdminPanel({
  cases,
  selectedCase,
  onSyncException,
}: {
  cases: SyntheticCase[]
  selectedCase: SyntheticCase
  onSyncException: (caseId: string, syncState: SyncState) => void
}) {
  return (
    <section className="detail-panel" aria-labelledby="admin-panel-title">
      <div className="section-heading">
        <div>
          <h2 id="admin-panel-title">Admin oversight</h2>
          <p>Operational visibility over synthetic demo flow, audit readiness, and sync exceptions.</p>
        </div>
        <Gauge aria-hidden="true" />
      </div>
      <CaseHeader selectedCase={selectedCase} />
      <div className="admin-grid">
        <div>
          <strong>{cases.length}</strong>
          <span>Synthetic patients</span>
        </div>
        <div>
          <strong>{cases.filter((item) => item.reviewed).length}</strong>
          <span>Reviewed assessments</span>
        </div>
        <div>
          <strong>{cases.filter((item) => item.syncState === 'SYNCED').length}</strong>
          <span>Synced records</span>
        </div>
      </div>
      <div className="clinical-note">
        <ShieldCheck aria-hidden="true" />
        <p>
          Audit hooks exist in the backend for auth, user-list access, workflow transitions, and respiratory triage.
          This dashboard does not show live audit logs yet.
        </p>
      </div>
      <div className="action-row">
        <button type="button" className="primary-action" onClick={() => onSyncException(selectedCase.id, 'CONFLICT')}>
          <AlertTriangle aria-hidden="true" />
          <span>Flag sync conflict</span>
        </button>
        <button type="button" className="secondary-action" onClick={() => onSyncException(selectedCase.id, 'FAILED')}>
          <RefreshCw aria-hidden="true" />
          <span>Flag sync failure</span>
        </button>
      </div>
    </section>
  )
}

function CaseHeader({ selectedCase }: { selectedCase: SyntheticCase }) {
  return (
    <div className="case-header">
      <div>
        <strong>{selectedCase.patientName}</strong>
        <span>
          {selectedCase.externalId} / {selectedCase.age} years / {selectedCase.facility}
        </span>
      </div>
      <StatusPill label="SYNTHETIC" tone="violet" />
    </div>
  )
}

function WorkflowLane({
  icon,
  title,
  status,
  nextStatus,
}: {
  icon: ReactNode
  title: string
  status: string
  nextStatus: string
}) {
  return (
    <div className="workflow-lane">
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>
          Current: <code>{status}</code>
        </p>
        <p>
          Next: <code>{nextStatus}</code>
        </p>
      </div>
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gray' }) {
  return <span className={`status-pill ${tone}`}>{label}</span>
}

function roleIcon(role: DashboardRole) {
  if (role === 'doctor') {
    return <Stethoscope aria-hidden="true" />
  }
  if (role === 'facility') {
    return <Hospital aria-hidden="true" />
  }
  return <Users aria-hidden="true" />
}

function riskTone(riskLevel: TriageRiskLevel) {
  if (riskLevel === 'URGENT' || riskLevel === 'HIGH') {
    return 'red'
  }
  if (riskLevel === 'MODERATE') {
    return 'amber'
  }
  return 'green'
}

function syncTone(syncState: SyncState) {
  if (syncState === 'SYNCED') {
    return 'green'
  }
  if (syncState === 'PENDING' || syncState === 'SYNCING') {
    return 'blue'
  }
  if (syncState === 'CONFLICT') {
    return 'violet'
  }
  return 'red'
}

function nextReferralStatus(status: ReferralStatus): ReferralStatus {
  switch (status) {
    case 'CREATED':
      return 'ACCEPTED'
    case 'ACCEPTED':
      return 'APPOINTMENT_PENDING'
    case 'APPOINTMENT_PENDING':
      return 'APPOINTMENT_BOOKED'
    case 'APPOINTMENT_BOOKED':
      return 'PATIENT_NOTIFIED'
    case 'PATIENT_NOTIFIED':
      return 'PATIENT_ARRIVED'
    case 'PATIENT_ARRIVED':
      return 'CONSULTATION_COMPLETED'
    case 'CONSULTATION_COMPLETED':
      return 'REFERRED_BACK'
    case 'REFERRED_BACK':
      return 'COMPLETED'
    case 'COMPLETED':
    case 'CANCELLED':
    case 'EXPIRED':
      return status
  }
}

function nextAppointmentStatus(status: AppointmentStatus): AppointmentStatus {
  switch (status) {
    case 'REQUESTED':
      return 'CONFIRMED'
    case 'CONFIRMED':
      return 'CHECKED_IN'
    case 'CHECKED_IN':
      return 'IN_QUEUE'
    case 'IN_QUEUE':
      return 'IN_CONSULTATION'
    case 'IN_CONSULTATION':
      return 'COMPLETED'
    case 'COMPLETED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return status
  }
}

export default App
