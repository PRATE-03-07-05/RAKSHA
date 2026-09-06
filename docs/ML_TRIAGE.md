# RAKSHA — ML Triage Decision-Support Pipeline

> **Prototype AI-assisted decision-support model.** It recommends a triage
> risk category and workflow. It does **not** diagnose disease and has no
> clinical validation. A qualified clinician always makes the final decision.

## 1. Problem definition

Classification (not regression): map the observations a field worker can
actually collect to one of RAKSHA's four existing triage categories —
`LOW`, `MEDIUM`, `HIGH`, `CRITICAL` — preserving the vocabulary the rule
engine already uses.

## 2. Dataset

- **Source:** `backend/ml/data/generate.py` — a **clearly labelled synthetic,
  development-only** dataset (seeded, reproducible, `.meta.json` provenance
  sidecar). It is *not* real clinical data and is never presented as such.
- **Using real data:** any CSV matching the schema in
  `backend/ml/data/README.md` can be supplied via `--data`; nothing else
  changes.
- **Size (default):** 4,000 rows; 80/20 stratified train/test split.
- **Class balance:** ~45% LOW / 30% MEDIUM / 17% HIGH / 8% CRITICAL
  (deliberate imbalance — urgent cases are rare, handled with
  `class_weight="balanced"` + a recall-weighted selection score).

## 3. Features (exactly what the app collects)

`age, spo2, respiratory_rate, temperature, heart_rate, cough,
breathing_difficulty, chest_pain, duration_days, pregnant,
has_chronic_condition, severity_reported` — 12 features, no invented inputs.

## 4. Preprocessing (single source of truth)

`ml/preprocessing/` builds one sklearn `ColumnTransformer`:
median imputation + standard scaling for numerics; most-frequent imputation +
fixed ordinal encoding for severity. The transformer is embedded **inside**
the persisted `Pipeline`, so training and inference use byte-identical
preprocessing — there is no duplicated logic.

## 5. Training (`python -m ml.training.train --synthetic`)

1. Load + validate the CSV (schema check, drop unknown levels).
2. Stratified 80/20 split (`random_state` fixed).
3. **5-fold Stratified CV** on the training split only, scoring
   `0.6 × macro-F1 + 0.4 × urgent-recall(HIGH+CRITICAL)` — model selection
   never sees the test split.
4. Candidates: Logistic Regression (interpretable baseline),
   Random Forest (`feature_importances_`), HistGradientBoosting.
5. Best candidate is refit on the full training split and evaluated once on
   the held-out test split.
6. Persisted via **joblib**: the whole pipeline + classes + feature names +
   model name/version + dataset provenance + CV results + test metrics →
   `backend/ml/models/triage_model.joblib` (gitignored, regenerable), with
   `model_metrics.json`, `classification_report.txt`,
   `confusion_matrix.json` alongside.

**All reported metrics are computed by the pipeline from the actual data at
training time — never written by hand.**

## 6. Inference (no per-patient retraining)

`POST /triage/assess` → `assess_with_fallback` → if the artifact exists,
`ml.inference.predict_record` runs the loaded pipeline **once per process**
(cached) and returns:

```json
{
  "risk_level": "HIGH",
  "mode": "ML_MODEL",
  "confidence": 0.82,
  "model_version": "1.0.0",
  "recommended_action": "URGENT_REFERRAL",
  "contributing_factors": [
    { "code": "SPO2", "label": "Oxygen saturation (SpO₂): 91.0", "weight": 31 },
    { "code": "RESPIRATORY_RATE", "label": "Respiratory rate: 28.0", "weight": 22 }
  ],
  "red_flags": ["Low oxygen saturation (SpO₂ 91%)"],
  "disclaimer": "AI-assisted preliminary assessment — not a medical diagnosis. …"
}
```

Retraining is a separate, explicit development/admin operation
(`python -m ml.training.train`); a new artifact is only deployed by replacing
the file after its own evaluation — the API never trains inside a request.

## 7. Explainability

Global, model-derived weights — `feature_importances_` for tree models,
|coefficients| of the predicted class for the linear model — ranked and
normalized per prediction, each labelled with the patient's actual value.
Plus hard red-flag checks on dangerous vitals. No SHAP dependency; no
invented explanations.

## 8. Fallback & visibility

- No artifact / no scikit-learn / any inference error → the transparent
  rule engine serves the request with `mode: "RULE_BASED_FALLBACK"`.
  The app never crashes and never pretends the rule result came from a model.
- `GET /triage/model` reports the active engine (`ML_MODEL` vs
  `RULE_BASED_FALLBACK`) for dev/debug visibility.
- Tests run with `RAKSHA_ML_DISABLED=1` for determinism.

## 9. Commands

```bash
cd backend
python -m ml.data.generate --rows 4000 --seed 42     # regenerate synthetic set
python -m ml.training.train --synthetic              # train (or --data my.csv)
python -m ml.evaluation.evaluate                     # stored test metrics
python -m ml.evaluation.evaluate --data my.csv       # recompute on any CSV
```

In Docker, the first `docker compose up` trains automatically if no artifact
exists (guarded — failure falls back to the rule engine and never blocks boot).

## 10. Limitations

- Trained on synthetic data ⇒ **no clinical performance claims**. Metrics
  describe behaviour on that dataset only.
- Explanations are global-importance indicators, not causal attribution.
- 4-class ordinal output; no calibration guarantees.
- See `docs/ML_VIVA.md` for the defence-style Q&A.
