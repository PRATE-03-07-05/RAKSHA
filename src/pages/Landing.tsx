/** RAKSHA public landing page. */
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HeartHandshake, Stethoscope, Building2, UserRound, Microscope, ClipboardCheck,
  FolderHeart, WifiOff, Route, BrainCircuit, Video, ShieldCheck,
  ArrowRight, UploadCloud, CheckCircle2, AlertTriangle, Languages,
} from "lucide-react";
import { assessRisk, TRIAGE_THRESHOLDS, SYMPTOM_OPTIONS } from "../lib/triage";
import { RiskBadge, RefStatusBadge, Btn, Pill } from "../components/ui";
import { useI18n, useReveal } from "../store/providers";
import { LogoMark } from "../components/shell";
import { REF_FLOW } from "../store/backend";
import { cx } from "../lib/utils";

const CHAIN = [
  { icon: <UserRound className="h-5 w-5" />, name: "Patient", note: "Unique RAKSHA ID", village: "Demapur" },
  { icon: <HeartHandshake className="h-5 w-5" />, name: "ASHA / ANM", note: "Home visit · vitals · triage", village: "Field" },
  { icon: <Stethoscope className="h-5 w-5" />, name: "PHC", note: "First medical contact", village: "Demapur" },
  { icon: <Building2 className="h-5 w-5" />, name: "CHC", note: "Referral care · diagnostics", village: "Shirur" },
  { icon: <Microscope className="h-5 w-5" />, name: "Specialist", note: "District hospital · teleconsult", village: "DH" },
  { icon: <ClipboardCheck className="h-5 w-5" />, name: "Follow-up", note: "Loop closed by ASHA", village: "Home" },
];

export function CareChain({ compact }: { compact?: boolean }) {
  return (
    <div className={cx("relative", compact ? "space-y-1.5" : "space-y-2")}>
      {CHAIN.map((c, i) => (
        <React.Fragment key={c.name}>
          <div
            className={cx(
              "anim-fade-up flex items-center gap-3.5 rounded-xl border border-brand-900/10 bg-white/95 shadow-card transition-transform hover:translate-x-1",
              compact ? "px-3 py-2" : "px-4 py-3"
            )}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-emerald-300">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={cx("font-display font-bold leading-tight text-brand-950", compact ? "text-sm" : "text-[15px]")}>{c.name}</p>
              <p className="truncate text-[11px] text-slate-500">{c.note}</p>
            </div>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-brand-400">{c.village}</span>
          </div>
          {i < CHAIN.length - 1 && (
            <div className="flex justify-center py-0.5">
              <svg width="14" height="22" aria-hidden="true"><line x1="7" y1="0" x2="7" y2="22" className="dash-flow" stroke="#2c7a65" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </div>
          )}
        </React.Fragment>
      ))}
      <div className="anim-fade-up flex items-center gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 shadow-card" style={{ animationDelay: "560ms" }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white"><FolderHeart className="h-5 w-5" /></span>
        <div className="flex-1">
          <p className="font-display text-[15px] font-bold text-emerald-900">Longitudinal Health Record</p>
          <p className="text-[11px] text-emerald-700">Information follows the patient — every visit, vital and referral in one timeline.</p>
        </div>
      </div>
    </div>
  );
}

function Ecg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 620 80" className={className} aria-hidden="true" preserveAspectRatio="none">
      <path d="M0 40 H120 l12-14 14 28 10-42 12 56 10-28 h60 l10-10 12 20 8-10 h90 l12-16 14 32 10-46 12 60 10-30 h60 l10-10 12 20 8-10 H620"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ecg-line" />
    </svg>
  );
}

