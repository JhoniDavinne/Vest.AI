# VESTE.AI Platform

MVP web de recomendação de tamanho e estimativa de caimento para moda.

> A VESTE.AI não diz se uma roupa fica bonita ou feia em uma pessoa. Ela usa dados para estimar como aquela peça tende a vestir e ajudar o consumidor a tomar uma decisão de compra mais informada.

TCC — Engenharia de Dados (FIAP) · Equipe Allan · Jhony · Aécio · 2026

---

## O que este repositório entrega

Três camadas sobre **um único motor**:

| Camada | Onde | Função |
|---|---|---|
| Consumer Experience | `http://localhost:3000` | Perfil, medidas, foto opcional, catálogo e resultado |
| VESTE.AI Studio | `/empresa` | Produtos, API, widget, métricas e chaves B2B |
| Widget | `/loja-parceira` e `@veste-ai/widget` | `<VesteFit />` incorporável em e-commerce |

O front-end **não replica** o algoritmo. Toda recomendação passa por `POST /api/v1/recommendations`.

---

## Stack

- **Front-end:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Lucide, Framer Motion
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic
- **Banco:** PostgreSQL (oficial) com fallback SQLite para demo offline e testes
- **Processamento:** NumPy, Pandas
- **Visão:** MediaPipe/OpenCV opcionais — o fluxo principal funciona só com medidas
- **Widget:** pacote `@veste-ai/widget`
- **Provador 3D:** pacote `@veste-ai/fit-preview-3d` (React Three Fiber, lazy load)

---

## Como executar (desenvolvimento local)

Pré-requisitos: Node.js 20+, Python 3.11+ e, se quiser o banco oficial, Docker (PostgreSQL).

### 1. Front-end

```bash
npm install
npm run dev:web
```

A interface sobe em `http://localhost:3000`.

### 2. API

```bash
cd apps/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --port 8000
```

Ou, a partir da raiz:

```bash
npm run dev:api
```

Se o PostgreSQL não estiver no ar, a API cai automaticamente para SQLite (`apps/api/veste_ai.db`) e faz o seed sozinha. A demonstração **não depende de internet**.

- Swagger: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/api/v1/openapi.json`

### 3. Banco e seed

```bash
# Popular (se vazio)
npm run seed

# Recriar tudo
cd apps/api && python -m app.seed.run --reset
```

O seed cria:

- empresa **Loja Parceira Demo** e duas chaves
- 10 produtos com SKUs e medidas técnicas
- perfil de demonstração (180 cm, peito 102, cintura 88, quadril 100, ombro 45)
- ~320 análises simuladas para o dashboard

Chave B2B de demonstração:

```text
veste_demo_key_loja_parceira
```

---

## Como executar com Docker

```bash
npm run docker:up
```

Sobe PostgreSQL 16, API na porta 8000 e web na 3000. Encerrar:

```bash
npm run docker:down
```

---

## Fluxo da demonstração (≈ 5 minutos)

1. Landing — **Sou consumidor**
2. Informe as medidas do perfil demo (já sugeridas no formulário)
3. Continue sem foto **ou** envie uma imagem
4. Abra o catálogo e escolha **Camiseta Essential Algodão**
5. Clique em **Analisar caimento**
6. Resultado esperado da demo: **M · ≈ 8,7/10 · confiança média** (sem foto)
7. **Gire o provador 3D** e compare S/M/L/XL — regiões coloridas refletem o motor
8. Abra **Como calculamos**
9. Entre em **Sou empresa** → tester da API, widget, métricas
10. Abra a **Loja Parceira** e use o mesmo motor (e provador 3D compact) pelo widget

---

## Endpoints principais

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/v1/health` | Status |
| GET | `/api/v1/products` | Catálogo |
| GET | `/api/v1/products/{id}` | Detalhe + SKUs |
| GET | `/api/v1/products/{id}/sizes` | Medidas por tamanho |
| POST | `/api/v1/products` | Cadastro B2B |
| POST | `/api/v1/recommendations` | Motor |
| POST | `/api/v1/feedback` | Feedback de caimento |
| GET | `/api/v1/metrics/dashboard` | Indicadores (dados simulados) |
| GET | `/api/v1/engine/config` | Pesos e parâmetros |

