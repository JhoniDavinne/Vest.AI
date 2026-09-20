# ETAPA 06 — Integração VESTE.AI ↔ CatVTON

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_02..05`.
Branch: `feature/virtual-fitting`. Data da execução: 2026-09-20.

## Objetivo e escopo

Ligar o serviço CatVTON local (`apps/tryon`, Etapa 5) ao produto: frontend → API principal → provider → `apps/tryon` → imagem. O CatVTON é **somente representação visual**: tamanho, score, confiança e justificativas continuam vindo exclusivamente do `RecommendationEngine` (nada foi alterado em `apps/api/app/engine`). O runtime de `apps/tryon` não foi modificado.

## Status final

**ETAPA 6 CONCLUÍDA.** Critérios obrigatórios:

| Critério | Resultado |
|---|---|
| 1. Frontend não chama o CatVTON diretamente | PASS — `apps/web` só fala com `apps/api` (`/api/v1/tryon*`); a imagem é entregue por proxy (`GET /api/v1/tryon/{job_id}/image`); nenhum `8100` no bundle |
| 2. API principal usa provider | PASS — `VirtualTryOnProvider` (Protocol) + `CatVTONProvider` (HTTP) em `apps/api/app/services/tryon/` |
| 3. Consentimento funciona | PASS — `consent_tryon=true` obrigatório; sem ele → 422 `consent_required` **antes** de qualquer upload ao provider (testes API + E2E) |
| 4. `flat_image_url` vem do produto | PASS — `Product.flat_image_url` (model, schema, migration, seed); a peça é lida dos assets internos; URL do usuário nunca é aceita |
| 5. CatVTON real gera resultado | PASS — 2 gerações reais via API principal (37,6 s e 36,6 s) + 1 cache hit (0,03 s) |
| 6. Frontend exibe resultado | PASS — `consent_required → uploading → processing → completed` no browser, imagem 768×1024 renderizada via proxy |
| 7. Falha do CatVTON não quebra a recomendação | PASS — provider offline: `/health.tryon.available=false`, `POST /tryon` → 503 `provider_unavailable`, `GET /recommendations/{id}` continua 200 com o mesmo `recommended_size`/`fit_score` |
| 8. Fotos não são persistidas | PASS — `tryon_jobs` só tem metadados (inspeção de colunas e valores nos testes); logs sem nome de arquivo/bytes/base64; temporários do provider vazios após o E2E |
| 9. Testes passam | PASS — API 67 (35 novos), web 36 (30 novos), typecheck do monorepo e eslint dos arquivos novos limpos |

## 1. Arquitetura

```text
apps/web  result-view.tsx ──▶ TryOnPanel (apresentacional) ◀── lib/tryon.ts (maquina de estados)
   │  POST /api/v1/tryon (multipart person + analysis_id + size? + consent_tryon)
   │  GET  /api/v1/tryon/status · GET /api/v1/tryon/{job_id} · GET /api/v1/tryon/{job_id}/image (proxy PNG)
   ▼
apps/api  routes/tryon.py ──▶ services/tryon/service.py
                                ├─ consentimento → FitAnalysis → tamanho (recomendado | seleção válida) → Product.flat_image_url
                                ├─ validate_photo (memória) → cache_key → TryOnJob (metadados)
                                └─ VirtualTryOnProvider.submit() ──▶ CatVTONProvider (httpx)
                                                                        │ POST /try-on · GET /results/{id} · DELETE
                                                                        ▼
