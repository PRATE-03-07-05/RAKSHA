/** RAKSHA — application router with role-gated routes. */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers, useAuth } from "./store/providers";
import { AppShell } from "./components/shell";
import { Spinner } from "./components/ui";
import Landing from "./pages/Landing";
import Login, { ROLE_HOME } from "./pages/Login";
import { PatientRecordPage, CareJourneyPage } from "./pages/RecordPages";
import { PatientHomePage, AppointmentsPage, ReferralListPage, TelePage, NotificationsPage, ProfilePage } from "./pages/PatientPortal";
import { FieldDashboard, RegisterPage, PatientsPage, AssessFlow, FollowUpsPage, SyncCenterPage } from "./pages/FieldWorker";
import { DoctorDashboard, QueuePage, DoctorReferralsPage, ReferralDetailPage, DoctorPatientPage, EmergencyPage } from "./pages/Doctor";
import { AdminDashboard, FacilitiesPage, BottleneckPage, AuditPage, SettingsPage, AdminReferralsPage, UserManagement } from "./pages/Admin";
import type { Role } from "./lib/types";

const FIELD: Role[] = ["ASHA", "ANM", "PHC_STAFF"];
const CLINICAL: Role[] = ["PHC_DOCTOR", "CHC_DOCTOR", "SPECIALIST"];

function Gate({ roles, children }: { roles?: Role[]; children: React.ReactElement }) {
  const { user, booting } = useAuth();
  if (booting) return <div className="grid min-h-screen place-items-center"><Spinner label="RAKSHA…" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return children;
}

function LoginGate() {
  const { user, booting } = useAuth();
  if (booting) return <div className="grid min-h-screen place-items-center"><Spinner label="RAKSHA…" /></div>;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Login />;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "DISTRICT_ADMIN") return <AdminDashboard />;
  if (CLINICAL.includes(user.role)) return <DoctorDashboard />;
  if (user.role === "PATIENT") return <Navigate to="/app/home" replace />;
  return <FieldDashboard />;
}

function PatientPageRouter() {
  const { user } = useAuth();
  if (!user) return null;
  return CLINICAL.includes(user.role) ? <DoctorPatientPage /> : <PatientRecordPage />;
}

function ReferralsRouter() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "DISTRICT_ADMIN") return <AdminReferralsPage />;
  if (CLINICAL.includes(user.role)) return <DoctorReferralsPage />;
  return <ReferralListPage />;
}

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginGate />} />
          <Route path="/app" element={<Gate><AppShell /></Gate>}>
            <Route index element={<DashboardRouter />} />
            <Route path="home" element={<Gate roles={["PATIENT"]}><PatientHomePage /></Gate>} />
            <Route path="dashboard" element={<DashboardRouter />} />
            <Route path="patients" element={<Gate roles={[...FIELD, ...CLINICAL, "DISTRICT_ADMIN"]}><PatientsPage /></Gate>} />
            <Route path="patients/:id" element={<Gate roles={[...FIELD, ...CLINICAL, "DISTRICT_ADMIN"]}><PatientPageRouter /></Gate>} />
            <Route path="record" element={<Gate roles={["PATIENT"]}><PatientRecordPage /></Gate>} />
            <Route path="journey" element={<CareJourneyPage />} />
            <Route path="journey/:id" element={<Gate roles={[...FIELD, ...CLINICAL, "DISTRICT_ADMIN"]}><CareJourneyPage /></Gate>} />
            <Route path="register" element={<Gate roles={FIELD}><RegisterPage /></Gate>} />
            <Route path="assess" element={<Gate roles={FIELD}><AssessFlow /></Gate>} />
            <Route path="queue" element={<Gate roles={CLINICAL}><QueuePage /></Gate>} />
            <Route path="referrals" element={<ReferralsRouter />} />
            <Route path="referrals/:id" element={<ReferralDetailPage />} />
            <Route path="followups" element={<FollowUpsPage />} />
            <Route path="tele" element={<Gate roles={["PATIENT", ...CLINICAL]}><TelePage /></Gate>} />
            <Route path="emergency" element={<Gate roles={[...CLINICAL, "DISTRICT_ADMIN"]}><EmergencyPage /></Gate>} />
            <Route path="appointments" element={<Gate roles={["PATIENT"]}><AppointmentsPage /></Gate>} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="sync" element={<Gate roles={FIELD}><SyncCenterPage /></Gate>} />
            <Route path="facilities" element={<Gate roles={["DISTRICT_ADMIN"]}><FacilitiesPage /></Gate>} />
            <Route path="bottlenecks" element={<Gate roles={["DISTRICT_ADMIN"]}><BottleneckPage /></Gate>} />
            <Route path="audit" element={<Gate roles={["DISTRICT_ADMIN"]}><AuditPage /></Gate>} />
            <Route path="users" element={<Gate roles={["DISTRICT_ADMIN"]}><UserManagement /></Gate>} />
            <Route path="settings" element={<Gate roles={["DISTRICT_ADMIN"]}><SettingsPage /></Gate>} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}
