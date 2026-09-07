/** RAKSHA sign-in with one-tap demo logins. */
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound, HeartHandshake, HeartPulse, ClipboardList, Stethoscope, Building2,
  Microscope, BarChart3, ArrowLeft, KeyRound, RotateCcw, BadgeCheck,
} from "lucide-react";
import { useAuth, useI18n, useToast } from "../store/providers";
import { resetDB } from "../store/backend";
import { Btn, Field, Input, Banner } from "../components/ui";
import { LogoMark, AppShell } from "../components/shell";
import { CareChain } from "./Landing";
import type { Role } from "../lib/types";

export const ROLE_HOME: Record<Role, string> = {
  PATIENT: "/app/home", ASHA: "/app/dashboard", ANM: "/app/dashboard", PHC_STAFF: "/app/dashboard",
  PHC_DOCTOR: "/app/dashboard", CHC_DOCTOR: "/app/dashboard", SPECIALIST: "/app/dashboard", DISTRICT_ADMIN: "/app/dashboard",
};

const DEMO: { email: string; label: string; role: Role; icon: React.ReactNode; desc: string }[] = [
  { email: "patient@raksha.demo", label: "Patient", role: "PATIENT", icon: <UserRound className="h-4 w-4" />, desc: "Sita Devi · RAK-PAT-2026-00124" },
  { email: "asha@raksha.demo", label: "ASHA", role: "ASHA", icon: <HeartHandshake className="h-4 w-4" />, desc: "Sunita Bai · field worker" },
  { email: "anm@raksha.demo", label: "ANM", role: "ANM", icon: <HeartPulse className="h-4 w-4" />, desc: "Kavita Pawar · sub-centre" },
  { email: "phc.staff@raksha.demo", label: "PHC Staff", role: "PHC_STAFF", icon: <ClipboardList className="h-4 w-4" />, desc: "Mahesh Raut · OPD desk" },
  { email: "phc.doctor@raksha.demo", label: "PHC Doctor", role: "PHC_DOCTOR", icon: <Stethoscope className="h-4 w-4" />, desc: "Dr. Anil Sharma" },
  { email: "chc.doctor@raksha.demo", label: "CHC Doctor", role: "CHC_DOCTOR", icon: <Building2 className="h-4 w-4" />, desc: "Dr. Meera Joshi" },
  { email: "specialist@raksha.demo", label: "Specialist", role: "SPECIALIST", icon: <Microscope className="h-4 w-4" />, desc: "Dr. Vikram Rao · DH" },
  { email: "admin@raksha.demo", label: "District Admin", role: "DISTRICT_ADMIN", icon: <BarChart3 className="h-4 w-4" />, desc: "Dr. N. Kulkarni · DHO" },
];

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doLogin = async (em: string, pw: string) => {
    setBusy(em); setError(null);
    try {
      const u = await login(em, pw);
      nav(ROLE_HOME[u.role], { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally { setBusy(null); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* brand side */}
      <div className="relative hidden overflow-hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-700/30 blur-3xl" aria-hidden="true" />
        <Link to="/" className="flex w-fit items-center gap-3">
          <LogoMark size={38} />
          <div>
            <p className="font-display text-xl font-extrabold tracking-tight">RAKSHA</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-300">{t("tagline")}</p>
          </div>
        </Link>
        <div className="max-w-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">The care chain, live</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold leading-tight">Every role works on the same patient record.</h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-300">Sign in as the ASHA, then as the CHC doctor — the referral you create appears on both dashboards instantly. That is the whole point.</p>
        </div>
        <div className="max-w-sm text-white"><CareChain compact /></div>
      </div>

      {/* form side */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-xl">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"><ArrowLeft className="h-4 w-4" /> raksha.health</Link>
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark size={36} />
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight text-brand-950">RAKSHA</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-500">{t("tagline")}</p>
            </div>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-950">{t("welcome")}</h2>
          <p className="mt-1 text-sm text-slate-500">Role-based access · JWT session · every action audited</p>

          {error && <div className="mt-4"><Banner tone="danger">{error}</Banner></div>}

          <form className="mt-6 space-y-4 rounded-2xl border border-brand-900/10 bg-white p-6 shadow-card" onSubmit={e => { e.preventDefault(); void doLogin(email, password); }}>
            <Field label={t("email")} required>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="asha@raksha.demo" autoComplete="username" />
            </Field>
            <Field label={t("password")} required hint="Demo password for all accounts: raksha123">
              <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            <Btn type="submit" className="w-full" size="lg" loading={busy === "form"} onClick={undefined}>
              <KeyRound className="h-4 w-4" /> {t("login")}
            </Btn>
          </form>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-[0.12em] text-brand-800">{t("demoAccounts")}</h3>
              <p className="text-[11px] text-slate-400">{t("demoNote")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
              {DEMO.map(d => (
                <button
                  key={d.email}
                  onClick={() => void doLogin(d.email, "raksha123")}
                  disabled={busy !== null}
                  className="group flex items-center gap-3 rounded-xl border border-brand-900/10 bg-white p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-pop disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">{d.icon}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-brand-950">{busy === d.email ? <BadgeCheck className="h-4 w-4 animate-pulse text-brand-600" /> : null}{d.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{d.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { resetDB(); toast("Demo data reset to seed state.", "info"); }}
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 transition hover:text-brand-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
          </button>
        </div>
      </div>
    </div>
  );
}

export { AppShell };
