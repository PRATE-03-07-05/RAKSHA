"""Evaluation CLI.

Without arguments it prints the metrics recorded at training time (the
held-out test split). With ``--data`` it recomputes metrics on any CSV that
matches the documented schema.

Run (from the ``backend`` directory):
    python -m ml.evaluation.evaluate
    python -m ml.evaluation.evaluate --data ml/data/triage_synthetic.csv
"""
from __future__ import annotations

import argparse
import json

import joblib
import pandas as pd
from sklearn.metrics import classification_report

from ..evaluation.metrics import build_metrics
from ..paths import ARTIFACT_PATH, METRICS_PATH
from ..preprocessing.features import CLASS_NAMES, FEATURE_NAMES


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the persisted triage model.")
    parser.add_argument("--data", type=str, default=None)
    args = parser.parse_args()

    if not ARTIFACT_PATH.exists():
        raise SystemExit("[eval] no trained model found — run `python -m ml.training.train` first.")

    artifact = joblib.load(ARTIFACT_PATH)
    print(f"[eval] model: {artifact['model_name']}@{artifact['model_version']} "
          f"(trained {artifact['trained_at']})")

    if args.data is None:
        stored = json.loads(METRICS_PATH.read_text())
        print("[eval] stored held-out test metrics:")
        print(json.dumps(stored["test"], indent=2))
        return

    df = pd.read_csv(args.data)
    missing = [c for c in FEATURE_NAMES + ["level"] if c not in df.columns]
    if missing:
        raise SystemExit(f"[eval] dataset missing columns: {missing}")
    df = df.dropna(subset=["level"])
    df = df[df["level"].astype(str).str.upper().isin(CLASS_NAMES)]
    X, y = df[FEATURE_NAMES], df["level"].astype(str).str.upper().to_numpy()

    y_pred = artifact["pipeline"].predict(X)
    metrics = build_metrics(y, y_pred, CLASS_NAMES)
    print(f"[eval] rows={len(df)} accuracy={metrics['accuracy']} "
          f"macroF1={metrics['macro_f1']} urgentRecall={metrics['urgent_recall_high_critical']}")
    print(classification_report(y, y_pred, labels=CLASS_NAMES, zero_division=0))


if __name__ == "__main__":
    main()
