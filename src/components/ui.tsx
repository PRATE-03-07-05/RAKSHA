/** RAKSHA UI primitives — buttons, cards, badges, forms, modal, states. */
import React, { useEffect } from "react";
import { X, Loader2, Inbox } from "lucide-react";
import { cx, initials } from "../lib/utils";
import { useI18n } from "../store/providers";
import type { Availability, RefStatus, RiskLevel } from "../lib/types";

/* ------------------------------------------------------------- buttons */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "warning" | "dark";
export function Btn({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 active:scale-[0.98] shadow-sm",
    secondary: "bg-white text-brand-900 border border-brand-200 hover:border-brand-400 hover:bg-brand-50 active:scale-[0.98]",
    ghost: "text-brand-800 hover:bg-brand-100/70",
    danger: "bg-rose-700 text-white hover:bg-rose-800 active:scale-[0.98]",
    warning: "bg-clay-500 text-white hover:bg-clay-600 active:scale-[0.98]",
    dark: "bg-brand-950 text-brand-100 hover:bg-brand-900 active:scale-[0.98]",
  };
  const s = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-5 py-3.5 text-base" }[size];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none", v[variant], s, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- cards */

export function Card({ title, action, children, className, pad = true }:
  { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-brand-900/10 bg-white shadow-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-brand-900/8 px-5 py-3.5">
          <h3 className="font-display text-[15px] font-semibold tracking-tight text-brand-950">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, sub, icon, tone = "brand", onClick }:
  { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode; tone?: "brand" | "amber" | "red" | "sky" | "slate"; onClick?: () => void }) {
  const tones = {
    brand: "bg-brand-100 text-brand-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    sky: "bg-sky-100 text-sky-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <button onClick={onClick} disabled={!onClick} className={cx("w-full rounded-xl border border-brand-900/10 bg-white p-4 text-left shadow-card transition-all", onClick && "hover:-translate-y-0.5 hover:shadow-pop cursor-pointer")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && <span className={cx("rounded-lg p-1.5", tones[tone])}>{icon}</span>}
      </div>
      <p className="font-display mt-1 text-[28px] font-bold leading-none tabular text-brand-950">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
    </button>
  );
}

/* -------------------------------------------------------------- badges */

export function Pill({ tone = "slate", children, pulse }: { tone?: "green" | "amber" | "red" | "sky" | "slate" | "brand" | "clay"; children: React.ReactNode; pulse?: boolean }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-rose-50 text-rose-800 border-rose-200",
    sky: "bg-sky-50 text-sky-800 border-sky-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    clay: "bg-orange-50 text-orange-800 border-orange-200",
  };
  const dots = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-rose-500", sky: "bg-sky-500", slate: "bg-slate-400", brand: "bg-brand-500", clay: "bg-orange-500" };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone])}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dots[tone], pulse && "pulse-dot")} />
      {children}
    </span>
  );
}

export function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" | "lg" }) {
  const { t } = useI18n();
  const map: Record<RiskLevel, { tone: "green" | "amber" | "clay" | "red"; label: string }> = {
    LOW: { tone: "green", label: t("low") },
    MEDIUM: { tone: "amber", label: t("medium") },
    HIGH: { tone: "clay", label: t("high") },
    CRITICAL: { tone: "red", label: t("critical") },
  };
  const m = map[level];
  if (!m) return <Pill tone="slate">{level}</Pill>;
  return <Pill tone={m.tone} pulse={level === "CRITICAL"}>{m.label}</Pill>;
}

export const REF_TONE: Record<RefStatus, "slate" | "sky" | "brand" | "amber" | "green" | "red"> = {
  CREATED: "slate", SENT: "sky", ACKNOWLEDGED: "sky", ACCEPTED: "brand", ARRIVED: "brand",
  IN_CONSULTATION: "amber", TREATMENT: "amber", COMPLETED: "green", CANCELLED: "red",
};

export function RefStatusBadge({ status, overdue }: { status: RefStatus; overdue?: boolean }) {
  const { t } = useI18n();
  const label: Record<RefStatus, string> = {
    CREATED: t("stCreated"), SENT: t("stSent"), ACKNOWLEDGED: t("stAcknowledged"), ACCEPTED: t("stAccepted"),
    ARRIVED: t("stArrived"), IN_CONSULTATION: t("stInConsultation"), TREATMENT: t("stTreatment"),
    COMPLETED: t("stCompleted"), CANCELLED: t("stCancelled"),
  };
  if (overdue) return <Pill tone="red" pulse>{label[status]} · {t("overdue")}</Pill>;
  return <Pill tone={REF_TONE[status]}>{label[status]}</Pill>;
}

export function AvailBadge({ status }: { status: Availability }) {
  const { t } = useI18n();
  if (status === "AVAILABLE") return <Pill tone="green">{t("available")}</Pill>;
  if (status === "LIMITED") return <Pill tone="amber">{t("limited")}</Pill>;
  return <Pill tone="red">{t("unavailable")}</Pill>;
}

/* ---------------------------------------------------------------- forms */

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-brand-900/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, "min-h-[90px]", props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "appearance-none bg-no-repeat pr-9", props.className)} style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23475569%22 stroke-width=%222.5%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')", backgroundPosition: "right 12px center", ...props.style }} />;
}

/* ---------------------------------------------------------------- modal */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-brand-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={cx("anim-fade-up max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} onClick={e => e.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-900/10 bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold text-brand-950">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- states */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-500">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
      <span className="text-sm">{label ?? "Loading…"}</span>
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-brand-900/20 bg-brand-50/40 px-6 py-12 text-center">
      <span className="text-brand-300">{icon ?? <Inbox className="h-8 w-8" />}</span>
      <p className="font-display font-semibold text-brand-900">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: React.ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-rose-300 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={cx("rounded-lg border px-4 py-3 text-sm font-medium", tones[tone])}>{children}</div>;
}

/* ----------------------------------------------------------------- misc */

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cx("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-display text-xs font-bold text-brand-50", className)}>
      {initials(name)}
    </span>
  );
}

export function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-brand-900/10 py-1.5 last:border-0">
      <span className="text-xs font-medium text-slate-500">{k}</span>
      <span className={cx("text-right text-sm font-semibold text-brand-950", mono && "font-mono text-xs")}>{v}</span>
    </div>
  );
}

export function SectionHead({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-clay-600">{kicker}</p>}
        <h2 className="font-display text-xl font-bold tracking-tight text-brand-950 sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "amber" | "red" }) {
  const t = { brand: "bg-brand-600", amber: "bg-amber-500", red: "bg-rose-600" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-brand-900/10">
      <div className={cx("h-full rounded-full transition-all duration-700", t)} style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
    </div>
  );
}
