from __future__ import annotations

from fastapi import APIRouter

from .routes import companies, engine, feedback, health, metrics, products, recommendations, tryon, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(engine.router, prefix="/engine", tags=["engine"])
api_router.include_router(tryon.router, prefix="/tryon", tags=["tryon"])
