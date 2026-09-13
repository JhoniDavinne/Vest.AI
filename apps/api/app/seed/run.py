"""Seed do banco: empresa demo + chave, usuario demo, catalogo e analises simuladas.

Uso:
    python -m app.seed.run            # popula se vazio
    python -m app.seed.run --reset    # apaga e recria tudo
"""

from __future__ import annotations

import argparse
import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.database import get_engine, session_factory
from ..engine import BodyProfile, FitPreference, RecommendationEngine
from ..models import (
    Base,
    Company,
    Feedback,
    FitAnalysis,
    GarmentMeasurement,
    IntegrationKey,
    Product,
    SKUSize,
    User,
    UserMeasurement,
)
from ..services.mappers import product_to_spec
from ..services.product_service import get_product
from ..services.recommendation_service import persist_analysis
from .catalog import build_catalog

logger = logging.getLogger("veste.seed")

DEMO_COMPANY_SLUG = "loja-parceira"
DEMO_USER_NAME = "Perfil Demonstração"
SIMULATED_ANALYSES = 320


def seed_company(db: Session) -> Company:
    settings = get_settings()
    company = db.scalars(select(Company).where(Company.slug == DEMO_COMPANY_SLUG)).first()
    if company is None:
        company = Company(
            name="Loja Parceira Demo",
            slug=DEMO_COMPANY_SLUG,
            segment="E-commerce de moda",
            website="https://loja-parceira.exemplo",
            plan="growth",
        )
        db.add(company)
        db.flush()
        db.add(IntegrationKey(company_id=company.id, label="Produção (demo)", key=settings.demo_api_key))
        db.add(IntegrationKey(company_id=company.id, label="Sandbox", key="veste_sandbox_key_loja_parceira"))
        db.commit()
    return company


def seed_demo_user(db: Session) -> User:
    user = db.scalars(select(User).where(User.name == DEMO_USER_NAME)).first()
    if user is None:
        user = User(name=DEMO_USER_NAME, email="demo@veste.ai", fit_preference="regular", photo_consent=False)
        db.add(user)
        db.flush()
        db.add(UserMeasurement(user_id=user.id, height=180, weight=78, chest=102, waist=88, hip=100, shoulder=45))
        db.commit()
    return user


def seed_catalog(db: Session, company: Company) -> list[Product]:
    products: list[Product] = []
    for item in build_catalog():
        existing = db.scalars(select(Product).where(Product.slug == item["slug"])).first()
        if existing:
            products.append(existing)
            continue
        product = Product(
            company_id=company.id,
            slug=item["slug"],
            name=item["name"],
            brand=item["brand"],
            category=item["category"],
            audience=item["audience"],
            description=item["description"],
            image_url=f"/products/{item['image']}",
            color=item["color"],
            price_cents=item["price_cents"],
            modeling=item["modeling"],
            fabric=item["fabric"],
            composition=item["composition"],
            elasticity_pct=item["elasticity_pct"],
            care=item["care"],
        )
        for index, size in enumerate(item["sizes"]):
            sku = SKUSize(
                sku=f"{item['sku_prefix']}-{size['size_label']}",
                size_label=size["size_label"],
                sort_order=index,
                stock=random.Random(index + len(item["slug"])).randint(4, 40),
            )
            sku.measurement = GarmentMeasurement(**size["measurements"])
            product.sizes.append(sku)
        db.add(product)
        db.commit()
        products.append(product)
    return products


def _synthetic_body(rng: random.Random, category: str) -> tuple[BodyProfile, FitPreference]:
    """Gera um perfil sintetico plausivel (nao sao pessoas reais)."""
    height = rng.gauss(170, 9)
    chest = rng.gauss(96, 10)
    waist = chest - rng.gauss(10, 6)
    hip = chest + rng.gauss(2, 6)
    shoulder = 38 + (chest - 80) * 0.28 + rng.gauss(0, 1.5)
    weight = 22.5 * (height / 100) ** 2 + rng.gauss(0, 6)
    pref = rng.choices(
        [FitPreference.TIGHT, FitPreference.REGULAR, FitPreference.LOOSE], weights=[0.2, 0.55, 0.25]
    )[0]
    return (
        BodyProfile(
            height=round(height, 1),
            weight=round(weight, 1),
            chest=round(chest, 1),
            waist=round(waist, 1),
            hip=round(hip, 1),
            shoulder=round(shoulder, 1),
        ),
        pref,
    )


def seed_simulated_analyses(db: Session, company: Company, products: list[Product], count: int) -> int:
    existing = db.scalar(select(func.count(FitAnalysis.id)).where(FitAnalysis.channel == "seed")) or 0
    if existing:
        return 0

    rng = random.Random(2026)
    engine = RecommendationEngine()
    now = datetime.now(timezone.utc)
    created = 0
    for _ in range(count):
        product = get_product(db, rng.choice(products).id)
        body, preference = _synthetic_body(rng, product.category)
        spec = product_to_spec(product)
        evaluated = rng.choice(product.sizes)
        result = engine.recommend(body, spec, preference, evaluated_sku=evaluated.sku)
        created_at = now - timedelta(days=rng.uniform(0, 28), minutes=rng.uniform(0, 600))
        analysis = persist_analysis(
            db,
            product=product,
            evaluated=evaluated,
            result=result,
            body=body,
            preference=preference,
            user_id=None,
            company_id=company.id,
            photo=None,
            channel="seed",
            created_at=created_at,
        )
        # Feedback simulado em ~55% das analises, coerente com o score.
        if rng.random() < 0.55:
            followed = rng.random() < 0.8
            best_score = max(e.fit_score for e in result.comparison)
            p_good = 0.35 + 0.06 * best_score if followed else 0.45
            good = rng.random() < min(0.95, p_good)
            rating = "good" if good else rng.choice(["too_tight", "too_loose"])
            returned = (not good) and rng.random() < (0.45 if followed else 0.75)
            db.add(
                Feedback(
                    fit_analysis_id=analysis.id,
                    purchased_size=result.recommended_size if followed else analysis.evaluated_size,
                    fit_rating=rating,
                    followed_recommendation=followed,
                    returned=returned,
                    return_reason=None if not returned else ("Tamanho menor que o esperado" if rating == "too_tight" else "Tamanho maior que o esperado"),
                )
            )
        created += 1
    db.commit()
    return created


def run_seed(reset: bool = False) -> dict[str, int]:
    engine = get_engine()
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with session_factory()() as db:
        company = seed_company(db)
        seed_demo_user(db)
        products = seed_catalog(db, company)
        analyses = seed_simulated_analyses(db, company, products, SIMULATED_ANALYSES)
        return {"products": len(products), "simulated_analyses": analyses}


def database_is_empty() -> bool:
    with session_factory()() as db:
        return (db.scalar(select(func.count(Product.id))) or 0) == 0


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Seed do banco VESTE.AI")
    parser.add_argument("--reset", action="store_true", help="Apaga e recria todas as tabelas")
    args = parser.parse_args()
    stats = run_seed(reset=args.reset)
    logger.info("Seed concluido: %s", stats)


if __name__ == "__main__":
    main()
