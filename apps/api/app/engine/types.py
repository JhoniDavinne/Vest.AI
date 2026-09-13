"""Tipos de dominio do motor de recomendacao VESTE.AI.

O motor e puro: nao conhece HTTP, banco de dados nem frameworks.
Ele recebe medidas do corpo, especificacao da peca e (opcionalmente) proporcoes
visuais e devolve uma avaliacao explicavel por tamanho.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Region(str, Enum):
    CHEST = "chest"
    WAIST = "waist"
    HIP = "hip"
    SHOULDER = "shoulder"
    LENGTH = "length"


CIRCUMFERENCE_REGIONS = (Region.CHEST, Region.WAIST, Region.HIP)


class FitPreference(str, Enum):
    TIGHT = "tight"      # Justo
    REGULAR = "regular"  # Regular
    LOOSE = "loose"      # Solto


class Modeling(str, Enum):
    SLIM = "slim"
    REGULAR = "regular"
    RELAXED = "relaxed"
    OVERSIZED = "oversized"


class Category(str, Enum):
    TSHIRT = "tshirt"
    SHIRT = "shirt"
    POLO = "polo"
    HOODIE = "hoodie"
    JACKET = "jacket"
    DRESS = "dress"
    PANTS = "pants"
    SHORTS = "shorts"


class RegionStatus(str, Enum):
    GOOD = "good"                        # Compativel
    ATTENTION = "attention"              # Atencao
    EASE_RECOMMENDED = "ease_recommended"  # Folga recomendada (peca mais justa que o desenhado)
    NOT_EVALUATED = "not_evaluated"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class BodyProfile:
    """Medidas corporais em centimetros (circunferencias) e quilogramas."""

    height: float | None = None
    weight: float | None = None
    chest: float | None = None
    waist: float | None = None
    hip: float | None = None
    shoulder: float | None = None

    def measure(self, region: Region) -> float | None:
        return {
            Region.CHEST: self.chest,
            Region.WAIST: self.waist,
            Region.HIP: self.hip,
            Region.SHOULDER: self.shoulder,
            Region.LENGTH: None,
        }[region]

    def provided_core_measures(self) -> list[str]:
        return [
            name
            for name, value in (
                ("chest", self.chest),
                ("waist", self.waist),
                ("hip", self.hip),
                ("shoulder", self.shoulder),
            )
            if value is not None
        ]


@dataclass(frozen=True)
class GarmentSize:
    """Medidas tecnicas de um SKU/tamanho (cm). Circunferencias para peito/cintura/quadril."""

    sku: str
    label: str
    chest: float | None = None
    waist: float | None = None
    hip: float | None = None
    shoulder: float | None = None
    length: float | None = None
    sleeve: float | None = None
    width: float | None = None
    sort_order: int = 0

    def measure(self, region: Region) -> float | None:
        return {
            Region.CHEST: self.chest,
            Region.WAIST: self.waist,
            Region.HIP: self.hip,
            Region.SHOULDER: self.shoulder,
            Region.LENGTH: self.length,
        }[region]


@dataclass(frozen=True)
class GarmentSpec:
    """Dados tecnicos da peca compartilhados por todos os tamanhos."""

    product_id: str
    name: str
    category: Category
    modeling: Modeling
    elasticity_pct: float  # percentual heuristico de alongamento confortavel do tecido
    fabric: str = ""
    sizes: tuple[GarmentSize, ...] = ()


@dataclass(frozen=True)
class VisualProportions:
    """Proporcoes aproximadas extraidas de uma foto (experimental).

    Nenhum atributo estetico e armazenado: apenas relacoes geometricas.
    """

    shoulder_hip_ratio: float | None = None
    waist_hip_ratio: float | None = None
    torso_leg_ratio: float | None = None
    quality: float = 0.0  # 0..1 (qualidade da deteccao)
    source: str = "unavailable"  # mediapipe | heuristic | unavailable

    @property
    def available(self) -> bool:
        return self.source != "unavailable" and self.quality > 0 and (
            self.shoulder_hip_ratio is not None or self.waist_hip_ratio is not None
        )


@dataclass
class RegionResult:
    region: Region
    status: RegionStatus
    body: float | None
    garment: float | None
    ease: float | None            # garment - body
    design_ease: float | None     # folga prevista pela modelagem
    deviation: float | None       # ease - design_ease
    score: float | None           # 0..1
    note: str = ""


@dataclass
class ComponentScores:
    measurements: float
    modeling: float
    elasticity: float
    visual_proportion: float | None
    preference: float

    def as_dict(self) -> dict[str, float | None]:
        return {
            "measurements": round(self.measurements, 4),
            "modeling": round(self.modeling, 4),
            "elasticity": round(self.elasticity, 4),
            "visual_proportion": None
            if self.visual_proportion is None
            else round(self.visual_proportion, 4),
            "preference": round(self.preference, 4),
        }


@dataclass
class SizeEvaluation:
    sku: str
    size: str
    fit_score: float  # 0..10
    components: ComponentScores
    weights_used: dict[str, float]
    regions: list[RegionResult] = field(default_factory=list)

    def regional_analysis(self) -> dict[str, str]:
        return {r.region.value: r.status.value for r in self.regions}


@dataclass
class RecommendationResult:
    product_id: str
    recommended_size: str
    recommended_sku: str
    fit_score: float
    confidence: Confidence
    confidence_score: float
    confidence_message: str
    scale_label: str
    scale_message: str
    explanation: str
    recommendation: str
    regional_analysis: dict[str, str]
    components: dict[str, float | None]
    weights: dict[str, float]
    evaluated: SizeEvaluation
    comparison: list[SizeEvaluation]
    visual_used: bool
    notes: list[str] = field(default_factory=list)
