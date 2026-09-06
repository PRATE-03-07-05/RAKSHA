"""Training CLI for the RAKSHA triage decision-support model.

Compares interpretable baselines (Logistic Regression, Random Forest,
HistGradientBoosting) with stratified k-fold cross-validation, selects the
best model on a blend of macro-F1 and urgent-case recall, refits it on the
training split, evaluates it on a held-out test split, and persists the
full preprocessing+model pipeline with joblib.

Run (from the ``backend`` directory):
    python -m ml.training.train --synthetic            # train on the synthetic set
    python -m ml.training.train --data my_dataset.csv  # train on a real CSV
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, make_scorer
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split

from ..data.generate import generate_dataset
from ..evaluation.metrics import blended_selection_score, build_metrics
from ..paths import (CONFUSION_PATH, DEFAULT_SYNTHETIC_CSV, METRICS_PATH,
                     MODELS_DIR, REPORT_PATH, ensure_models_dir)
from ..preprocessing.features import CLASS_NAMES, FEATURE_NAMES
from ..preprocessing.pipeline import build_pipeline

MODEL_VERSION = "1.0.0"
ARTIFACT_PATH = MODELS_DIR / "triage_model.joblib"


def _candidates(seed: int) -> dict[str, object]:
    return {
        # Interpretable baseline.
        "logistic_regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=seed),
        # Strong, still inspectable via feature_importances_.
        "random_forest": RandomForestClassifier(
            n_estimators=300, class_weight="balanced", random_state=seed, n_jobs=-1),
        # Gradient boosting (no class_weight; relies on the blend to guard urgent recall).
        "hist_gradient_boosting": HistGradientBoostingClassifier(random_state=seed),
    }


def _load(args: argparse.Namespace) -> tuple[pd.DataFrame, str]:
    if args.data:
        df = pd.read_csv(args.data)
        source = args.data
    elif args.synthetic or not DEFAULT_SYNTHETIC_CSV.exists():
        df = generate_dataset(rows=args.rows, seed=args.seed)
        source = "SYNTHETIC (development only)"
    else:
        df = pd.read_csv(DEFAULT_SYNTHETIC_CSV)
        source = str(DEFAULT_SYNTHETIC_CSV)

    missing = [c for c in FEATURE_NAMES + ["level"] if c not in df.columns]
    if missing:
        raise SystemExit(f"[train] dataset is missing required columns: {missing}")
    df = df.dropna(subset=["level"])
    df["level"] = df["level"].astype(str).str.upper()
    df = df[df["level"].isin(CLASS_NAMES)]
    return df, source


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the RAKSHA triage model.")
    parser.add_argument("--data", type=str, default=None, help="Path to a CSV dataset.")
    parser.add_argument("--synthetic", action="store_true", help="Generate & use the synthetic set.")
    parser.add_argument("--rows", type=int, default=4000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--cv-folds", type=int, default=5)
    args = parser.parse_args()

    df, source = _load(args)
    X = df[FEATURE_NAMES]
    y = df["level"].to_numpy()
    print(f"[train] dataset: {source} | rows={len(df)}")
    print(f"[train] class distribution: {pd.Series(y).value_counts().to_dict()}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, stratify=y, random_state=args.seed)

    scorer = make_scorer(
        lambda est, Xv, yv: blended_selection_score(yv, est.predict(Xv)),
        greater_is_better=True)
    cv = StratifiedKFold(n_splits=args.cv_folds, shuffle=True, random_state=args.seed)

    print(f"[train] {args.cv_folds}-fold stratified CV "
          f"(score = 0.6*macroF1 + 0.4*urgentRecall):")
    cv_results: dict[str, dict[str, float]] = {}
    best_name, best_score = None, -1.0
    for name, clf in _candidates(args.seed).items():
        pipe = build_pipeline(clf)
        scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring=scorer, n_jobs=-1)
        cv_results[name] = {"mean": round(float(scores.mean()), 4),
                            "std": round(float(scores.std()), 4)}
        print(f"[train]   {name:24s} mean={scores.mean():.4f} (+/- {scores.std():.4f})")
        if scores.mean() > best_score:
            best_name, best_score = name, float(scores.mean())

    print(f"[train] selected: {best_name} (CV blend {best_score:.4f})")
    final_pipe = build_pipeline(_candidates(args.seed)[best_name])
    final_pipe.fit(X_train, y_train)

    y_pred = final_pipe.predict(X_test)
    metrics = build_metrics(y_test, y_pred, CLASS_NAMES)
    report_txt = classification_report(y_test, y_pred, labels=CLASS_NAMES, zero_division=0)

    ensure_models_dir()
    artifact = {
        "pipeline": final_pipe,
        "classes": CLASS_NAMES,
        "feature_names": FEATURE_NAMES,
        "model_name": best_name,
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {"source": source, "rows": int(len(df)), "seed": args.seed},
        "cv_results": cv_results,
        "test_metrics": metrics,
    }
    joblib.dump(artifact, ARTIFACT_PATH)
    METRICS_PATH.write_text(json.dumps(
        {"model_name": best_name, "model_version": MODEL_VERSION,
         "cv_results": cv_results, "test": metrics}, indent=2))
    REPORT_PATH.write_text(report_txt)
    CONFUSION_PATH.write_text(json.dumps(metrics["confusion_matrix"], indent=2))

    print(f"[train] artifact -> {ARTIFACT_PATH}")
    print(f"[train] test accuracy={metrics['accuracy']} macroF1={metrics['macro_f1']} "
          f"urgentRecall(HIGH+CRITICAL)={metrics['urgent_recall_high_critical']}")
    print(report_txt)


if __name__ == "__main__":
    main()