### Request

```json
{
  "sku": "CAMISETA-001-M",
  "customer": {
    "height": 180,
    "chest": 102,
    "waist": 88,
    "hip": 100,
    "shoulder": 45
  },
  "fit_preference": "regular"
}
```

### Response (campos principais)

```json
{
  "recommended_size": "M",
  "fit_score": 8.7,
  "confidence": "medium",
  "regional_analysis": {
    "chest": "good",
    "waist": "good",
    "hip": "attention",
    "shoulder": "good"
  },
  "explanation": "A modelagem apresenta boa compatibilidade com as medidas informadas.",
  "recommendation": "O tamanho M apresenta o melhor equilíbrio entre as regiões analisadas.",
  "fit_preview": { "body": {}, "garment": {}, "regions": [], "disclaimer": "..." }
}
```

Regenerar assets 3D placeholder:

```bash
npm run models:3d
```

---

## Score

```text
0.40 × medidas
+ 0.20 × modelagem
+ 0.15 × elasticidade do tecido
+ 0.15 × proporções (foto, opcional)
+ 0.10 × preferência declarada
```

Sem foto, o peso visual é redistribuído. Os parâmetros são **heurísticos do MVP**, não validados cientificamente.

O score avalia compatibilidade **pessoa × peça**. Nunca é uma nota para o corpo.

---

## Testes e pipelines

```bash
npm run test:api
npm run test:widget
npm run pipeline:examples
npm run pipeline:test
```

Documentação dos pipelines: [`pipelines/README.md`](pipelines/README.md)

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/00-indice.md`](docs/00-indice.md) | Índice |
| [`docs/01-visao-geral.md`](docs/01-visao-geral.md) | Produto e problema |
| [`docs/02-arquitetura.md`](docs/02-arquitetura.md) | Monorepo e fluxos |
| [`docs/03-motor-recomendacao.md`](docs/03-motor-recomendacao.md) | Algoritmo |
| [`docs/04-api.md`](docs/04-api.md) | Contrato HTTP |
| [`docs/05-experiencia-consumidor.md`](docs/05-experiencia-consumidor.md) | Telas do consumidor |
| [`docs/06-studio-b2b.md`](docs/06-studio-b2b.md) | Studio |
| [`docs/07-widget.md`](docs/07-widget.md) | Widget e loja parceira |
| [`docs/08-banco-e-seed.md`](docs/08-banco-e-seed.md) | Modelo e carga |
| [`docs/09-como-usar.md`](docs/09-como-usar.md) | Guia operacional |
| [`docs/10-pipelines-e-testes.md`](docs/10-pipelines-e-testes.md) | Exemplos e testes |
| [`docs/11-limitacoes-e-proximos-passos.md`](docs/11-limitacoes-e-proximos-passos.md) | Limites do MVP |

Gerar PDFs (um por documento + volume único):

```bash
pip install fpdf2
npm run docs:pdf
```

Os arquivos saem em `docs/pdf/`.

---

## Estrutura

```text
.
├── apps/web/          # Next.js
├── apps/api/          # FastAPI + motor
├── packages/
│   ├── widget/        # <VesteFit />
│   ├── contracts/     # Tipos TS do contrato
│   └── ui/            # Logo e tokens
├── database/seed/
├── docker/
├── pipelines/
├── docs/
└── README.md
```

---

## Limitações do MVP

- Sem pagamentos, marketplace, app nativo ou provador 3D
- Visão computacional experimental (fallback determinístico)
- Métricas do dashboard são **dados simulados para demonstração**
- Parâmetros do motor são heurísticos

## Próximos passos

Calibrar o score com feedback real, trocas e devoluções; expandir o widget para produção; aprender por marca, categoria e tecido.
