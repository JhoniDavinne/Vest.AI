"""Motor de recomendacao VESTE.AI (puro, sem dependencia de HTTP/banco)."""

from .config import EngineConfig, get_engine_config
from .engine import RecommendationEngine
from .types import (
    BodyProfile,
    Category,
    Confidence,
    FitPreference,
    GarmentSize,
    GarmentSpec,
    Modeling,
    RecommendationResult,
    Region,
    RegionStatus,
    SizeEvaluation,
    VisualProportions,
)

__all__ = [
    "BodyProfile",
    "Category",
    "Confidence",
    "EngineConfig",
    "FitPreference",
    "GarmentSize",
    "GarmentSpec",
    "Modeling",
    "RecommendationEngine",
    "RecommendationResult",
    "Region",
    "RegionStatus",
    "SizeEvaluation",
    "VisualProportions",
    "get_engine_config",
]
