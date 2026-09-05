# AI Evaluation

Last Updated: 2026-09-04

## Current Evaluation Status

Status: STRUCTURE_AND_SAFETY_CONTRACT_ONLY

Implemented baseline: `raksha-respiratory-risk-logistic-baseline`

Model version: `2026-09-04.v0`

Clinical validation status: Not clinically validated.

The Session 05 respiratory risk triage baseline is deterministic clinical decision-support scaffolding. It uses transparent logistic-style scoring with hard safety overrides for entered emergency warning signs. It does not use real patient training data, does not diagnose disease, does not prescribe treatment, and must not be used autonomously.

## Intended Use

The baseline identifies acute respiratory presentations that require prompt professional review. Every response requires human review before any clinical decision.

## Out Of Scope

- Autonomous diagnosis.
- Treatment or prescribing decisions.
- Referral cancellation or workflow override.
- Production clinical validation claims.
- Replacement of local clinical protocols.

## Source Guidance Used For Initial Safety Signals

- CDC respiratory virus emergency warning signs for adults and children, including difficulty breathing, persistent chest or abdominal pain or pressure, confusion, inability to arouse, seizures, not urinating, severe weakness, worsening after improvement, fast breathing or trouble breathing in children, cyanosis, rib retractions, dehydration, and fever in children younger than 12 weeks.
- WHO COVID-19 clinical care pathway immediate or urgent reassessment signals, including emergency signs, SpO2 below 90%, SpO2 falling to 90-94%, symptom worsening, chest pain, fast or difficult breathing, fast heart rate, and confusion.
- WHO pneumonia and IMCI materials for child respiratory danger signs, including fast breathing, lower chest wall indrawing, inability to drink or feed, unconsciousness or lethargy, convulsions, cyanosis, severe respiratory distress, and SpO2 below 90%.

Reference URLs:

- https://www.cdc.gov/respiratory-viruses/about/index.html
- https://www.cdc.gov/covid/signs-symptoms/
- https://www.who.int/tools/covid-19-clinical-care-pathway
- https://www.who.int/en/news-room/fact-sheets/detail/pneumonia
- https://www.who.int/publications/i/item/9789240103412
- https://worldhealthorganization.github.io/smart-ccc/Questionnaire-Ccc.b22.respiratoryrate.html

## Current Synthetic Contract Coverage

Automated tests cover:

- SpO2 below 90% forces `URGENT` and human review.
- Age-specific child fast breathing produces prompt review.
- Missing critical inputs are included in structured output and reduce confidence.
- Manual-review fallback produces no automated score or confidence.
- Authenticated doctor role can create and persist a triage assessment.
- Patient role is denied because patient-scoped clinical authorization is not implemented yet.
- API fallback still returns a structured human-review response when the triage service is unavailable.

## Metrics Not Yet Available

No clinical sensitivity, specificity, precision, recall, F1, PR-AUC, ROC-AUC, or calibration metrics exist yet because no approved training or validation dataset has been introduced.

Before any clinical validation claim, a future session must add:

- Approved data source and governance documentation.
- Dataset versioning and split strategy.
- Baseline logistic regression training artifact.
- Calibration assessment.
- Error analysis across age bands and missing-vitals patterns.
- Human clinical review of feature definitions and thresholds.
- Comparison with at least one suitable tree-based model.

## Current Risk Controls

- All outputs include `clinical_decision_support_only: true`.
- All outputs include `human_review_required: true`.
- Response schema contains `diagnosis: null`.
- Response schema contains `treatment_recommendation: null`.
- Fallback output has `confidence: null` and `risk_score: null`.
- Triage assessments persist `model_name`, `model_version`, confidence when present, explanation, structured output, and human-review requirement.
