# 08 — Banco de dados e seed

## Banco oficial

PostgreSQL. URL padrão:

```text
postgresql+psycopg://veste:veste@localhost:5432/veste_ai
```

Variável: `VESTE_DATABASE_URL`.

## Fallback

Se a conexão falhar e o ambiente não for `production`, a API usa SQLite local (`apps/api/veste_ai.db`). Testes automatizados sempre usam SQLite isolado.

## Schema

Migração Alembic: `apps/api/alembic/versions/0001_initial_schema.py`.

No modo demo, `VESTE_AUTO_CREATE_SCHEMA=true` cria as tabelas na subida.

### Entidades

**Consumidor:** User, UserMeasurement, PhotoAnalysis

**Produto:** Product, SKUSize, GarmentMeasurement

**Recomendação:** FitAnalysis, Feedback

**B2B:** Company, IntegrationKey

`FitAnalysis` registra usuário (opcional), empresa (opcional), SKU, tamanho avaliado, score, confiança, diferenças por região, canal e data/hora. A foto original **não** é armazenada.

## Seed

Código: `apps/api/app/seed/run.py`  
Catálogo: `apps/api/app/seed/catalog.py` e `database/seed/catalog.json`

```bash
npm run seed
cd apps/api && python -m app.seed.run --reset
```

O que entra:

| Item | Conteúdo |
|---|---|
| Empresa | Loja Parceira Demo (`loja-parceira`) |
| Chaves | `veste_demo_key_loja_parceira` e `veste_sandbox_key_loja_parceira` |
| Usuário | Perfil Demonstração — 180 / 78 / 102 / 88 / 100 / 45 |
| Catálogo | 10 produtos, grades S–XL ou 38–46 |
| Análises | ≈ 320 corridas do próprio motor em perfis sintéticos |
| Feedback | Amostra simulada para métricas de devolução |

Na primeira subida com banco vazio, `VESTE_AUTO_SEED=true` executa o seed automaticamente.

## Produtos do catálogo

Camiseta essential, camiseta oversized, camisa oxford, calça alfaiataria, calça jeans, vestido midi, jaqueta bomber, polo piquet, moletom canguru, shorts sarja.

Cada SKU tem medidas de peito, cintura, quadril, ombro, comprimento, manga e largura quando aplicável.

## Como usar

1. Suba a API sem Postgres para ver o fallback SQLite.
2. Ou use Docker para mostrar PostgreSQL de verdade.
3. Chame `GET /api/v1/health` e aponte `database` e `products`.
