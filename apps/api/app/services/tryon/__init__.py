"""Provador com foto (virtual try-on): provider abstrato + adaptador CatVTON + servico.

    Frontend -> POST /api/v1/tryon -> service.create_tryon -> VirtualTryOnProvider (CatVTONProvider)
             -> apps/tryon (HTTP) -> imagem -> GET /api/v1/tryon/{job_id}/image (proxy)

O provider e apenas representacao visual: tamanho, score e confianca continuam vindo
exclusivamente do RecommendationEngine (FitAnalysis).
"""

from .provider import ProviderHealth, ProviderResult, VirtualTryOnProvider
from .catvton_provider import CatVTONProvider

__all__ = ["CatVTONProvider", "ProviderHealth", "ProviderResult", "VirtualTryOnProvider"]
