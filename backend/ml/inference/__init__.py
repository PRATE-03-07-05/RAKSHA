"""Inference: load the persisted pipeline and produce explained predictions."""
from .loader import MLResult, is_ml_available, model_info, predict_record

__all__ = ["MLResult", "is_ml_available", "model_info", "predict_record"]
