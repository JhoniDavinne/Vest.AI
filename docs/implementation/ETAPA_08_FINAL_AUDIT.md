# ETAPA 08 — Auditoria final

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md` … `ETAPA_07_DOCKER_DEPLOYMENT.md`.
Branch: `feature/virtual-fitting`. Data: 2026-09-20.

Auditoria independente. Sem recriar arquitetura, sem refatoração estética, sem substituir soluções funcionais. Correções somente de problemas reais.

## Status para TCC

| Superfície | Classificação |
|---|---|
| Motor de recomendação | **READY** |
| Provador 3D | **READY WITH LIMITATIONS** |
| Virtual Try-On | **READY FOR DEMO** |
| Docker | **READY** |
| Demo local | **READY** |
| Deployment público | **REQUIRES SECURITY WORK** |

**ETAPA 8 CONCLUÍDA.**

## Invariante do motor (confirmado)

`RecommendationEngine` permanece a **única** fonte de tamanho recomendado, `fit_score`, confiança, regiões e justificativas.

| Camada | Papel | Recalcula caimento? |
|---|---|---|
| `recommendation_service.run_recommendation` | único ponto HTTP → motor | sim (motor) |
| `GET /recommendations/{id}?size=` | reavalia outro tamanho com o **mesmo snapshot** da análise | sim (motor); `recommended_size` e `analysis_id` preservados |
| Frontend (`result-view`, `fit-preview.test`) | consome `comparison[].fit_score/regions` ou detalhe da API | **não** |
| `packages/fit-preview-3d` | visualiza `FitVisualizationState` derivado do payload do motor | **não** |
| CatVTON / `apps/tryon` | gera PNG; recebe `cloth_type` e imagens | **não** (não devolve tamanho/score) |
| `tryon/service.create_tryon` | tamanho = `analysis.recommended_size` ou SKU válido escolhido; `recommended_size` ecoado da análise | **não** |

Validado no container (banco vazio + seed): `POST /recommendations` → `M / 8.8`; `GET /recommendations/{id}?size=L` → `evaluated_size=L`, `fit_score=8.4`, **`recommended_size` continua M**, mesmo `analysis_id`.

Nenhuma violação encontrada. Nenhuma correção de contrato do motor.

## Problemas encontrados

| # | Severidade | Problema | Ação |
|---|---|---|---|
| 1 | Média | `POST /tryon` lia o upload no event loop e passava a **mesma** `Session` SQLAlchemy para `run_in_threadpool` (Session não é thread-safe) | Corrigido: sessão criada no worker |
| 2 | Média | Fetch remoto de `flat_image_url` carregava o corpo inteiro antes do teto de 8 MiB (DoS se a allowlist tiver um host) | Corrigido: stream + `Content-Length` + corte por bytes |
| 3 | Média | Path interno da peça sem `resolve()`/`is_relative_to`; StaticFiles montava `app/assets` inteiro | Corrigido: resolve + mount só `/assets/flat` |
| 4 | Média | URL remota com userinfo (`https://evil@host/...`) era classificada pelo hostname da allowlist | Corrigido: rejeita username/password |
| 5 | Média | Trocar tamanho com try-on `processing`/`completed` podia aplicar resultado stale de outro SKU | Corrigido: abort + geração + reset |
| 6 | Média | Compose em `development` permitia fallback silencioso para SQLite se o Postgres falhasse após o prestart | Corrigido: `VESTE_ALLOW_SQLITE_FALLBACK=false` no Docker |
| 7 | Baixa | `/docs`, `/redoc` e OpenAPI abertos em `VESTE_ENVIRONMENT=production` | Corrigido: desligados em production |
| 8 | Alta (público) | `analysis_id` (e `GET /users/{id}`) sem autenticação de consumidor — IDOR conhecido | **Não** implementado auth completo (escopo). Ver § Autenticação |
| 9 | Info | `npm run lint:web`: 8 erros `set-state-in-effect` | Pré-existentes (Etapa 4); **não** em `tryon-panel`/`result-view`/`fit-preview-3d` |
| 10 | Info | Widget IIFE ainda empacota three/R3F (`embed.global.js` 4,37 MB) | Limitação conhecida; sem chunk separado nesta etapa |
| 11 | Info | Avatar/peça GLB reais ausentes — silhueta/primitivas | Limitação da Etapa 2; app não quebra |

## Correções realizadas

### 1. Sessão do try-on no worker

`apps/api/app/api/v1/routes/tryon.py`: o upload continua assíncrono (teto `max+1` bytes em memória); a persistência e o `provider.submit` usam `_create_tryon_in_worker` com `session_factory()()` no mesmo thread da inferência.

### 2–4. Imagem da peça

`apps/api/app/services/tryon/garment_images.py`:
- interno: regex + `Path.resolve()` + `is_relative_to(ASSETS_FLAT_DIR)` + arquivo regular + teto de bytes;
- remoto: `httpx.stream`, `follow_redirects=False`, allowlist de host **exata**, rejeição de userinfo, teto 8 MiB sem materializar payload maior;
- `garment_image` **nunca** vem de URL enviada pelo usuário (continua `Product.flat_image_url`).

