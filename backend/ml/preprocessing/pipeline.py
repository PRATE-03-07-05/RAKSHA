"""sklearn pipeline construction.

The preprocessing object is embedded INSIDE the persisted ``Pipeline``
(``pre`` -> ``clf``), so the inference server applies byte-for-byte the same
imputation, encoding and scaling that were fitted during training. Nothing is
re-implemented at inference time.
"""
from __future__ import annotations

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

from .features import NUMERIC_FEATURES, SEVERITY_VALUES

_CATEGORICAL = ["severity_reported"]


def build_preprocessor() -> ColumnTransformer:
    numeric = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        # Fixed ordinal mapping; unseen categories map to -1 rather than crash.
        ("encode", OrdinalEncoder(
            categories=[SEVERITY_VALUES],
            handle_unknown="use_encoded_value",
            unknown_value=-1.0,
        )),
    ])
    return ColumnTransformer([
        ("num", numeric, NUMERIC_FEATURES),
        ("cat", categorical, _CATEGORICAL),
    ])


def build_pipeline(classifier) -> Pipeline:
    """Wrap a classifier with the shared preprocessor (fits them together)."""
    return Pipeline([
        ("pre", build_preprocessor()),
        ("clf", classifier),
    ])