apps/tryon (Etapa 5, intocado)  CatVTONRuntime em GPU → PNG com TTL
```

Execução **síncrona** na v1 (o job transita `processing → completed|failed` na mesma chamada), mas a abstração de job (`TryOnJob`, estados `queued|processing|completed|failed|expired`, `GET /tryon/{job_id}`) já existe para uma futura fila assíncrona.

## 2. Provider

`apps/api/app/services/tryon/provider.py` — `VirtualTryOnProvider` (Protocol): `health()`, `submit(person, garment, cloth_type)`, `result_exists()`, `fetch_result()`, `delete_result()`; tipos `ProviderHealth`, `ProviderResult` (referência opaca ao resultado — nunca a imagem).

`catvton_provider.py` — `CatVTONProvider(base_url, timeout_s, health_timeout_s, transport=None)` reutiliza o contrato da Etapa 5 sem alterá-lo. Nomes de arquivo fixos (`person.jpg`/`garment.jpg`): o nome original do upload não é propagado. `model_version` derivada de `precision/resolution` do provider (`catvton-mix:bf16/768x1024`) para a chave de cache.

Tradução de erros (`errors.py`, todos com `code` estável e mensagem sem detalhes internos):

| Provider (apps/tryon) | Erro na API | HTTP | Mensagem ao usuário |
|---|---|---|---|
| conexão recusada / DNS / health ≠ ok | `provider_unavailable` | 503 | visualização temporariamente indisponível |
| timeout (`VESTE_TRYON_TIMEOUT_S`) | `provider_timeout` | 504 | a geração demorou mais que o esperado |
| 429 `busy` | `provider_busy` (+`Retry-After`) | 503 | provador ocupado, tente em instantes |
| 503 `cuda_out_of_memory` | `provider_out_of_memory` | 503 | temporariamente indisponível |
| 503 `model_not_loaded` / `cuda_unavailable` | `provider_unavailable` | 503 | idem |
| 400/413/415/422 (imagem) | `provider_rejected_input` | 422 | foto não pôde ser processada |
| demais | `provider_error` | 502 | não foi possível gerar |

Provider selecionado por `VESTE_TRYON_PROVIDER` (só `catvton` implementado; valor desconhecido falha explicitamente). Nos testes o provider é injetado via `app.dependency_overrides[service.get_provider]`.

## 3. Endpoints da API principal

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/health` | ganha `"tryon": { enabled, provider, available }` — sem caminhos, cache ou GPU. `available` consulta o provider com cache de 10 s |
| GET | `/api/v1/tryon/status` | mesmo objeto, para o frontend |
| POST | `/api/v1/tryon` | multipart `person`, `analysis_id`, `consent_tryon` (bool), `size` (opcional) → `TryOnJobOut` |
| GET | `/api/v1/tryon/{job_id}` | estado do job (marca `expired` quando o TTL passou) |
| GET | `/api/v1/tryon/{job_id}/image` | PNG por proxy (`Cache-Control: private, no-store`); 410 `result_expired` quando o provider já descartou |
| DELETE | `/api/v1/tryon/{job_id}` | descarta o resultado no provider e marca o job como `expired` |

`TryOnJobOut`: `job_id, status, analysis_id, product_id, sku, size, recommended_size, provider, cached, image_url, duration_ms, error_code, created_at, expires_at, disclaimer, size_note`. Erros: `{ detail, code, retry_after_seconds? }` (handler de `TryOnError` em `main.py`).

Fluxo de `service.create_tryon`: `tryon_enabled` → consentimento → `FitAnalysis` → tamanho (`size` do usuário validado contra `product.sizes`, padrão `analysis.recommended_size`; **o provider nunca escolhe**) → `flat_image_url` → bytes da peça (`garment_images.py`) → `validate_photo` → health do provider → cache → `TryOnJob(processing)` → `submit` → `completed|failed`. `cloth_type` deriva da categoria (`tshirt/shirt/polo/hoodie/jacket → upper`, `pants/shorts → lower`, `dress → overall`) — parâmetro de máscara, não de tamanho.

## 4. Dados: `Product.flat_image_url` e `TryOnJob`

