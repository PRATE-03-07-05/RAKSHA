"""Dataset tooling for the ML triage prototype.

IMPORTANT PROVENANCE NOTE
=========================
The generator in this package produces a SYNTHETIC, development-only dataset.
It is NOT real clinical data and must never be presented as such. It exists so
the full train -> evaluate -> persist -> infer pipeline can be exercised
end-to-end and reproducibly.

To train on a real, appropriately-licensed public dataset instead, supply a
CSV matching the documented schema (see ml/data/README.md) via:

    python -m ml.training.train --data path/to/your_dataset.csv
"""
from .generate import generate_dataset, main

__all__ = ["generate_dataset", "main"]
