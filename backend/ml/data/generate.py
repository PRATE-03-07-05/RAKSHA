"""SYNTHETIC, development-only dataset generator.

This is NOT real clinical data. It is a clearly-labeled synthetic corpus whose
label is a transparent, monotone function of the features (a latent "acuity"
score), so the pipeline can be trained, evaluated and demonstrated
reproducibly without touching any real patient information.

The generator is deterministic (seeded) and produces the exact schema the
preprocessing module expects, with a realistic class imbalance
(~45% LOW, 30% MEDIUM, 17% HIGH, 8% CRITICAL).

Run:
    python -m ml.data.generate --rows 4000 --seed 42 --out ml/data/triage_synthetic.csv
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from ..preprocessing.features import CLASS_NAMES, FEATURE_NAMES, SEVERITY_VALUES

# Target class balance (fractions). CRITICAL is deliberately rare.
_CLASS_FRACTIONS = {"LOW": 0.45, "MEDIUM": 0.30, "HIGH": 0.17, "CRITICAL": 0.08}


def _sample_features(rng: np.random.Generator, n: int) -> pd.DataFrame:
    age = rng.integers(0, 91, n).astype(float)
    # Gender-aware pregnancy: only females 15-49 can be pregnant (~10% of them).
    _is_female_childbearing = (rng.random(n) < 0.5) & (age >= 15) & (age <= 49)
    _preg_rate = np.where(_is_female_childbearing, 0.20, 0.0)
    pregnant = (rng.random(n) < _preg_rate).astype(float)
    spo2 = np.clip(rng.normal(96.5, 2.6, n), 82, 100).round(0)
    respiratory_rate = np.clip(rng.normal(20, 5, n), 8, 60).round(0)
    temperature = np.clip(rng.normal(37.4, 0.9, n), 35.0, 41.5).round(1)
    heart_rate = np.clip(rng.normal(88, 18, n), 45, 190).round(0)
    cough = rng.binomial(1, 0.45, n).astype(float)
    breathing_difficulty = rng.binomial(1, 0.28, n).astype(float)
    chest_pain = rng.binomial(1, 0.12, n).astype(float)
    duration_days = rng.integers(0, 15, n).astype(float)
    has_chronic = rng.binomial(1, 0.25, n).astype(float)
    severity = rng.choice(len(SEVERITY_VALUES), n, p=[0.5, 0.35, 0.15])
    return pd.DataFrame({
        "age": age, "spo2": spo2, "respiratory_rate": respiratory_rate,
        "temperature": temperature, "heart_rate": heart_rate, "cough": cough,
        "breathing_difficulty": breathing_difficulty, "chest_pain": chest_pain,
        "duration_days": duration_days, "pregnant": pregnant,
        "has_chronic_condition": has_chronic,
        "severity_reported": pd.Series([SEVERITY_VALUES[i] for i in severity]),
    })


def _acuity(df: pd.DataFrame, rng: np.random.Generator) -> np.ndarray:
    """Latent risk score — a transparent, monotone function of the features."""
    a = np.zeros(len(df))
    a += np.clip(95 - df["spo2"], 0, None) * 1.3          # hypoxia dominates
    a += (df["spo2"] < 90) * 4.0
    a += np.clip(df["respiratory_rate"] - 22, 0, None) * 0.45
    a += np.clip(df["temperature"] - 37.8, 0, None) * 1.6
    a += np.clip(df["heart_rate"] - 105, 0, None) * 0.25
    a += df["breathing_difficulty"] * 3.2
    a += df["chest_pain"] * 2.6
    a += df["cough"] * 0.8
    a += df["duration_days"] * 0.12
    a += np.clip(df["age"] - 55, 0, None) * 0.05
    a += (df["age"] < 2) * 2.0
    a += df["pregnant"] * 1.0
    a += df["has_chronic_condition"] * 1.3
    a += df["severity_reported"].map({"MILD": 0.0, "MODERATE": 1.6, "SEVERE": 3.2})
    a += rng.normal(0, 0.9, len(df))                        # irreducible noise
    return a


def generate_dataset(rows: int = 4000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    df = _sample_features(rng, rows)
    acuity = _acuity(df, rng)

    # Quantile thresholds => exact, reproducible class imbalance.
    cuts = np.quantile(acuity, [1 - _CLASS_FRACTIONS["LOW"] - _CLASS_FRACTIONS["MEDIUM"]
                                - _CLASS_FRACTIONS["HIGH"],
                                1 - _CLASS_FRACTIONS["HIGH"] - _CLASS_FRACTIONS["CRITICAL"],
                                1 - _CLASS_FRACTIONS["CRITICAL"]])
    level = np.select(
        [acuity <= cuts[0], acuity <= cuts[1], acuity <= cuts[2]],
        ["LOW", "MEDIUM", "HIGH"], default="CRITICAL")
    df["level"] = level
    return df[FEATURE_NAMES + ["level"]]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the SYNTHETIC RAKSHA triage dataset.")
    parser.add_argument("--rows", type=int, default=4000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default="ml/data/triage_synthetic.csv")
    args = parser.parse_args()

    df = generate_dataset(rows=args.rows, seed=args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)

    meta = {
        "provenance": "SYNTHETIC — development only. Not real clinical data.",
        "rows": int(args.rows),
        "seed": int(args.seed),
        "features": FEATURE_NAMES,
        "target": "level",
        "classes": CLASS_NAMES,
        "class_distribution": df["level"].value_counts(normalize=True).round(3).to_dict(),
    }
    (out.with_suffix(".meta.json")).write_text(json.dumps(meta, indent=2))
    print(f"[data] wrote {out} ({len(df)} rows) + {out.with_suffix('.meta.json')}")
    print(f"[data] class distribution: {meta['class_distribution']}")


if __name__ == "__main__":
    main()
