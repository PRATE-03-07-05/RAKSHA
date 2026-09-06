"""Evaluation metrics for the triage classifier.

Because this is a triage tool, missing an urgent case is more concerning than
raising a false alarm. Alongside overall accuracy and macro-F1 we therefore
report **urgent recall** (sensitivity on HIGH + CRITICAL) and use a blended
selection score that rewards it during model comparison.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_recall_fscore_support)

URGENT_CLASSES = {"HIGH", "CRITICAL"}

# Selection blend: mostly macro-F1, with a strong weight on urgent recall.
_MACRO_F1_WEIGHT = 0.6
_URGENT_RECALL_WEIGHT = 0.4


def urgent_recall(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Sensitivity on the union of HIGH and CRITICAL (the urgent cases)."""
    urgent_true = np.isin(y_true, list(URGENT_CLASSES))
    urgent_pred = np.isin(y_pred, list(URGENT_CLASSES))
    denom = urgent_true.sum()
    if denom == 0:
        return 1.0
    return float((urgent_true & urgent_pred).sum() / denom)


def blended_selection_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    ur = urgent_recall(y_true, y_pred)
    return _MACRO_F1_WEIGHT * macro_f1 + _URGENT_RECALL_WEIGHT * ur


def build_metrics(y_true: np.ndarray, y_pred: np.ndarray, classes: list[str]) -> dict:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=classes, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=classes)
    per_class = {
        cls: {
            "precision": round(float(precision[i]), 4),
            "recall": round(float(recall[i]), 4),
            "f1": round(float(f1[i]), 4),
            "support": int(support[i]),
        }
        for i, cls in enumerate(classes)
    }
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "weighted_f1": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "urgent_recall_high_critical": round(urgent_recall(y_true, y_pred), 4),
        "per_class": per_class,
        "confusion_matrix": {
            "labels": classes,
            "matrix": cm.tolist(),
        },
    }
