"""Shared artifact locations for the ML pipeline."""
from __future__ import annotations

from pathlib import Path

# backend/ml/paths.py -> backend/ml -> backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND_DIR / "ml" / "models"
DATA_DIR = BACKEND_DIR / "ml" / "data"

ARTIFACT_PATH = MODELS_DIR / "triage_model.joblib"
METRICS_PATH = MODELS_DIR / "model_metrics.json"
REPORT_PATH = MODELS_DIR / "classification_report.txt"
CONFUSION_PATH = MODELS_DIR / "confusion_matrix.json"
DEFAULT_SYNTHETIC_CSV = DATA_DIR / "triage_synthetic.csv"


def ensure_models_dir() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
