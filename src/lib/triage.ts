/**
 * RAKSHA AI-assisted preliminary risk assessment.
 * Transparent, deterministic rule-set — thresholds are configurable HERE and nowhere else.
 * The engine never produces a diagnosis; it surfaces observed risk signals and
 * recommends a level of care. A qualified clinician always makes the final decision.
 */
import type { RiskLevel, TriageFactor } from "./types";

export const TRIAGE_THRESHOLDS = {
  spo2Critical: 90,
  spo2High: 94,
  tempHighF: 100.4,
  tempVeryHighF: 102.5,
  hrHigh: 120,
  hrElevated: 105,
  hrLow: 45,
  sysCritical: 180,
  sysHigh: 160,
  sysLow: 90,
  diaCritical: 110,
  diaHigh: 100,
  rrHigh: 28,
  ageInfant: 1,
  ageElder: 65,
};

export const RULE_VERSION = "RAKSHA-TRIAGE v1.3.0 · deterministic rule-set";

export interface TriageInput {
  symptoms: string[];
  sys?: number; dia?: number; temp?: number; spo2?: number; hr?: number; rr?: number;
  age: number; pregnant?: boolean; conditions: string[];
  severity: "MILD" | "MODERATE" | "SEVERE";
}

export interface TriageResult {
  level: RiskLevel;
  factors: TriageFactor[];
  recommendation: string;
  suggestedFacilityType: "SUBCENTRE" | "PHC" | "CHC" | "DH";
  version: string;
}

const SYMPTOM_RULES: { match: string[]; label: string; severity: TriageFactor["severity"]; note: string }[] = [
  { match: ["chest pain"], label: "Chest pain reported", severity: "critical", note: "Requires immediate medical attention." },
  { match: ["unconscious", "drowsy", "not responding"], label: "Altered consciousness reported", severity: "critical", note: "Danger sign — urgent evaluation needed." },
  { match: ["convulsion", "fits"], label: "Convulsions reported", severity: "critical", note: "Danger sign — urgent evaluation needed." },
  { match: ["breathing difficulty", "breathless", "cant breathe"], label: "Breathing difficulty reported", severity: "high", note: "Respiratory symptoms detected. Clinical evaluation is recommended." },
  { match: ["bleeding"], label: "Active bleeding reported", severity: "high", note: "Requires prompt clinical assessment." },
  { match: ["severe headache"], label: "Severe headache reported", severity: "high", note: "Warrants clinical evaluation, especially with high BP or pregnancy." },
  { match: ["persistent vomiting", "cannot keep fluids"], label: "Persistent vomiting reported", severity: "warn", note: "Risk of dehydration — evaluation advised." },
  { match: ["high fever", "fever"], label: "Fever reported", severity: "warn", note: "Monitor temperature; evaluate if persistent." },
  { match: ["cough"], label: "Cough reported", severity: "info", note: "Common symptom; assess with other signs." },
  { match: ["diarrhoea", "loose stools"], label: "Loose motions reported", severity: "warn", note: "ORS advised; watch for dehydration." },
  { match: ["swelling"], label: "Swelling reported", severity: "warn", note: "Evaluate alongside BP and urine output." },
  { match: ["reduced urine", "less urine"], label: "Reduced urine output reported", severity: "warn", note: "Possible dehydration or renal concern." },
  { match: ["weakness", "fatigue"], label: "Weakness / fatigue reported", severity: "info", note: "Non-specific; correlate with vitals." },
  { match: ["abdominal pain"], label: "Abdominal pain reported", severity: "warn", note: "Clinical examination recommended." },
];

const RECOMMENDATIONS: Record<RiskLevel, { text: string; facility: TriageResult["suggestedFacilityType"] }> = {
  CRITICAL: { text: "Immediate emergency evaluation required. Arrange transport to an emergency facility and alert the receiving team in advance.", facility: "DH" },
  HIGH: { text: "Priority clinical evaluation recommended. Referral to a higher facility should be considered without delay.", facility: "CHC" },
  MEDIUM: { text: "Same-day evaluation by a Medical Officer at the PHC is advised.", facility: "PHC" },
  LOW: { text: "No danger signs detected. Home-care advice with routine follow-up is sufficient.", facility: "SUBCENTRE" },
};

