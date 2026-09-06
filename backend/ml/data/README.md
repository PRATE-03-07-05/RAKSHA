# RAKSHA ML Triage — Dataset

## Data source

**The default dataset is SYNTHETIC and for development only.** It is generated
by `generate.py` with a fixed seed and must never be presented as real
clinical data or used to make clinical claims.

To use a real, appropriately-licensed public dataset instead, place a CSV with
the schema below anywhere and pass it to training:

```bash
python -m ml.training.train --data path/to/your_dataset.csv
```

## Required CSV schema

Columns (order-independent, but all must be present) plus one target column:

| Column | Type | Notes |
|---|---|---|
| `age` | number | years, 0–120 |
| `spo2` | number | %, 50–100 (blank = missing) |
| `respiratory_rate` | number | breaths/min (blank = missing) |
| `temperature` | number | °C (blank = missing) |
| `heart_rate` | number | bpm (blank = missing) |
| `cough` | 0/1 | |
| `breathing_difficulty` | 0/1 | |
| `chest_pain` | 0/1 | |
| `duration_days` | number | symptom duration (blank = missing) |
| `pregnant` | 0/1 | |
| `has_chronic_condition` | 0/1 | diabetes / hypertension / asthma / COPD / TB / cardiac |
| `severity_reported` | `MILD` \| `MODERATE` \| `SEVERE` | self-reported |
| **`level`** (target) | `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL` | matches the RAKSHA triage vocabulary |

Missing numeric values may be blank/`NaN` — the persisted preprocessing
pipeline imputes them (median) identically at training and inference time.

## Features / target

- **Features:** the 12 columns above — only values the RAKSHA frontend
  actually collects (no invented inputs).
- **Target:** `level`, a 4-class triage risk category (not a diagnosis).

## Regenerate the synthetic set

```bash
python -m ml.data.generate --rows 4000 --seed 42 --out ml/data/triage_synthetic.csv
```

A `.meta.json` sidecar records provenance, seed, schema and class
distribution for full reproducibility and honest reporting.
