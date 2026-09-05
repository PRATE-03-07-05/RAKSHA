# AI Specification

## Current State

Session 05 implements the first clinical decision-support scaffold:

- `POST /triage/respiratory-risk`
- `raksha-respiratory-risk-logistic-baseline`
- model version `2026-09-04.v0`
- structured output with risk level, score, confidence, explanation, safety flags, missing inputs, feature contributions, timestamp, and required human review
- manual-review fallback when the triage service is unavailable
- persistence through `triage_assessments`
- audit event `AI_RESPIRATORY_TRIAGE_ASSESSED`

This baseline is deterministic, transparent, guideline-informed scaffolding only. It is not trained on real patient data and is not clinically validated.

No LLM feature is implemented yet.

## Safety Rules

All future AI functionality must follow these rules:

- AI is clinical decision support only.
- AI must never autonomously diagnose.
- AI must never prescribe.
- AI must never modify official diagnoses.
- AI must never cancel referrals.
- AI must never override a healthcare professional.
- Clinical AI output must require human review.
- AI-generated summaries must be visibly distinct from clinician-authored records.
- LLM output must not invent clinical facts.

## Initial Clinical Decision-Support Use Case

Purpose:
Identify high-risk acute respiratory presentations requiring prompt professional review. This is risk support, not disease diagnosis.

Input Features:
Implemented request features:

- patient, encounter, and symptom-report IDs
- age in months
- cough, breathlessness, fever, chest pain, symptom duration, and worsening after improvement
- respiratory rate, oxygen saturation, temperature, and pulse
- emergency warning signs such as severe respiratory distress, cyanosis, altered mental status, seizures, inability to drink or feed, chest indrawing, persistent chest pain or pressure, not urinating, and severe weakness
- comorbidity labels such as asthma, COPD, chronic lung disease, heart disease, diabetes, immunocompromise, pregnancy, and chronic kidney disease
- missing-information indicators for age, respiratory rate, and SpO2

Output:
Structured risk result with risk level, confidence where appropriate, explanation, model name, model version, timestamp, and human-review requirement.

Model Type:
The Session 05 implementation is a transparent logistic-style baseline with hard safety overrides for emergency warning signs. A trained logistic regression artifact and tree-based comparison remain future work after approved data governance exists.

Training Dataset:
No training dataset is used yet. Synthetic contract tests validate output structure and safety behavior only.

Evaluation Metrics:
Sensitivity, specificity, precision, recall, F1, PR-AUC, ROC-AUC, and calibration.

Current metric status:
Not available. `docs/AI_EVALUATION.md` records the current safety-contract coverage and required future evaluation artifacts.

Explainability:
Clinician-suitable feature contribution or reason summary must accompany model output.

Fallback Behavior:
If the AI service is unavailable, the workflow must continue through manual review.

Implemented fallback:
`manual-review-fallback` returns a structured response with `confidence: null`, `risk_score: null`, `fallback_mode: true`, and `human_review_required: true`.

## Planned LLM Use Cases

Allowed LLM assistance:

- multilingual translation
- record summarization
- symptom extraction
- missing-information detection
- referral-summary drafting

Prohibited LLM behavior:

- inventing clinical facts
- replacing clinician judgment
- producing official diagnoses
- prescribing treatment