- `Product.flat_image_url: String(400)`, default `""` (= try-on indisponível para o produto). Exposto em `ProductSummary/ProductOut` com o derivado `tryon_supported: bool`; aceito em `ProductCreate`.
- Origens permitidas (`garment_images.py`): caminho interno `/assets/flat/<nome>.jpg|png|webp` (regex estrita, sem `..`/`/`), servido por `StaticFiles` em `/assets` (`apps/api/app/assets`), ou URL `http(s)` cujo host esteja em `VESTE_TRYON_FLAT_IMAGE_ALLOWED_HOSTS` (padrão vazio). Qualquer outra coisa → 422 `flat_image_unavailable`.
- Assets do seed (`app/assets/flat/`): `camiseta-essential.jpg`, `camisa-oxford.jpg`, `polo-piquet.jpg`, `moletom-canguru.jpg` (864×1152, fundo branco). São **imagens de demonstração geradas por IA** (não fotos de produtos reais); os SVGs ilustrativos de `image_url` continuam só para o catálogo. Os outros 6 produtos do seed ficam com `tryon_supported=false` (o painel informa "peça ainda não possui imagem compatível").
- `TryOnJob` (`tryon_jobs`): `id, analysis_id, product_id, sku, size, cloth_type, provider, model_version, status, consent, cache_key, result_ref, duration_ms, error_code, created_at, updated_at, expires_at`. Nenhuma coluna de imagem/bytes/base64; o PNG fica só no provider (TTL) e é referenciado por `result_ref`.
- Migration Alembic `0002_tryon.py` (`4b2a7c9e1d06`): `ADD COLUMN products.flat_image_url` + `CREATE TABLE tryon_jobs`. Para o modo demo (`auto_create_schema`, SQLite), `core/database.ensure_compat_schema()` adiciona a coluna em bancos já existentes e `seed/run.backfill_flat_images()` preenche os 4 produtos — ambos idempotentes, executados no `lifespan`.

## 5. Consentimento e privacidade

- Campo explícito `consent_tryon=true` na requisição; não reutiliza `User.photo_consent` nem `PhotoAnalysis.consent`. Sem consentimento: 422 `consent_required`, nenhum byte enviado ao provider, nenhum job criado (teste `test_consent_required_blocks_before_upload`).
- Foto: lida com limite (`max+1` bytes), validada em memória (`validate_photo`: vazio, tamanho, MIME, extensão, formato real Pillow, lados 256–4096, EXIF normalizado, reencode JPEG), enviada ao provider com nome fixo e descartada (`del`) após o `submit`. Nunca gravada em disco pela API; o provider remove os temporários do DensePose (verificado vazio após o E2E).
- Cache: chave = `sha256(sha256(foto) | sha256(peça) | sku | tamanho | provider | model_version)`; só o digest composto (64 hex) é persistido — não reversível à foto.
- Logs (`veste.tryon`, `veste.tryon.catvton`): `job_id, sku, provider, status, duração, código` — sem bytes, base64, nomes originais ou mensagens internas do provider. Verificado por busca no log do E2E (0 ocorrências de `model_5`/`base64`/`photo`).
- Frontend: `FormData` com nome fixo `photo`; preview local via `URL.createObjectURL` revogado ao trocar o arquivo.

## 6. Cache determinístico

Onde: tabela `tryon_jobs` (`cache_key` indexado) + resultado no provider. Hit exige job `completed`, não expirado **e** `provider.result_exists(result_ref)` (o provider pode ter reiniciado); caso contrário o job antigo vira `expired` e uma nova inferência é feita. Resposta com `cached: true` e o mesmo `job_id`. Medido no E2E: 37,6 s (miss) → 0,03 s (hit); foto ou tamanho diferentes → nova inferência.

## 7. Configuração

`apps/api/app/core/config.py` (prefixo `VESTE_`), refletido em `.env.example`:

