"""RAKSHA ML triage decision-support pipeline.

An ML-based risk decision-support prototype for rural triage. This is NOT a
diagnostic tool — it recommends a risk category and workflow, and a qualified
clinician always makes the final decision.

Structure:
    ml/data/            synthetic (dev-only) dataset generator + schema docs
    ml/preprocessing/   reproducible feature extraction + sklearn pipeline
    ml/training/        training CLI (compare models, stratified CV, select)
    ml/evaluation/      evaluation CLI (metrics, confusion matrix, report)
    ml/inference/       model loading + prediction + explanation for FastAPI
    ml/models/          persisted artifacts (gitignored except .gitkeep)
"""

__all__ = ["preprocessing", "training", "evaluation", "inference"]