function TriageDemo() {
  const [spo2, setSpo2] = useState(97);
  const [temp, setTemp] = useState(98.6);
  const [hr, setHr] = useState(82);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [age] = useState(52);
  const result = useMemo(() => assessRisk({ symptoms, spo2, temp, hr, age, conditions: [], severity: "MILD" }), [spo2, temp, hr, symptoms]);
  const toggle = (s: string) => setSymptoms(x => x.includes(s) ? x.filter(y => y !== s) : [...x, s]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5 rounded-2xl border border-brand-900/10 bg-white p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Live rule engine · thresholds from triage_service</p>
        {([
          ["SpO₂", spo2, setSpo2, 70, 100, "%"],
          ["Temperature", temp, setTemp, 95, 105, "°F"],
          ["Heart rate", hr, setHr, 40, 150, "/min"],
        ] as const).map(([label, val, set, min, max, unit]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-brand-950">{label}</span>
              <span className="font-mono text-sm font-bold text-brand-700">{val}{unit}</span>
            </div>
            <input type="range" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))} className="w-full" aria-label={label} />
          </div>
        ))}
        <div>
          <p className="mb-2 text-sm font-semibold text-brand-950">Reported symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {SYMPTOM_OPTIONS.slice(0, 8).map(s => (
              <button key={s} onClick={() => toggle(s)} className={cx("rounded-full border px-3 py-1 text-xs font-medium transition", symptoms.includes(s) ? "border-brand-600 bg-brand-700 text-white" : "border-brand-900/15 bg-white text-slate-600 hover:border-brand-400")}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col rounded-2xl border border-brand-900/10 bg-brand-950 p-6 text-white shadow-pop">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-300"><BrainCircuit className="h-4 w-4" /> Preliminary result</p>
          <RiskBadge level={result.level} size="lg" />
        </div>
        <div className="mt-4 flex-1 space-y-2 overflow-hidden">
          {result.factors.slice(0, 5).map(f => (
            <div key={f.label} className="anim-fade-in flex items-start gap-2.5 rounded-lg bg-white/6 px-3 py-2">
              <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", f.severity === "critical" ? "bg-rose-400" : f.severity === "high" ? "bg-orange-400" : f.severity === "warn" ? "bg-amber-400" : "bg-emerald-400")} />
              <div>
                <p className="text-sm font-semibold leading-tight">{f.label}</p>
                <p className="text-[11px] text-brand-300">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-brand-200">{result.recommendation}</p>
        <p className="mt-3 text-[11px] font-medium italic text-brand-400">AI-assisted preliminary assessment — not a medical diagnosis. A clinician confirms every result.</p>
        <p className="mt-2 font-mono text-[10px] text-brand-500">{result.version}</p>
      </div>
    </div>
  );
}

function RefLoopDemo() {
  const [idx, setIdx] = useState(2);
  const status = REF_FLOW[idx];
  return (
    <div className="rounded-2xl border border-brand-900/10 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center gap-1.5">
        {REF_FLOW.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setIdx(i)}
              className={cx("rounded-full border px-3 py-1.5 text-[11px] font-bold transition", i < idx ? "border-emerald-300 bg-emerald-50 text-emerald-800" : i === idx ? "border-brand-700 bg-brand-800 text-white shadow-sm" : "border-brand-900/10 bg-white text-slate-400")}
            >
              {i < idx ? "✓ " : ""}{s.replace("_", " ")}
            </button>
            {i < REF_FLOW.length - 1 && <ArrowRight className="h-3 w-3 text-brand-300" />}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4">
          <p className="font-mono text-[11px] font-semibold text-brand-500">RAK-REF-2026-00211 · PHC Demapur → CHC Shirur</p>
          <p className="font-display mt-1 text-lg font-bold text-brand-950">Sita Devi · Priority clinical evaluation</p>
          <p className="mt-1 text-sm text-slate-500">Every transition appends an immutable event — timestamp, actor, facility, notes. Nothing can silently disappear.</p>
        </div>
        <div className="flex flex-col items-start justify-center gap-2 sm:items-end">
          <RefStatusBadge status={status} />
          <Btn size="sm" variant="secondary" onClick={() => setIdx(i => (i + 1) % REF_FLOW.length)}>Advance step <ArrowRight className="h-3.5 w-3.5" /></Btn>
        </div>
      </div>
    </div>
  );
}

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={cx("reveal", className)}>{children}</div>;
}

const HONESTY: { tag: string; tone: "green" | "sky" | "amber" | "slate"; items: string[] }[] = [
  { tag: "Implemented", tone: "green", items: ["Auth + RBAC (8 roles)", "Longitudinal record & timeline", "AI rule-based triage with explanations", "Closed-loop referral lifecycle", "Offline queue + Sync Center (IndexedDB)", "District analytics & bottlenecks", "Emergency events + in-app alerts", "Teleconsultation workflow", "Audit logging", "EN / हिंदी / मराठी UI"] },
  { tag: "Mocked / Demo", tone: "amber", items: ["Facility bed & stock figures (seeded)", "District map coordinates", "Patient volume history", "AI summary generator (deterministic)"] },
  { tag: "Integration-ready", tone: "sky", items: ["ABDM / ABHA adapter interfaces", "HL7 FHIR R4 bundle export (Patient, Observation, Encounter…)", "eSanjeevani teleconsult bridge", "FCM push (isolated adapter)", "SMS emergency fallback (token protocol)"] },
  { tag: "Future", tone: "slate", items: ["Live HMIS sync", "Real mapping service", "External LLM summaries", "Biometric attendance"] },
];

export default function Landing() {
  const { t } = useI18n();
  const [langMenu, setLangMenu] = useState(false);
  const { lang, setLang, langs } = useI18n();
  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-brand-900/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <div>
              <p className="font-display text-base font-extrabold leading-none tracking-tight text-brand-950">RAKSHA</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-500">Smart Healthcare Assistance</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#problem" className="hover:text-brand-800">Problem</a>
            <a href="#solution" className="hover:text-brand-800">Solution</a>
            <a href="#ai" className="hover:text-brand-800">AI Triage</a>
            <a href="#honesty" className="hover:text-brand-800">Transparency</a>
          </nav>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setLangMenu(v => !v)} className="flex items-center gap-1.5 rounded-lg border border-brand-900/10 bg-white px-2.5 py-2 text-xs font-bold text-brand-800 shadow-sm hover:border-brand-300" aria-label={t("language")}>
                <Languages className="h-4 w-4" /> {lang.toUpperCase()}
              </button>
              {langMenu && (
                <div className="absolute right-0 top-11 z-50 w-32 overflow-hidden rounded-lg border border-brand-900/10 bg-white shadow-pop">
                  {langs.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setLangMenu(false); }} className={cx("block w-full px-3 py-2 text-left text-sm font-medium hover:bg-brand-50", lang === l.code ? "text-brand-800" : "text-slate-600")}>{l.label}</button>
                  ))}
                </div>
              )}
            </div>
            <Link to="/login"><Btn size="sm">{t("login")} <ArrowRight className="h-3.5 w-3.5" /></Btn></Link>
          </div>
        </div>
      </header>

      {/* hero — the care chain opens the page */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
          <div>
            <p className="anim-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" /> Smart India Hackathon 2026 · Prototype
            </p>
            <h1 className="anim-fade-up font-display text-[52px] font-extrabold leading-[0.95] tracking-tight text-brand-950 sm:text-[72px]" style={{ animationDelay: "60ms" }}>
              RAK<span className="text-brand-600">SHA</span>
            </h1>
            <p className="anim-fade-up mt-3 max-w-lg text-sm font-semibold uppercase tracking-wide text-slate-500" style={{ animationDelay: "120ms" }}>
              Responsive AI-enabled Knowledge & Smart Healthcare Assistance
            </p>
            <p className="anim-fade-up font-display mt-4 max-w-xl text-2xl font-bold leading-snug text-brand-800 sm:text-[28px]" style={{ animationDelay: "180ms" }}>
              {t("tagline")}
            </p>
            <p className="anim-fade-up mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600" style={{ animationDelay: "240ms" }}>
              An integrated digital healthcare platform connecting patients, frontline health workers, healthcare facilities and specialists through continuous, accessible and coordinated care.
            </p>
            <div className="anim-fade-up mt-7 flex flex-wrap gap-3" style={{ animationDelay: "300ms" }}>
              <Link to="/login"><Btn size="lg">{t("exploreDemo")} <ArrowRight className="h-4 w-4" /></Btn></Link>
              <Link to="/login"><Btn size="lg" variant="secondary"><Route className="h-4 w-4 text-brand-600" /> {t("viewJourney")}</Btn></Link>
            </div>
            <div className="anim-fade-up mt-8 grid max-w-lg grid-cols-3 gap-3" style={{ animationDelay: "360ms" }}>
              {[["8", "roles on one record"], ["9", "referral lifecycle stages"], ["3", "languages · offline-first"]].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-brand-900/10 bg-white/80 px-3 py-2.5 shadow-card">
                  <p className="font-display text-2xl font-extrabold text-brand-700">{v}</p>
                  <p className="text-[11px] font-medium text-slate-500">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[28px] bg-brand-800/8 blur-sm" aria-hidden="true" />
            <div className="relative rounded-2xl border border-brand-900/10 bg-paper/60 p-4 shadow-pop sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-500">The RAKSHA care chain</p>
                <Pill tone="green">Live workflow</Pill>
              </div>
              <CareChain />
            </div>
          </div>
        </div>
        <div className="text-brand-600/50"><Ecg className="h-14 w-full" /></div>
      </section>

      {/* messages band */}
      <section className="bg-brand-950 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {[
            ["“Connectivity should not stop healthcare.”", "Offline-first field workflows with a durable sync queue.", <WifiOff key="a" className="h-5 w-5" />],
            ["“A referral should never disappear.”", "Closed-loop tracking from creation to completed follow-up.", <Route key="b" className="h-5 w-5" />],
            ["“Information should follow the patient.”", "One longitudinal record across every facility and role.", <FolderHeart key="c" className="h-5 w-5" />],
            ["“Specialists should be reachable without travel.”", "Teleconsultation brings the district hospital to the village.", <Video key="d" className="h-5 w-5" />],
            ["“AI should assist, not replace clinicians.”", "Transparent rule-based risk signals, confirmed by humans.", <BrainCircuit key="e" className="h-5 w-5" />],
            ["“Admins should see where care gets stuck.”", "Referral bottlenecks and shortages, district-wide.", <Building2 key="f" className="h-5 w-5" />],
          ].map(([quote, sub, icon], i) => (
            <Reveal key={i}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-white/10 p-2 text-emerald-300">{icon}</span>
                <div>
                  <p className="font-display text-[17px] font-bold leading-snug">{quote}</p>
                  <p className="mt-1 text-[13px] text-brand-300">{sub}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* problem */}
      <section id="problem" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">The problem</p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">Rural referrals leak at every hand-off.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-slate-600">
                A paper slip travels in the patient's pocket. The CHC never knows who is coming. The PHC never learns what happened.
                Follow-ups dissolve, histories are retold at every counter, and high-risk cases surface too late.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["40%+", "of referred patients never reach the destination facility", "red"],
                ["3–5×", "the same history re-collected per episode of care", "amber"],
                ["0", "shared view between ASHA, PHC and district hospital", "slate"],
                ["hrs", "of travel lost for advice a teleconsult could give", "brand"],
              ].map(([v, l, tone], i) => (
                <div key={i} className={cx("rounded-xl border p-4 shadow-card", tone === "red" ? "border-rose-200 bg-rose-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : tone === "brand" ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50")}>
                  <p className={cx("font-display text-3xl font-extrabold", tone === "red" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : tone === "brand" ? "text-brand-700" : "text-slate-600")}>{v}</p>
                  <p className="mt-1 text-xs font-medium leading-snug text-slate-600">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* solution + loop */}
      <section id="solution" className="border-y border-brand-900/10 bg-white/70 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">How RAKSHA works</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display max-w-xl text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">One record. One referral loop. Every role accountable.</h2>
            </div>
          </Reveal>
          <Reveal className="mt-8">
            <RefLoopDemo />
          </Reveal>
          <Reveal className="mt-10">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                [<UploadCloud key="1" className="h-5 w-5" />, "Offline-first", "ASHA registers patients, records vitals and queues referrals with zero signal. Everything reconciles when the network returns — no data loss, no duplicate histories."],
                [<Route key="2" className="h-5 w-5" />, "Closed-loop referrals", "CREATED → SENT → ACKNOWLEDGED → ACCEPTED → ARRIVED → CONSULTATION → TREATMENT → COMPLETED → FOLLOW-UP. Overdue and unacknowledged referrals raise automatic alerts."],
                [<ShieldCheck key="3" className="h-5 w-5" />, "Consent & audit", "Every record access is logged with actor, time and purpose. Consent status travels with the patient. RBAC is enforced in the service layer, not by hiding buttons."],
              ].map(([icon, title, body], i) => (
                <div key={i} className="rounded-2xl border border-brand-900/10 bg-white p-5 shadow-card transition-transform hover:-translate-y-1">
                  <span className="inline-flex rounded-lg bg-brand-100 p-2.5 text-brand-700">{icon}</span>
                  <h3 className="font-display mt-3 text-lg font-bold text-brand-950">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* AI triage interactive */}
      <section id="ai" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">AI as decision support</p>
          <h2 className="font-display max-w-2xl text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">Try the transparent risk engine — move a slider.</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-slate-600">
            RAKSHA's triage service explains every category it assigns. It never names a diagnosis — it surfaces risk signals and recommends a level of care.
            Thresholds are configurable in one place (<span className="font-mono text-xs">triage_service</span>), and a clinician confirms each result.
          </p>
        </Reveal>
        <Reveal className="mt-8"><TriageDemo /></Reveal>
      </section>

      {/* honesty */}
      <section id="honesty" className="border-t border-brand-900/10 bg-white/70 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-clay-600">Prototype honesty</p>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-950 sm:text-4xl">Exactly what is real, and what is ready.</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HONESTY.map(h => (
              <Reveal key={h.tag}>
                <div className="h-full rounded-2xl border border-brand-900/10 bg-white p-5 shadow-card">
                  <Pill tone={h.tone}>{h.tag}</Pill>
                  <ul className="mt-3 space-y-2">
                    {h.items.map(it => (
                      <li key={it} className="flex items-start gap-2 text-[13px] leading-snug text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-clay-600" />
                <p className="text-sm font-medium text-brand-900">ABDM, FHIR, eSanjeevani, FCM and SMS gateway ship as isolated adapters — live only when real credentials are configured. Nothing fake is presented as real.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand-950 py-16 text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 text-emerald-400/40"><Ecg className="h-16 w-full" /></div>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 pt-8 sm:px-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Step into the demo as any of 8 roles.</h2>
            <p className="mt-2 max-w-xl text-[15px] text-brand-300">
              Register a patient as an ASHA, flag HIGH risk, refer to the CHC, escalate to the district hospital, close the loop — and watch the analytics update live.
            </p>
          </div>
          <Link to="/login" className="shrink-0">
            <Btn size="lg" variant="warning" className="text-brand-950">{t("exploreDemo")} <ArrowRight className="h-4 w-4" /></Btn>
          </Link>
        </div>
      </section>

      <footer className="border-t border-brand-900/10 bg-paper py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <div>
              <p className="font-display text-sm font-extrabold text-brand-950">RAKSHA</p>
              <p className="text-[11px] text-slate-500">{t("tagline")}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Smart India Hackathon 2026 · Prototype with seeded demo data · Not for clinical use</p>
        </div>
      </footer>
    </div>
  );
}