| Variável | Padrão | Uso |
|---|---|---|
| `VESTE_TRYON_ENABLED` | `false` | desligado a aplicação funciona normalmente; painel não renderiza; `POST /tryon` → 503 `tryon_disabled` |
| `VESTE_TRYON_PROVIDER` | `catvton` | seleção do provider |
| `VESTE_TRYON_URL` | `http://127.0.0.1:8100` | base do `apps/tryon` |
| `VESTE_TRYON_TIMEOUT_S` | `120` | timeout do `POST /try-on` (inferência ≈ 37 s) |
| `VESTE_TRYON_HEALTH_TIMEOUT_S` | `2` | timeout do health/`result_exists` |
| `VESTE_TRYON_RESULT_TTL_S` | `900` | TTL do job na API (mín. com `expiresAt` do provider) |
| `VESTE_TRYON_MAX_PHOTO_BYTES` | 8 MiB | limite da foto |
| `VESTE_TRYON_FLAT_IMAGE_ALLOWED_HOSTS` | `[]` | allowlist para `flat_image_url` remoto |

## 8. Frontend (`apps/web`)

- `src/lib/tryon.ts` — máquina de estados pura (`tryOnReducer`, `mapTryOnError`, `TRYON_COPY`, `msUntilExpiry`) com fases `idle | consent_required | uploading | processing | completed | failed | provider_unavailable | expired`.
- `src/components/fit/tryon-panel.tsx` — painel apresentacional "Provador com foto" com badge **Experimental**; renderiza cada fase com os textos obrigatórios: "Ver em meu corpo", "Aceite o processamento da foto para continuar.", "Enviando foto...", "Gerando sua visualização...", "Não foi possível gerar a visualização.", "A visualização em IA está temporariamente indisponível. Sua recomendação de tamanho continua disponível.", "O resultado expirou. Gere uma nova visualização.". Disclaimer junto ao resultado: "Visualização gerada por IA. O caimento real pode apresentar diferenças." + "A recomendação de tamanho é baseada nas medidas e dados técnicos da peça, não na imagem gerada." (também no cabeçalho do painel). Mostra "tamanho L (recomendado: M)" quando o usuário visualiza outro tamanho.
- `src/components/fit/result-view.tsx` — única integração: `useReducer(tryOnReducer)`, `api.tryOnStatus()` para habilitar o painel, `submitTryOn()` enviando `size = selectedSize` (seleção válida do provador 3D/seletor; padrão recomendado), timer de expiração, `AbortController` no reset/unmount. Nada em `base` (recomendação) é alterado.
- `src/lib/api.ts` — `ApiError.code/retryAfterSeconds`, `parseApiError`, `upload()` via `XMLHttpRequest` (evento `upload.onload` → fase `processing`), `api.tryOnStatus/tryOn/tryOnJob/tryOnImageUrl/deleteTryOn`.
- Padrões reaproveitados de `consumer/photo-upload.tsx`: área de drop/clique, preview com botão remover, mensagens de erro em `bg-clay/10`, aviso de privacidade. Widget não alterado.
- `packages/contracts`: `ProductSummary.flat_image_url/tryon_supported`, `ProductCreate.flat_image_url`, `TryOnStatus`, `TryOnAvailability`, `TryOnJob`, `TryOnErrorCode`, `HealthResponse.tryon`.
- `apps/web/vitest.config.ts` (novo): alias `@` → `src` e `include` de `.test.ts(x)` para permitir testes de componente com `react-dom/server`.

## 9. Tratamento de erros no frontend (`mapTryOnError`)

| Código | Fase | Texto |
|---|---|---|
| `provider_unavailable`, `provider_out_of_memory`, `tryon_disabled`, `network_error`, 5xx sem código | `provider_unavailable` | indisponível; recomendação continua |
| `provider_busy` | `failed` | "ocupado no momento, tente em instantes" (+ `retryAfterSeconds`) |
| `provider_timeout` | `failed` | "demorou mais que o esperado" |
| `invalid_photo`, `photo_too_large`, `unsupported_photo_type`, `provider_rejected_input` | `failed` | mensagem controlada da API |
| `flat_image_unavailable` | `failed` | peça sem imagem compatível |
| `consent_required` | `consent_required` | aceite o processamento |
| `result_expired` (ou `onError` da `<img>`, ou timer `expires_at`) | `expired` | gere uma nova visualização |
| outros | `failed` | genérico; nunca stack trace |

## 10. Arquivos