export function assessRisk(input: TriageInput): TriageResult {
  const T = TRIAGE_THRESHOLDS;
  const factors: TriageFactor[] = [];
  const norm = input.symptoms.map(s => s.toLowerCase());
  const has = (...keys: string[]) => norm.some(s => keys.some(k => s.includes(k)));

  if (input.spo2 !== undefined && input.spo2 > 0) {
    if (input.spo2 < T.spo2Critical) factors.push({ label: "Very low oxygen saturation", detail: `SpO₂ ${input.spo2}% is below ${T.spo2Critical}%.`, severity: "critical" });
    else if (input.spo2 < T.spo2High) factors.push({ label: "Low oxygen saturation", detail: `SpO₂ ${input.spo2}% is below ${T.spo2High}%.`, severity: "high" });
  }
  if (input.temp !== undefined && input.temp > 0) {
    if (input.temp >= T.tempVeryHighF) factors.push({ label: "High-grade fever", detail: `Temperature ${input.temp}°F exceeds ${T.tempVeryHighF}°F.`, severity: "high" });
    else if (input.temp >= T.tempHighF) factors.push({ label: "Elevated temperature", detail: `Temperature ${input.temp}°F exceeds ${T.tempHighF}°F.`, severity: "warn" });
  }
  if (input.hr !== undefined && input.hr > 0) {
    if (input.hr > T.hrHigh) factors.push({ label: "Markedly fast heart rate", detail: `Heart rate ${input.hr}/min exceeds ${T.hrHigh}/min.`, severity: "high" });
    else if (input.hr > T.hrElevated) factors.push({ label: "Elevated heart rate", detail: `Heart rate ${input.hr}/min exceeds ${T.hrElevated}/min.`, severity: "warn" });
    else if (input.hr < T.hrLow) factors.push({ label: "Very slow heart rate", detail: `Heart rate ${input.hr}/min is below ${T.hrLow}/min.`, severity: "high" });
  }
  if (input.sys !== undefined && input.sys > 0) {
    if (input.sys >= T.sysCritical || (input.dia !== undefined && input.dia >= T.diaCritical))
      factors.push({ label: "Severely elevated blood pressure", detail: `BP ${input.sys}/${input.dia ?? "–"} mmHg is in the severe range.`, severity: "high" });
    else if (input.sys >= T.sysHigh || (input.dia !== undefined && input.dia >= T.diaHigh))
      factors.push({ label: "Elevated blood pressure", detail: `BP ${input.sys}/${input.dia ?? "–"} mmHg exceeds ${T.sysHigh}/${T.diaHigh}.`, severity: "warn" });
    else if (input.sys < T.sysLow)
      factors.push({ label: "Low blood pressure", detail: `Systolic ${input.sys} mmHg is below ${T.sysLow}.`, severity: "high" });
  }
  if (input.rr !== undefined && input.rr > 0 && input.rr > T.rrHigh)
    factors.push({ label: "Fast breathing rate", detail: `Respiratory rate ${input.rr}/min exceeds ${T.rrHigh}/min.`, severity: "high" });

  for (const rule of SYMPTOM_RULES) {
    if (rule.match.some(k => has(k))) factors.push({ label: rule.label, detail: rule.note, severity: rule.severity });
  }

  if (input.pregnant && (has("bleeding") || has("severe headache") || has("swelling") || has("reduced urine")))
    factors.push({ label: "Possible danger sign in pregnancy", detail: "Reported symptoms during pregnancy require urgent obstetric review.", severity: "high" });

  if (input.conditions.some(c => /diabet|hypertens|heart|asthma|copd|kidney/i.test(c)) && factors.length > 0)
    factors.push({ label: "Pre-existing condition", detail: `Known ${input.conditions.filter(c => /diabet|hypertens|heart|asthma|copd|kidney/i.test(c)).join(", ")} may worsen outcomes.`, severity: "warn" });

  const sev = { critical: 0, high: 0, warn: 0, info: 0 };
  factors.forEach(f => { sev[f.severity] += 1; });

  let level: RiskLevel = "LOW";
  if (sev.critical > 0 || input.severity === "SEVERE" && sev.high > 0) level = "CRITICAL";
  else if (sev.high > 0 || sev.warn >= 2) level = "HIGH";
  else if (sev.warn === 1) level = "MEDIUM";

  if (input.severity === "SEVERE" && (level === "LOW" || level === "MEDIUM")) {
    level = "HIGH";
    factors.push({ label: "Severity reported as SEVERE", detail: "Reported severity raises the preliminary risk category.", severity: "high" });
  }

  if ((input.age < T.ageInfant || input.age >= T.ageElder) && level !== "LOW") {
    factors.push({ label: input.age < T.ageInfant ? "Infant age group" : "Elderly age group", detail: `Age ${input.age} increases vulnerability to deterioration.`, severity: "info" });
    if (level === "MEDIUM") level = "HIGH";
    else if (level === "HIGH" && input.age >= T.ageElder && sev.high > 0) level = level;
  }

  if (factors.length === 0) factors.push({ label: "No risk signals detected", detail: "Reported observations are within configured normal ranges.", severity: "info" });

  const rec = RECOMMENDATIONS[level];
  return { level, factors, recommendation: rec.text, suggestedFacilityType: rec.facility, version: RULE_VERSION };
}

export const SYMPTOM_OPTIONS = [
  "Fever", "High fever", "Cough", "Breathing difficulty", "Chest pain", "Severe headache",
  "Abdominal pain", "Persistent vomiting", "Diarrhoea / loose stools", "Swelling (feet/face)",
  "Reduced urine output", "Weakness / fatigue", "Bleeding", "Convulsions / fits",
  "Unconscious / drowsy", "Cannot keep fluids down",
];
