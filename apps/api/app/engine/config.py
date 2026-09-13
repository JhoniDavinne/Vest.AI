"""Parametros configuraveis do motor.

IMPORTANTE: todos os valores abaixo sao PARAMETROS HEURISTICOS DO MVP.
Eles nao foram validados cientificamente e existem para tornar o calculo
deterministico, explicavel e ajustavel. A evolucao prevista e calibra-los
com historico real de compras, trocas, devolucoes e feedback de caimento.

Os parametros podem ser sobrescritos por um arquivo JSON apontado pela
variavel de ambiente ``VESTE_ENGINE_CONFIG``.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

from .types import Category, FitPreference, Modeling, Region


class Weights(BaseModel):
    """Pesos oficiais do MVP (somam 1.0)."""

    measurements: float = 0.40
    modeling: float = 0.20
    elasticity: float = 0.15
    visual_proportion: float = 0.15
    preference: float = 0.10

    @model_validator(mode="after")
    def _check_sum(self) -> "Weights":
        total = (
            self.measurements
            + self.modeling
            + self.elasticity
            + self.visual_proportion
            + self.preference
        )
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Os pesos devem somar 1.0 (atual: {total:.4f})")
        return self

    def as_dict(self) -> dict[str, float]:
        return self.model_dump()

    def without_visual(self) -> dict[str, float]:
        """Redistribui o peso visual proporcionalmente quando nao ha foto."""
        remaining = 1.0 - self.visual_proportion
        return {
            "measurements": self.measurements / remaining,
            "modeling": self.modeling / remaining,
            "elasticity": self.elasticity / remaining,
            "visual_proportion": 0.0,
            "preference": self.preference / remaining,
        }


class RegionTolerances(BaseModel):
    """Escala de tolerancia (cm) por regiao.

    E o "sigma" da curva de compatibilidade: com desvio igual a tolerancia o
    score regional cai para ~0.61; com o dobro, para ~0.14.
    """

    chest: float = 7.0
    waist: float = 7.0
    hip: float = 7.0
    shoulder: float = 2.5
    length: float = 5.0

    def get(self, region: Region) -> float:
        return getattr(self, region.value)


class EngineConfig(BaseModel):
    weights: Weights = Field(default_factory=Weights)
    tolerances: RegionTolerances = Field(default_factory=RegionTolerances)

    # Fator aplicado a tolerancia quando a peca fica MAIS JUSTA que o desenhado
    # (apertar tende a incomodar mais do que sobrar).
    tight_side_factor: float = 0.8

    # Limiares de status regional como fracao da tolerancia.
    status_good_fraction: float = 0.5   # |desvio| <= 0.5*tol  -> Compativel
    status_tight_fraction: float = 0.75  # desvio  < -0.75*tol -> Folga recomendada

    # Faixa (cm) que cada modelagem "absorve" sem alterar a percepcao de caimento.
    modeling_band_cm: dict[Modeling, float] = Field(
        default_factory=lambda: {
            Modeling.SLIM: 3.5,
            Modeling.REGULAR: 5.0,
            Modeling.RELAXED: 7.0,
            Modeling.OVERSIZED: 10.0,
        }
    )

    # Folga de projeto (cm) por categoria x modelagem x regiao (peca - corpo).
    design_ease_cm: dict[Category, dict[Modeling, dict[Region, float]]] = Field(
        default_factory=lambda: _default_design_ease()
    )

    # Deslocamento da folga preferida em cm por preferencia declarada.
    preference_shift_cm: dict[FitPreference, float] = Field(
        default_factory=lambda: {
            FitPreference.TIGHT: -3.0,
            FitPreference.REGULAR: 0.0,
            FitPreference.LOOSE: 4.0,
        }
    )
    preference_tolerance_cm: float = 7.0

    # Pesos regionais por categoria (importancia de cada regiao no caimento).
    region_weights: dict[Category, dict[Region, float]] = Field(
        default_factory=lambda: _default_region_weights()
    )

    # Comprimento esperado da peca como fracao da altura (heuristica por categoria).
    expected_length_ratio: dict[Category, float] = Field(
        default_factory=lambda: {
            Category.TSHIRT: 0.40,
            Category.SHIRT: 0.42,
            Category.POLO: 0.40,
            Category.HOODIE: 0.40,
            Category.JACKET: 0.40,
            Category.DRESS: 0.56,
            Category.PANTS: 0.60,
            Category.SHORTS: 0.28,
        }
    )
    length_tolerance_factor: float = 1.5  # comprimento e menos critico que circunferencias

    # Fracao do alongamento nominal do tecido considerada "confortavel".
    elastic_comfort_factor: float = 0.6

    # Confianca
    confidence_weights: dict[str, float] = Field(
        default_factory=lambda: {
            "measurements": 0.50,
            "photo": 0.25,
            "garment_coverage": 0.15,
            "margin": 0.10,
        }
    )
    confidence_high_threshold: float = 0.80
    confidence_medium_threshold: float = 0.50
    clear_margin_points: float = 0.5  # diferenca de score entre 1o e 2o tamanho

    # Limites da escala de caimento (0-10)
    scale_high: float = 8.5
    scale_good: float = 7.0
    scale_moderate: float = 5.0

    def public_dict(self) -> dict:
        """Versao serializavel para a area "Como calculamos"."""
        return {
            "weights": self.weights.as_dict(),
            "tolerances_cm": self.tolerances.model_dump(),
            "tight_side_factor": self.tight_side_factor,
            "modeling_band_cm": {k.value: v for k, v in self.modeling_band_cm.items()},
            "design_ease_cm": {
                c.value: {m.value: {r.value: e for r, e in regs.items()} for m, regs in mods.items()}
                for c, mods in self.design_ease_cm.items()
            },
            "preference_shift_cm": {k.value: v for k, v in self.preference_shift_cm.items()},
            "preference_tolerance_cm": self.preference_tolerance_cm,
            "region_weights": {
                c.value: {r.value: w for r, w in regs.items()} for c, regs in self.region_weights.items()
            },
            "expected_length_ratio": {k.value: v for k, v in self.expected_length_ratio.items()},
            "elastic_comfort_factor": self.elastic_comfort_factor,
            "confidence": {
                "weights": self.confidence_weights,
                "high_threshold": self.confidence_high_threshold,
                "medium_threshold": self.confidence_medium_threshold,
            },
            "scale": {
                "high": self.scale_high,
                "good": self.scale_good,
                "moderate": self.scale_moderate,
            },
            "disclaimer": (
                "Parametros heuristicos do MVP. Nao sao cientificamente validados; "
                "servem para tornar o calculo deterministico e explicavel."
            ),
        }


def _tops(chest: float, waist: float, hip: float, shoulder: float) -> dict[Region, float]:
    """Pecas superiores: cintura e barra (quadril) tem folga maior por natureza."""
    return {
        Region.CHEST: chest,
        Region.WAIST: waist,
        Region.HIP: hip,
        Region.SHOULDER: shoulder,
        Region.LENGTH: 0.0,
    }


def _bottoms(waist: float, hip: float) -> dict[Region, float]:
    return {Region.WAIST: waist, Region.HIP: hip, Region.LENGTH: 0.0}


def _dress(chest: float, waist: float, hip: float) -> dict[Region, float]:
    return {Region.CHEST: chest, Region.WAIST: waist, Region.HIP: hip, Region.LENGTH: 0.0}


def _default_design_ease() -> dict[Category, dict[Modeling, dict[Region, float]]]:
    tops = {
        Modeling.SLIM: _tops(6, 10, 8, 0),
        Modeling.REGULAR: _tops(10, 16, 12, 1),
        Modeling.RELAXED: _tops(14, 20, 16, 2.5),
        Modeling.OVERSIZED: _tops(20, 26, 22, 5),
    }
    outer = {
        Modeling.SLIM: _tops(10, 14, 12, 1),
        Modeling.REGULAR: _tops(14, 20, 16, 2),
        Modeling.RELAXED: _tops(18, 24, 20, 3.5),
        Modeling.OVERSIZED: _tops(24, 30, 26, 6),
    }
    bottoms = {
        Modeling.SLIM: _bottoms(2, 4),
        Modeling.REGULAR: _bottoms(3, 6),
        Modeling.RELAXED: _bottoms(4, 8),
        Modeling.OVERSIZED: _bottoms(6, 12),
    }
    dress = {
        Modeling.SLIM: _dress(6, 6, 6),
        Modeling.REGULAR: _dress(8, 8, 8),
        Modeling.RELAXED: _dress(12, 12, 12),
        Modeling.OVERSIZED: _dress(16, 16, 16),
    }
    return {
        Category.TSHIRT: tops,
        Category.SHIRT: tops,
        Category.POLO: tops,
        Category.HOODIE: outer,
        Category.JACKET: outer,
        Category.DRESS: dress,
        Category.PANTS: bottoms,
        Category.SHORTS: bottoms,
    }


def _default_region_weights() -> dict[Category, dict[Region, float]]:
    tops = {
        Region.CHEST: 0.35,
        Region.SHOULDER: 0.25,
        Region.WAIST: 0.15,
        Region.HIP: 0.10,
        Region.LENGTH: 0.15,
    }
    bottoms = {Region.WAIST: 0.40, Region.HIP: 0.40, Region.LENGTH: 0.20}
    dress = {Region.CHEST: 0.30, Region.WAIST: 0.30, Region.HIP: 0.30, Region.LENGTH: 0.10}
    return {
        Category.TSHIRT: tops,
        Category.SHIRT: tops,
        Category.POLO: tops,
        Category.HOODIE: tops,
        Category.JACKET: tops,
        Category.DRESS: dress,
        Category.PANTS: bottoms,
        Category.SHORTS: bottoms,
    }


@lru_cache(maxsize=1)
def get_engine_config() -> EngineConfig:
    """Carrega a configuracao padrao, com sobrescrita opcional via JSON."""
    override = os.getenv("VESTE_ENGINE_CONFIG")
    if override and Path(override).exists():
        data = json.loads(Path(override).read_text(encoding="utf-8"))
        return EngineConfig.model_validate(data)
    return EngineConfig()
