from __future__ import annotations

from fastapi import APIRouter

from ....engine import get_engine_config

router = APIRouter()


@router.get("/config", summary="Pesos e parametros heuristicos do motor (\"Como calculamos?\")")
def engine_config() -> dict:
    cfg = get_engine_config()
    return {
        "formula": (
            "score = 0.40*measurements + 0.20*modeling + 0.15*elasticity "
            "+ 0.15*visual_proportion + 0.10*preference"
        ),
        "components": [
            {"key": "measurements", "label": "Medidas", "weight": cfg.weights.measurements,
             "description": "Compatibilidade entre a folga real (peca - corpo) e a folga prevista pela modelagem em cada regiao."},
            {"key": "modeling", "label": "Modelagem", "weight": cfg.weights.modeling,
             "description": "Quanto do desvio cabe na faixa que a modelagem (slim, regular, relaxed, oversized) absorve."},
            {"key": "elasticity", "label": "Tecido", "weight": cfg.weights.elasticity,
             "description": "Capacidade do tecido de compensar regioes mais ajustadas, conforme a elasticidade informada."},
            {"key": "visual_proportion", "label": "Proporcoes", "weight": cfg.weights.visual_proportion,
             "description": "Enfase regional derivada das proporcoes estimadas pela foto (opcional, experimental)."},
            {"key": "preference", "label": "Preferencia", "weight": cfg.weights.preference,
             "description": "Proximidade entre a folga real e a folga preferida (justo, regular, solto)."},
        ],
        "parameters": cfg.public_dict(),
    }