Criados:
- `apps/api/app/services/tryon/{__init__,provider,catvton_provider,service,garment_images,errors}.py`
- `apps/api/app/api/v1/routes/tryon.py`
- `apps/api/alembic/versions/0002_tryon.py`
- `apps/api/app/assets/flat/{camiseta-essential,camisa-oxford,polo-piquet,moletom-canguru}.jpg`
- `apps/api/tests/test_tryon.py`
- `apps/web/src/lib/tryon.ts`, `apps/web/src/lib/tryon.test.ts`
- `apps/web/src/components/fit/tryon-panel.tsx`, `apps/web/src/components/fit/tryon-panel.test.tsx`
- `apps/web/vitest.config.ts`
- `docs/implementation/ETAPA_06_CATVTON_INTEGRATION.md`

Modificados:
- `apps/api/app/core/config.py` (settings `tryon_*`), `apps/api/app/core/database.py` (`ensure_compat_schema`), `apps/api/app/main.py` (handler `TryOnError`, `StaticFiles /assets`, compat/backfill no lifespan)
- `apps/api/app/models/entities.py` (`Product.flat_image_url`, `TryOnJob`), `apps/api/app/models/__init__.py`
- `apps/api/app/schemas/__init__.py` (`flat_image_url`, `tryon_supported`, `TryOnJobOut`, `TryOnStatusOut`, `TryOnErrorOut`)
- `apps/api/app/services/mappers.py`, `apps/api/app/services/product_service.py`
- `apps/api/app/seed/catalog.py` (`flat_image`), `apps/api/app/seed/run.py` (seed + `backfill_flat_images`)
- `apps/api/app/api/v1/routes/health.py`, `apps/api/app/api/v1/router.py`
- `apps/web/src/lib/api.ts`, `apps/web/src/components/fit/result-view.tsx`
- `packages/contracts/src/index.ts`
- `.env.example`, `docs/VIRTUAL_FITTING_ARCHITECTURE.md`

Não alterados: `apps/api/app/engine/**`, `apps/api/app/services/recommendation_service.py`, `apps/tryon/**`, `packages/widget/**`.

## 11. Testes automatizados

API (`apps/api/tests/test_tryon.py`, provider stub — sem GPU): produto expõe `flat_image_url/tryon_supported` e asset servido; health com try-on desligado/ligado; try-on desligado (503, recomendação segue); consentimento ausente (422, nenhum job/upload); análise inexistente (404); tamanho inválido (422); produto sem flat (422); validação da foto (vazia, inválida, GIF, pequena, > 8 MB); provider offline antes do submit; erros do provider (unavailable/timeout/busy/OOM/rejected/error) traduzidos, registrados no job como `failed` e recomendação inalterada; fluxo `completed` com metadados apenas (colunas e valores inspecionados), imagem via proxy, `cloth_type` e peça vindos dos dados internos; cache hit sem nova inferência; tamanho escolhido pelo usuário ≠ recomendado; expiração/DELETE/404. `CatVTONProvider` com `httpx.MockTransport`: health, POST (nome fixo, `cloth_type`), `fetch/exists`, tradução de 429/503/400/415/500, timeout, offline. Total da suíte: **67 passed**.

Frontend (`vitest`): `tryon.test.ts` (18) — fluxo idle→consent→uploading→processing→completed, bloqueio sem consentimento/foto, expired/reset, mapeamento de todos os códigos, busy com `retry_after`, `msUntilExpiry`. `tryon-panel.test.tsx` (12, `renderToStaticMarkup`) — seção experimental, consentimento com botão desabilitado, loading, completed (imagem por proxy, disclaimer, nunca a URL do provider), cache badge, failed, provider_unavailable (health ou erro), expired, produto sem flat, painel oculto quando desligado. Total web: **36 passed**. `npm run typecheck` (5 workspaces) e `eslint` dos arquivos novos: limpos.

## 12. Teste real local (E2E)

