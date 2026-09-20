# ETAPA 07 — Docker e preparação para deployment

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_05_CATVTON_LOCAL.md`, `docs/implementation/ETAPA_06_CATVTON_INTEGRATION.md`.
Branch: `feature/virtual-fitting`. Data da execução: 2026-09-20.

## Objetivo e escopo

Toda a aplicação reproduzível com Docker — `postgres + api + web` sempre, `tryon` (CatVTON, GPU NVIDIA) **opcional** via profile `gpu`. Sem cloud, sem provider específico, sem fila externa. `RecommendationEngine`, `apps/tryon/service/**` e a execução local (venvs, `next dev`, `uvicorn`) não foram alterados.

## Status final

**ETAPA 7 CONCLUÍDA.**

| Critério | Resultado |
|---|---|
| 1. web Docker build | PASS — `veste-ai-web` 274 MB (multi-stage, standalone, todos os workspaces incl. `@veste-ai/fit-preview-3d`) |
| 2. api Docker build | PASS — `veste-ai-api` 546 MB (non-root, prestart com Alembic, healthcheck) |
| 3. compose sem GPU sobe | PASS — `db (healthy) → api (healthy) → web (healthy)` em ~50 s |
| 4. aplicação funciona sem tryon | PASS — web 200, `/health` ok (PostgreSQL, 10 produtos, 320 análises), recomendação `M / 8.8`, `tryon: {enabled:false, available:false}`, página `/analise/{id}` 200 |
| 5. tryon Dockerfile builda | PASS — `veste-ai-tryon` 19,8 GB (CUDA 12.8 + torch 2.7.1+cu128 + CatVTON pinado) em ≈12 min |
| 6. configuração GPU pronta | PASS — profile `gpu`, `gpus: all`, volumes, tmpfs, healthcheck `modelLoaded` |
| 7. docs completas | PASS — este documento + `VIRTUAL_FITTING_ARCHITECTURE.md` + `.env.example` + `docker/README.md` |
| GPU real dentro do Docker | **PASS (validado)** — `nvidia-smi` no container, `tryon` healthy com RTX 5070/bf16, `api` detectou o provider e 1 geração real via API containerizada (25,8 s) |

## 1. Arquitetura Docker

```text
docker compose (docker/docker-compose.yml, project veste-ai)
├── db      postgres:16-alpine          volume veste_pg              healthcheck pg_isready
├── api     docker/Dockerfile.api       entrypoint: prestart (wait DB + alembic upgrade head) → uvicorn
│             depends_on db: service_healthy · healthcheck GET /api/v1/health
├── web     docker/Dockerfile.web       Next standalone (node apps/web/server.js)
│             depends_on api: service_healthy · healthcheck GET /
└── tryon   docker/Dockerfile.tryon     [profile gpu] CatVTONRuntime em GPU
              gpus: all · volumes veste_hf_cache (/data/models), veste_tryon_results (/data/results)
              tmpfs /tmp/tryon · healthcheck GET /health com modelLoaded && cudaAvailable
```

Rede interna: `api → tryon` por `http://tryon:8100` (só com profile ativo); `web (RSC) → api` por `http://api:8000`; navegador → `NEXT_PUBLIC_API_URL` (inlined no build). O frontend nunca chama `tryon`; a porta 8100 é publicada apenas para diagnóstico local.

`api` **não** depende de `tryon`: sem o profile, `VESTE_TRYON_ENABLED=false` e o painel "Provador com foto" não é renderizado; com o profile ativo mas o provider ainda carregando, `/health.tryon.available=false` e o painel mostra "temporariamente indisponível" (Etapa 6).

## 2. Dockerfiles

### `docker/Dockerfile.web` (corrigido)
Problema documentado desde a auditoria: não copiava `packages/fit-preview-3d/package.json` antes do `npm ci`, quebrando a resolução de workspaces. Agora:
- **deps**: `package.json` + `package-lock.json` + os `package.json` de `apps/web`, `packages/contracts`, `packages/ui`, `packages/widget`, `packages/fit-preview-3d` → `npm ci --no-audit` (camada cacheável).
- **build**: copia os fontes dos 5 workspaces, `NEXT_OUTPUT=standalone`, `NODE_ENV=production`, args públicos (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEMO_API_KEY`) inlined.
- **runner**: `node:20-alpine`, usuário `nextjs`, copia `.next/standalone`, `.next/static`, `public`; `CMD node apps/web/server.js` (estrutura de monorepo preservada pelo standalone). Os workspaces entram no bundle via `transpilePackages` — não existem em `node_modules` do runner (verificado).

### `docker/Dockerfile.api`
`python:3.12-slim`, `libpq5`, usuário `veste` (uid 10001), instala o pacote via `pyproject.toml` (agora com `httpx` como dependência de runtime — antes só em `dev`, o que quebraria o `CatVTONProvider` em produção), copia `app/`, `alembic/`, `alembic.ini` e `docker/api-entrypoint.sh` (normalizado para LF com `sed`). Defaults de produção via `ENV`: `VESTE_ENVIRONMENT=production`, `VESTE_LOG_JSON=true`, `VESTE_AUTO_CREATE_SCHEMA=false`, `VESTE_RUN_MIGRATIONS=true`, `VESTE_UVICORN_WORKERS=1`. Healthcheck em Python (`urllib`) — sem `curl` na imagem.

### `docker/Dockerfile.tryon` (novo)
- Base `nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04` → Python **3.12** do sistema (mesma versão do venv local da Etapa 5), venv em `/opt/venv` (PEP 668).
- `pip install -r apps/tryon/requirements.txt` → `torch 2.7.1+cu128` (kernels `sm_120`/RTX 50), pins do CatVTON e desvios já documentados na Etapa 5.
- `git clone` do CatVTON oficial no commit `7818397f…` (o mesmo de `scripts/fetch_catvton.ps1`), `.git` removido, commit gravado em `vendor/CatVTON/.veste-pinned-commit`. Licença CC BY-NC-SA 4.0.
- Copia só `apps/tryon/service` e `apps/tryon/scripts`. **Nenhum checkpoint na imagem**: `HF_HOME=TRYON_MODEL_PATH=/data/models` (volume), download pelo mecanismo oficial na primeira subida.
- Usuário `tryon` (10002:10002), `TRYON_TEMP_PATH=/tmp/tryon` (tmpfs no compose), `CMD uvicorn service.main:app --workers 1`. Modelo carregado uma vez no `lifespan`; o processo só aceita conexões após o load, então `/health` falha até lá → container `unhealthy/starting`; `/try-on` responde 503 `model_not_loaded` se chamado antes (Etapa 5).
- Healthcheck: `modelLoaded && cudaAvailable`, `start_period=900s` (primeira subida baixa ≈6 GB).

## 3. Compose, volumes e profile gpu

Arquivo: `docker/docker-compose.yml` (interpolação `${VAR:-default}`, sem secrets reais).

| Volume | Montagem | Conteúdo |
|---|---|---|
| `veste_pg` | `db:/var/lib/postgresql/data` | banco |
| `veste_hf_cache` | `tryon:/data/models` | cache HuggingFace / checkpoints (6,0 GB medidos) |
| `veste_tryon_results` | `tryon:/data/results` | PNGs gerados, com TTL (nunca a foto da pessoa) |
| tmpfs | `tryon:/tmp/tryon` (`uid=10002,gid=10002,mode=1770,size=512m`) | temporários do DensePose — memória, nunca disco |

Profile `gpu`: `tryon` só sobe com `COMPOSE_PROFILES=gpu` ou `--profile gpu`. Como um profile não altera variáveis de outro serviço, `docker/gpu.env` liga o conjunto de uma vez (`COMPOSE_PROFILES=gpu`, `VESTE_TRYON_ENABLED=true`, timeouts). `VESTE_TRYON_URL=http://tryon:8100` fica fixo no `api` (inofensivo com o recurso desligado). GPU via `gpus: all` (equivalente a `deploy.resources.reservations.devices` com `driver: nvidia`).

Healthchecks e ordem (sem sleeps): `db` → `api` (`condition: service_healthy`) → `web` (`condition: service_healthy`). `tryon` independente. `restart: unless-stopped` em todos.

## 4. Startup

**API** (`apps/api/app/prestart.py`, chamado por `docker/api-entrypoint.sh`):
1. `wait_for_database` — polling com backoff até `VESTE_DB_WAIT_SECONDS` (60 s); sem fallback para SQLite (falha explícita → restart pelo orquestrador).
2. `run_migrations` — `alembic upgrade head` (nunca destrutivo). Bancos criados antes do Alembic (`create_all`) são detectados (sem `alembic_version`) e carimbados na revisão equivalente (`07f07de8bcbe` ou `4b2a7c9e1d06`) antes do upgrade. Testado localmente em SQLite: banco novo (0001→0002), legado (stamp + 0002) e idempotência; no compose com PostgreSQL: `alembic_version = 4b2a7c9e1d06`.
3. `uvicorn` com `--workers`, `--proxy-headers`, `--forwarded-allow-ips`, `--timeout-keep-alive`, sem access-log duplicado. Seed continua no `lifespan` (`VESTE_AUTO_SEED`, só com banco vazio). `VESTE_AUTO_CREATE_SCHEMA=false` no compose (schema vem das migrations); local sem Docker continua `true` (create_all + `ensure_compat_schema`).

**TryOn**: `CatVTONRuntime.load()` no `lifespan` (uma vez), `require_cuda()` aborta sem GPU; healthy só com `modelLoaded=true`. Medido no container: 118,3 s na primeira subida (incluindo download de 6 GB para o volume), ≈15 s nas seguintes.

## 5. Configuração (`.env.example` reorganizado)

Blocos **WEB** (`NEXT_PUBLIC_API_URL`, `API_URL`, `WEB_PORT`), **API** (`VESTE_ENVIRONMENT`, `VESTE_CORS_ORIGINS`, `VESTE_CORS_ALLOW_ANY_ORIGIN_IN_DEV`, `VESTE_TRUSTED_HOSTS`, `VESTE_LOG_JSON`, `VESTE_LOG_LEVEL`, `VESTE_UVICORN_WORKERS`, `VESTE_UVICORN_TIMEOUT_KEEP_ALIVE`, `VESTE_FORWARDED_ALLOW_IPS`, `VESTE_MAX_PHOTO_BYTES`), **DATABASE** (`POSTGRES_*`, `VESTE_DATABASE_URL`, `VESTE_AUTO_CREATE_SCHEMA`, `VESTE_RUN_MIGRATIONS`, `VESTE_DB_WAIT_SECONDS`, `VESTE_AUTO_SEED`), **TRYON** (`VESTE_TRYON_*` do lado da API e `TRYON_*` do serviço). Nenhum secret real; `.gitignore` já exclui `.env`, checkpoints (`apps/tryon/models`), `vendor/CatVTON`, `output`, `tmp`, `*.db`; `.dockerignore` exclui `node_modules`, `.venv`, `.next`, `*.db`, `docs`.

Novo `.gitattributes`: `*.sh`, `docker/*.env` e `Dockerfile*` com `eol=lf` (checkout Windows com `autocrlf=true`).

## 6. Preparação para produção (sem cloud)

Implementado em `apps/api/app/core/config.py`, `core/logging.py`, `main.py`:
- **CORS**: em `VESTE_ENVIRONMENT=production` somente `VESTE_CORS_ORIGINS`; fora de produção qualquer origem (widget em páginas de terceiros), sem credenciais. Antes o código concatenava `["*"]` sempre.
- **Trusted hosts**: `TrustedHostMiddleware` quando `VESTE_TRUSTED_HOSTS != ["*"]`.
- **Logs estruturados**: `VESTE_LOG_JSON=true` → uma linha JSON por evento (`ts, level, logger, message, exc_type`), uvicorn alinhado ao mesmo handler; nível por `VESTE_LOG_LEVEL`.
- **Reverse proxy futuro**: `--proxy-headers` + `VESTE_FORWARDED_ALLOW_IPS`; web em `NODE_ENV=production`, `HOSTNAME=0.0.0.0`.
- **Workers/timeouts**: `VESTE_UVICORN_WORKERS` (padrão 1 — o try-on síncrono ocupa um thread do pool por ≈26–37 s; `run_in_threadpool` não bloqueia o event loop), `keep-alive 75 s`, `VESTE_TRYON_TIMEOUT_S=120`, tryon `--timeout-keep-alive 120`.
- **Upload**: `VESTE_MAX_PHOTO_BYTES`/`VESTE_TRYON_MAX_PHOTO_BYTES` (8 MiB) na API e `TRYON_MAX_UPLOAD_MB=8` no serviço.
- Imagens non-root (`nextjs`, `veste`, `tryon`), `PYTHONDONTWRITEBYTECODE`, sem cache de pip/npm nas camadas finais.

## 7. Try-on síncrono (decisão mantida)

Sem fila externa nesta etapa. Comportamento: `POST /api/v1/tryon` mantém a conexão aberta durante a inferência — **≈37 s** no host Windows (WDDM) e **25,8 s** medidos dentro do container Linux (RTX 5070, bf16, 768×1024, 50 passos); `TRYON_MAX_CONCURRENT_JOBS=1` → segundo usuário simultâneo recebe `provider_busy` (429 → 503 na API) com `Retry-After`. Para produção multiusuário será necessária fila/worker assíncrono e polling de `GET /tryon/{job_id}` (a abstração de job já existe — Etapa 6).

## 8. NVIDIA Container Toolkit

Requisito para o profile `gpu`: Linux com [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/) (`nvidia-ctk runtime configure --runtime=docker`) ou Windows com Docker Desktop (backend WSL2) + driver NVIDIA recente — o driver do host é usado dentro do container; a imagem só traz o CUDA runtime 12.8.

Validado neste ambiente (Docker Desktop 29.7.2, WSL2, runtime `nvidia` listado em `docker info`):

```text
docker run --rm --gpus all nvidia/cuda:12.8.1-base-ubuntu24.04 nvidia-smi
→ NVIDIA GeForce RTX 5070 · driver 616.64 (KMD) · CUDA 13.4 (UMD) · 12227 MiB
```

## 9. Comandos

```powershell
# sem GPU (postgres + api + web)
npm run docker:up            # docker compose -f docker/docker-compose.yml up --build
npm run docker:build
# com GPU (+ tryon, provador com foto ligado)
npm run docker:up:gpu        # docker compose -f docker/docker-compose.yml --env-file docker/gpu.env up --build
npm run docker:build:gpu
# parar (volumes preservados) / apagar volumes
npm run docker:down
npm run docker:down:volumes
# portas alternativas (ex.: API local ja na 8000)
$env:API_PORT="8010"; $env:WEB_PORT="3010"; $env:POSTGRES_PORT="5433"; $env:NEXT_PUBLIC_API_URL="http://localhost:8010"
```

URLs: web `http://localhost:3000`, API/Swagger `http://localhost:8000/docs`, tryon (diagnóstico) `http://localhost:8100/health`.

## 10. Builds e validação executados

| Build | Resultado | Tempo / tamanho |
|---|---|---|
| `docker build -f docker/Dockerfile.api` | PASS | 74 s · 546 MB |
| `docker build -f docker/Dockerfile.web` | PASS | 73 s · 274 MB (`next build` 23 s, standalone com `apps/web/server.js`) |
| `docker build -f docker/Dockerfile.tryon` | PASS | ≈12 min (pip torch cu128 337 s, export 196 s) · 19,8 GB |

Compose sem GPU (projeto `veste-e7`, portas 5433/8010/3010 por conflito com os serviços locais em execução):
- `db healthy` → `api healthy` (11 s: prestart 1 tentativa, `alembic upgrade` 0001+0002, seed 10 produtos / 320 análises, logs JSON) → `web healthy`.
- `GET http://localhost:3010/` → 200; `GET /api/v1/health` → `database: postgresql`, `tryon: {enabled:false, provider:catvton, available:false}`; `POST /recommendations` → `M`, `fit_score 8.8`; `GET /analise/{id}` → 200; `GET /tryon/status` → disabled; `alembic_version = 4b2a7c9e1d06`, 4 produtos com `flat_image_url`.

Compose com GPU (`--env-file docker/gpu.env`, mesmo projeto):
- `tryon` healthy após 118 s (download de 6,0 GB para `veste_hf_cache` + load); `/health`: `cuda`, `NVIDIA GeForce RTX 5070`, `torch 2.7.1+cu128`, `CUDA 12.8`, `bf16`, `modelLoaded: true`.
- `api` recriado com `VESTE_TRYON_ENABLED=true` → `/health.tryon.available: true`.
- `POST /api/v1/tryon` (foto de exemplo pública do CatVTON, CAMISETA-001-M) → **200 em 25,8 s**, `completed`, imagem 768×1024 via proxy; `/tmp/tryon` (tmpfs) vazio após a inferência, 1 PNG em `/data/results`.
- Erro encontrado e corrigido: tmpfs montado `root:root 755` → `PermissionError` no DensePose (422 `preprocessing_error`). Correção: `uid/gid/mode` explícitos no tmpfs e `gid` fixo 10002 na imagem.

Testes: `npm run typecheck` (5 workspaces OK), `npm run test:web` (36), `npm run test:widget` (3), `pytest apps/api` (67), `pytest apps/tryon` (14) — todos PASS. `prestart` validado em SQLite (novo / legado / idempotente).

Artefatos gitignored: `apps/tryon/output/e2e_docker_result.png`, `e2e_docker_report.json`.

## 11. Arquivos

Criados: `docker/Dockerfile.tryon`, `docker/api-entrypoint.sh`, `docker/gpu.env`, `apps/api/app/prestart.py`, `apps/api/app/core/logging.py`, `.gitattributes`, `docs/implementation/ETAPA_07_DOCKER_DEPLOYMENT.md`.

Modificados: `docker/Dockerfile.web`, `docker/Dockerfile.api`, `docker/docker-compose.yml`, `docker/README.md`, `apps/api/pyproject.toml` (httpx em runtime), `apps/api/app/core/config.py`, `apps/api/app/main.py`, `.env.example`, `package.json` (scripts docker), `docs/VIRTUAL_FITTING_ARCHITECTURE.md`.

Não alterados: `apps/api/app/engine/**`, `apps/tryon/**`, `apps/web/**`, `packages/**`.

## 12. Limitações

- Imagem `tryon` com 19,8 GB (CUDA runtime + cuDNN + torch cu128 + detectron2 vendorizado); sem otimização de camadas nesta etapa.
- Try-on síncrono e `MAX_CONCURRENT_JOBS=1` (seção 7).
- `NEXT_PUBLIC_API_URL` é inlined no build do web: trocar a URL pública da API exige rebuild da imagem.
- `web` depende de `api healthy` por conveniência de demo; em produção com múltiplas réplicas isso deve ser relaxado.
- `prestart` cobre bancos legados do `create_all` só para as revisões conhecidas; bancos alterados manualmente exigem `alembic stamp` explícito.
- Sem TLS/reverse proxy no compose (responsabilidade da camada de deployment).
- Validação GPU feita em Docker Desktop/WSL2; Linux nativo com NVIDIA Container Toolkit segue o mesmo `gpus: all`, mas não foi exercitado aqui.

## 13. Pendências para cloud

- Escolha de provedor GPU (não decidido): o serviço `tryon` é um container autocontido com volume de modelos — portável para qualquer host com NVIDIA Container Toolkit.
- Registry e CI para as três imagens (`.github/workflows/ci.yml` ainda não builda Docker nem roda web/3D).
- Fila assíncrona para o try-on + limpeza periódica de jobs/resultados expirados.
- Secrets (Postgres, chaves B2B) via secret manager; `VESTE_TRUSTED_HOSTS`/`VESTE_CORS_ORIGINS` reais; TLS no reverse proxy.
- Autenticação de consumidor antes de expor o provador com foto publicamente.
- Observabilidade: coleta dos logs JSON e métricas de duração/erros do try-on.
