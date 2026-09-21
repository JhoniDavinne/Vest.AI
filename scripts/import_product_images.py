"""Importa fotos de produtos a partir de uma pasta e atualiza o banco.

Estrutura esperada (qualquer uma):

1) Arquivos na raiz com slug no nome:
   camiseta-essential-algodao__1.jpg
   camiseta-essential-algodao__2.jpg

2) Subpastas por produto (slug):
   imports/product-images/camiseta-essential-algodao/foto1.jpg
   imports/product-images/camiseta-essential-algodao/foto2.jpg

Uso:
    python scripts/import_product_images.py
    python scripts/import_product_images.py --dir imports/product-images --dry-run
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "imports" / "product-images"
PUBLIC_PRODUCTS = ROOT / "apps" / "web" / "public" / "products"

sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.core.database import session_factory  # noqa: E402
from app.models import Product  # noqa: E402
from app.seed.run import _apply_product_images  # noqa: E402
from app.services.product_service import get_product, slugify  # noqa: E402
from sqlalchemy import select  # noqa: E402

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _resolve_slug(token: str, slugs: set[str]) -> str | None:
    token = slugify(token)
    if token in slugs:
        return token
    matches = [slug for slug in slugs if slug.startswith(token) or token in slug]
    if len(matches) == 1:
        return matches[0]
    return None


def collect_groups(source: Path, slugs: set[str]) -> dict[str, list[Path]]:
    groups: dict[str, list[Path]] = {}

    if not source.exists():
        return groups

    for path in sorted(source.iterdir()):
        if path.is_dir():
            slug = _resolve_slug(path.name, slugs)
            if not slug:
                print(f"ignorado (slug desconhecido): {path.name}/")
                continue
            files = sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXT)
            if files:
                groups[slug] = files
            continue

        if path.suffix.lower() not in IMAGE_EXT:
            continue

        stem = path.stem
        if "__" in stem:
            slug_part, _order = stem.split("__", 1)
        else:
            slug_part = stem
        slug = _resolve_slug(slug_part, slugs)
        if not slug:
            print(f"ignorado (slug desconhecido): {path.name}")
            continue
        groups.setdefault(slug, []).append(path)

    for slug in groups:
        groups[slug] = sorted(groups[slug], key=lambda p: p.name)
    return groups


def main() -> None:
    parser = argparse.ArgumentParser(description="Importar galeria de imagens de produtos")
    parser.add_argument("--dir", type=Path, default=DEFAULT_SOURCE, help="Pasta com as imagens")
    parser.add_argument("--dry-run", action="store_true", help="Apenas listar o que seria importado")
    args = parser.parse_args()

    PUBLIC_PRODUCTS.mkdir(parents=True, exist_ok=True)
    args.dir.mkdir(parents=True, exist_ok=True)

    with session_factory()() as db:
        products = list(db.scalars(select(Product)).all())
        slugs = {p.slug for p in products}
        groups = collect_groups(args.dir, slugs)

        if not groups:
            print(f"Nenhuma imagem encontrada em {args.dir}")
            print("Coloque arquivos como: camiseta-essential-algodao__1.jpg")
            return

        for slug, files in groups.items():
            urls: list[str] = []
            for index, src in enumerate(files, start=1):
                dest_name = f"{slug}-{index}{src.suffix.lower()}"
                dest = PUBLIC_PRODUCTS / dest_name
                url = f"/products/{dest_name}"
                urls.append(url)
                print(f"{slug}: {src.name} -> {dest_name}")
                if not args.dry_run:
                    shutil.copy2(src, dest)

            if args.dry_run:
                continue

            product = get_product(db, slug)
            _apply_product_images(product, urls)

        if not args.dry_run:
            db.commit()
            print(f"OK — {len(groups)} produto(s) atualizado(s)")


if __name__ == "__main__":
    main()