Serviços: `apps/tryon` (`uvicorn service.main:app --port 8100`, RTX 5070, modelo carregado), `apps/api` (`VESTE_TRYON_ENABLED=true VESTE_TRYON_URL=http://127.0.0.1:8100`, SQLite `veste_ai.db` já existente → `ensure_compat_schema` adicionou `flat_image_url` e o backfill aplicou as 4 imagens), `apps/web` (`next dev` na 3000).

1. `GET /api/v1/health` → `tryon: {enabled: true, provider: catvton, available: true}`; produto `camiseta-essential-algodao` com `flat_image_url=/assets/flat/camiseta-essential.jpg`, `tryon_supported=true`.
2. `POST /recommendations` (CAMISETA-001-M) → análise `4666782a…`, recomendado **M**.
3. Via API: sem consentimento → 422 `consent_required`; com consentimento → **200 em 37,6 s**, `status=completed`, `image_url=/api/v1/tryon/{job}/image`; PNG 768×1024 válido; segunda chamada idêntica → `cached: true` em 0,03 s.
4. Via browser (`/analise/4666782a…`): painel "Provador com foto · Experimental" em `idle` → "Ver em meu corpo" → formulário com consentimento (botão desabilitado até marcar e escolher foto) → foto de exemplo pública (`model_5.png`, do repositório oficial do CatVTON) → fases observadas por `MutationObserver`: `consent_required → uploading (12 ms) → processing (338 ms) → completed`. Primeira geração reaproveitada do cache ("Resultado reaproveitado"); depois, selecionando **L** no seletor: nova inferência real, `completed` em **36,96 s**, imagem renderizada, cabeçalho "tamanho L (recomendado: M)", recomendação M inalterada acima.
5. Falha do provider: API secundária apontando para `http://127.0.0.1:8199` (porta morta) → `health.tryon.available=false`; `POST /tryon` → 503 `{code: provider_unavailable}`; `GET /recommendations/{id}` → 200, `M`, `fit_score 8.8` antes e depois.
6. Privacidade: `tryon_jobs` com 2 linhas (só metadados, `cache_key` 64 hex, `result_ref` opaco); log da API sem `model_5`/`base64`/`photo`; `%LOCALAPPDATA%\veste-ai\tryon\tmp` vazio.

Artefatos (gitignored): `apps/tryon/output/e2e_api_result.png`, `apps/tryon/output/e2e_api_report.json`.

## 13. Limitações

- v1 síncrona: a requisição HTTP fica aberta ≈ 37 s; `MAX_CONCURRENT_JOBS=1` no provider → segundo usuário simultâneo recebe `provider_busy`. Fila/worker assíncrono e polling de `GET /tryon/{job_id}` ficam para a etapa de deployment.
- Imagens flat do seed são geradas por IA (demonstração); catálogo real exigirá fotos flat dos produtos. Só 4 dos 10 produtos têm try-on.
- Sem autenticação de consumidor: `analysis_id` é o único vínculo (qualquer portador do id pode gerar try-on para aquela análise). Bloqueador conhecido antes de ambiente compartilhado.
- Cache reaproveita resultado entre chamadas com a mesma foto/peça/tamanho enquanto o TTL (15 min) durar — intencional, mas depende do provider manter o PNG.
- `ensure_compat_schema` cobre só a coluna nova em modo demo; em PostgreSQL a fonte é o Alembic (`alembic upgrade head`).
- Licença do CatVTON (CC BY-NC-SA 4.0, uso não comercial) herdada por toda a feature.

## 14. Pendências

- Docker: perfil GPU opcional para `apps/tryon`, `VESTE_TRYON_URL=http://tryon:8100` no compose, correção pendente do `Dockerfile.web` (`packages/fit-preview-3d`).
- Processamento assíncrono (fila + `GET /tryon/{job_id}` com polling) e limpeza periódica de jobs expirados.
- Autenticação/sessão do consumidor antes de expor publicamente.
- Fotos flat reais para os demais produtos; upload de `flat_image_url` no Studio B2B (`ProductCreate` já aceita o campo).
- Widget com try-on (fora do escopo, por decisão).