`apps/api/app/main.py`: `StaticFiles` apenas em `/assets/flat`.

### 5. Estado do try-on × tamanho

`apps/web/src/components/fit/result-view.tsx`: contador `tryOnGeneration` + `AbortController`; troca de tamanho em `uploading`/`processing`/`completed` aborta e dá `reset` (consentimento/arquivo preservados pelo reducer); conclusão stale é ignorada; o painel mostra `job.size` quando `completed`. A recomendação (`base`) **não** é alterada.

### 6. Fallback SQLite

`allow_sqlite_fallback` (padrão `true` para demo local). Docker: `VESTE_ALLOW_SQLITE_FALLBACK=false` no compose e no `Dockerfile.api`. Falha de Postgres não mascara mais o banco.

### 7. Docs em produção

`docs_url` / `redoc_url` / `openapi_url` = `None` quando `environment == production`.

## Autenticação (análise, sem sistema novo)

`analysis_id` e `job_id` são UUID hex (`uuid.uuid4().hex`). Quem possui o ID consegue:
- `GET /recommendations/{id}` (snapshot de medidas + score);
- `POST /tryon` com esse ID (foto em memória; resultado via `job_id`);
- `GET /tryon/{job_id}/image` (PNG gerado);
- `GET /users/{id}` (perfil aberto — pré-existente).

Não é enumeração trivial (128 bits), mas **não é autorização**.

| Ambiente | Bloqueia? |
|---|---|
| **A) Demonstração local / TCC** | **Não.** Audiência controlada; UUID suficiente para a banca. |
| **B) Deployment público** | **Sim — REQUIRES SECURITY WORK.** Qualquer vazamento de `analysis_id` (URL `/analise/{id}`, referer, log de acesso) expõe medidas e permite gerar/visualizar try-on. |

Correção mínima para demo: nenhuma (não inventar auth parcial). Próximo passo real: sessão de consumidor ou token amarrado à análise **antes** de ambiente compartilhado. Não feito nesta etapa.

## Segurança

Confirmado:
- peça: nunca URL arbitrária do usuário; allowlist vazia por padrão (remoto bloqueado);
- foto: Pillow `verify` + formato real (não só MIME); JPG/PNG/WebP; dimensões 256–4096;
- CORS sem credenciais; em production só `VESTE_CORS_ORIGINS`;
- Trusted hosts configurável (`["*"]` no compose de demo — apertar no público);
- logs JSON sem bytes/base64/nome original da foto (`filename` só para extensão);
- erros do try-on: `code` estável, sem stack/CUDA no payload;
- `GET /health.tryon` = `{enabled, provider, available}` (sem caminhos/GPU);
- porta 8100 publicada **só para diagnóstico**; o frontend nunca chama o CatVTON.

Ainda aberto para público: IDOR (§ acima), senha Postgres default `veste`, `VESTE_DEMO_API_KEY` no bundle web, `/docs` em `development`, tryon `/health.lastError` se 8100 for exposto.

## Privacidade

Confirmado:
- foto do try-on só em memória na API; descartada após `provider.submit` (`del person, garment`);
- `TryOnJob` persiste metadados (`cache_key` = sha256 composto de 64 hex — **não** reversível para a imagem);
- colunas inspecionadas: nenhum `bytes`/base64;
- consentimento **específico** `consent_tryon=true`, distinto da análise corporal (sem ele: 422 antes do provider);
- CatVTON: DensePose em tmpfs (`/tmp/tryon`), cleanup após inferência; resultados PNG com TTL, nunca a foto original;
- proxy `Cache-Control: private, no-store`.

## Cache do try-on

Chave: `sha256(photoHash|garmentHash|sku|size|provider|modelVersion)` — os hashes internos também são SHA-256.

Confirmado por testes: foto não persistida; outro tamanho → outra chave; cache expirado (`expires_at` ou arquivo sumiu no provider) não é reutilizado (`_mark_expired`); hit não chama o provider.

## CatVTON (`apps/tryon`)

Sem alteração do pipeline nesta auditoria.

Confirmado no código e na Etapa 5/7: load único no `lifespan`; CUDA obrigatório (sem fallback CPU); bf16; `MAX_CONCURRENT_JOBS=1` (compose e default); `queue_wait_seconds=0` → busy imediato; OOM → `empty_cache` + 503; TTL de resultados; temp DensePose limpo; `/health` com `modelLoaded`; validação de entrada; segunda inferência sem reload.

GPU Docker **não reexecutada** nesta etapa (checkpoints já no volume `veste_hf_cache`, ~6 GB). Validação da Etapa 7 permanece: RTX 5070, `modelLoaded`, inferência 25,8 s.

## Frontend / 3D

