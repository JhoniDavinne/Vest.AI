# 02 — Arquitetura

## Princípio

Não existe front-end fake. A UI consulta a API, a API consulta o banco, o banco tem seed, o motor calcula, e o widget chama o mesmo endpoint.

```text
Consumer Web                 B2B Widget
      │                           │
      └──────────┬────────────────┘
                 ▼
              FastAPI  /api/v1
                 │
                 ▼
        Recommendation Engine
                 │
                 ▼
            PostgreSQL
         (fallback SQLite)
```

## Monorepo

```text
veste-ai/
├── apps/web/              Next.js — consumidor, studio, loja parceira
├── apps/api/              FastAPI — HTTP + serviços + motor
│   └── app/engine/        Núcleo determinístico (sem HTTP)
├── packages/widget/       <VesteFit />
├── packages/contracts/    Tipos TypeScript do contrato
├── packages/ui/           Logo e tokens
├── database/seed/         Catálogo JSON
├── docker/                Compose + Dockerfiles
├── pipelines/             Exemplos e testes
└── docs/
```

O motor fica **separado da camada HTTP**. Rotas chamam services; services chamam `RecommendationEngine`.

## Camadas da API

```text
API
 └── Services
      └── Recommendation Engine
           ├── Measurement Compatibility
           ├── Fit Preference
           ├── Modeling Tolerance
           ├── Fabric Elasticity
           ├── Visual Proportion
           ├── Score
           └── Confidence
```

## Persistência

Entidades: User, UserMeasurement, PhotoAnalysis, Product, SKUSize, GarmentMeasurement, FitAnalysis, Feedback, Company, IntegrationKey.

Cada análise guarda usuário (quando houver), SKU, tamanho avaliado, score, confiança, diferenças por região e data/hora.

## Canais

| Canal | Origem | Header |
|---|---|---|
| `web` | Aplicação própria | opcional |
| `api` | Tester / parceiro | `X-API-Key` |
| `widget` | Loja parceira | `X-API-Key` |

Os três canais executam o mesmo `engine.recommend()`.

## Visão computacional

Módulo experimental. Se MediaPipe/OpenCV não estiverem instalados, um fallback heurístico (ou a indisponibilidade explícita) não quebra o fluxo. Sem foto, o peso visual é redistribuído e a confiança cai.

## Offline

A banca não depende de APIs externas de IA. Seed + SQLite bastam para a demonstração.