- Máquina de estados `tryOnReducer`: idle, consent_required, uploading, processing, completed, failed, provider_unavailable, expired — coberta por 18 testes + 11 do painel.
- Object URL da prévia: `useMemo` + `revoke` no effect.
- `FitPreview3D`: um Canvas; `useGLTF` com clone; materiais da peça descartados no unmount; `WebGLContextGuard` + fallback 2D; manifest/placeholder; ausência de GLB **não** quebra a página (silhueta).
- Widget: try-on **não** integrado (escopo). `enable3D` default `false`.

## Docker / migrations

Compose sem GPU (esta etapa, banco **vazio**):
- `db healthy` → prestart: `upgrade  → 07f07de8bcbe → 4b2a7c9e1d06` → seed 10 produtos / 320 análises → `api healthy`.
- `python -m app.prestart` **repetido**: Alembic no head, sem reaplicar (idempotente).
- Health interno: `database: postgresql`, `tryon.enabled=false`.
- Recomendação: `M / 8.8`.
- Web: porta 3000 ocupada no host (Next local); imagem subiu em `WEB_PORT=3001`, health 200.

Profile GPU: não repetido (Etapa 7). Imagem `tryon` 19,8 GB intacta.

Non-root: `veste` 10001, `tryon` 10002, `nextjs`. tmpfs DensePose `uid=10002,gid=10002,mode=1770`. Restart `unless-stopped`. Secrets só via interpolação `${...}`.

## Testes executados

| Comando | Resultado | Notas |
|---|---|---|
| `npm run typecheck` | PASS | 5 workspaces |
| `npm run test:web` | PASS | 36 |
| `npm run test:widget` | PASS | 3 |
| `npx vitest run --root packages/fit-preview-3d` | PASS | 48 |
| `pytest apps/api` | PASS | 70 (67 + 3 de garment/assets) |
| `pytest apps/tryon` | PASS | 14 |
| `npm run build:web` | PASS | Next 16.3.5 |
| `npm run build:widget` | PASS | ESM + IIFE |
| `npm run lint:web` | FAIL 8+2 | **Pré-existentes** (empresa, catálogo, consumidor, `profile.tsx`). Nenhum em arquivos das Etapas 2–7 corrigíveis aqui |

## Performance (sem micro-otimização)

| Métrica | Valor | Comentário |
|---|---|---|
| Imagem Docker tryon | 19,8 GB | CUDA 12.8 + torch cu128; esperado |
| Startup tryon (1ª / seguintes) | ~118 s / ~15 s | Etapa 7; download HF no volume |
| Inferência | ~26 s container / ~37 s host | síncrono, `MAX_CONCURRENT_JOBS=1` |
| Widget IIFE | `embed.global.js` 4,37 MB / `index.global.js` 2,82 MB | three no mesmo bundle |
| 3D | placeholders se GLB ausente | um Canvas; cache `useGLTF` |
| Chamadas extra | `GET /tryon/status` no mount do resultado | barato; não afeta o motor |

## Licenças

| Item | Licença | Adequação |
|---|---|---|
| CatVTON código + checkpoints (`Zheng-Chong/CatVTON` @ `7818397f`, HF `zhengchong/CatVTON`) | **CC BY-NC-SA 4.0** | Adequado a **TCC / demonstração não comercial** |
| Base inpainting `booksforcharlie/stable-diffusion-inpainting` | herdada do pipeline oficial | mesmo regime não comercial da feature |
| three / R3F / drei | MIT | OK |
| Assets flat do seed | gerados para demo | catálogo real exige fotos da marca |
| Avatar/peça GLB (quando existirem) | CC0/própria (Etapa 2) | — |

**CatVTON (CC BY-NC-SA 4.0) não deve ser usado como backend comercial B2B sem revisão de licença e, se necessário, troca de modelo.** ShareAlike se aplica a adaptações.

## Riscos conhecidos (não bloqueiam a demo)

- IDOR de `analysis_id` / `user_id` (bloqueia só o **público**).
- Try-on síncrono + 1 job na GPU: segundo usuário recebe `provider_busy`.
- Job `processing` órfão se o processo morrer no meio da inferência (v1 síncrona).
- Porta 8100 e `/docs` em development.
- Heurística de morph 3D com 6 medidas; disclaimer obrigatório.
- CI GitHub ainda não roda typecheck/lint/test web/3D nem build Docker.

## Arquivos modificados nesta etapa

- `apps/api/app/api/v1/routes/tryon.py`
- `apps/api/app/services/tryon/garment_images.py`
- `apps/api/app/main.py`
- `apps/api/app/core/config.py`
- `apps/api/app/core/database.py`
- `apps/api/tests/test_tryon.py`
- `apps/web/src/components/fit/result-view.tsx`
- `docker/docker-compose.yml`
- `docker/Dockerfile.api`
- `.env.example`
- `docs/implementation/ETAPA_08_FINAL_AUDIT.md` (este)
- `docs/VIRTUAL_FITTING_ARCHITECTURE.md`

Não alterados: `apps/api/app/engine/**`, pipeline CatVTON (`apps/tryon/service/catvton_runtime.py`), widget try-on (inexistente).
