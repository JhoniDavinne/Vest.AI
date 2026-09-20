# Arquitetura do Provador Virtual (3D + Virtual Try-On)

Documento de orientação para as próximas etapas de implementação. Consolidado a partir da auditoria do repositório na branch `feature/virtual-fitting`.

Premissa invariável: `RecommendationEngine` (Python) continua a **única fonte** de tamanho recomendado, score, confiança e justificativas. Avatar 3D, Garment 3D e CatVTON apenas **visualizam** o resultado do motor; nunca o recalculam.

---

# Arquitetura atual

Monorepo npm workspaces + app Python independente.

| Camada | Local | Stack |
|---|---|---|
| Web | `apps/web` | Next.js 16.3.5 (App Router/RSC), React 19.2.8, TypeScript 5.9 strict, Tailwind 4, Framer Motion, Lucide, componentes shadcn-like em `apps/web/src/components/ui` |
| API | `apps/api` | FastAPI, Pydantic v2, pydantic-settings (prefixo `VESTE_`), SQLAlchemy 2, Alembic (`apps/api/alembic/versions/0001_initial_schema.py`), Python ≥ 3.11 |
| Banco | — | PostgreSQL (`psycopg`) com fallback automático para SQLite (`apps/api/app/core/database.py`) |
| Contratos | `packages/contracts/src/index.ts` | Tipos TS espelhando `apps/api/app/schemas/__init__.py` |
| 3D (v1) | `packages/fit-preview-3d` | `three@0.175`, `@react-three/fiber@9.7`, `@react-three/drei@10.7` |
| Widget | `packages/widget` | `<VesteFit />`, build tsup esm+iife, consome `fit-preview-3d` |
| Infra | `docker/docker-compose.yml`, `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/Dockerfile.tryon`, `docker/gpu.env`, `.github/workflows/ci.yml` | Postgres 16 + api + web (+ `tryon` GPU via profile `gpu`) — Etapa 7 |

Fluxo: `Web / Widget → POST /api/v1/recommendations → recommendation_service → RecommendationEngine → fit_analyses`.

---

# Motor de caimento existente

## Arquivos envolvidos

- `apps/api/app/engine/engine.py` — orquestração (`RecommendationEngine`)
- `apps/api/app/engine/types.py` — `BodyProfile`, `GarmentSize`, `GarmentSpec`, `VisualProportions`, `RegionResult`, `SizeEvaluation`, `RecommendationResult`, enums `Region`, `RegionStatus`, `Modeling`, `Category`, `FitPreference`, `Confidence`
- `apps/api/app/engine/config.py` — `EngineConfig` (pesos, tolerâncias, `design_ease_cm`, `region_weights`; override via env `VESTE_ENGINE_CONFIG`)
- `apps/api/app/engine/messages.py` — `build_explanation`, `build_recommendation`, `scale_band`, `STATUS_PT`
- `apps/api/app/engine/components/measurements.py` — `evaluate_regions`, `gaussian_score`, `measurements_score`
- `apps/api/app/engine/components/modeling.py`, `elasticity.py`, `preference.py`, `visual.py`, `confidence.py`
- `apps/api/app/services/recommendation_service.py` — único ponto de entrada HTTP → motor
- `apps/api/app/services/mappers.py` — `product_to_spec`, `measurements_to_body`, `photo_to_visual`
- `apps/api/app/services/fit_preview_mapper.py` — monta `fit_preview` (payload do 3D)

## Serviços / classes / funções principais

| Símbolo | Arquivo | Papel |
|---|---|---|
| `RecommendationEngine.evaluate_size()` | `engine/engine.py` | Avalia um SKU: regiões + 5 componentes → `SizeEvaluation` |
| `RecommendationEngine.recommend()` | `engine/engine.py` | Avalia todos os tamanhos, escolhe o melhor, calcula confiança e textos → `RecommendationResult` |
| `evaluate_regions()` | `engine/components/measurements.py` | Por região: `ease = peça − corpo`, `design_ease`, `deviation`, `score`, `status` |
| `compute_confidence()` | `engine/components/confidence.py` | `high/medium/low` + `confidence_score` |
| `run_recommendation()` | `services/recommendation_service.py` | `resolve_target` → `resolve_body` → `recommend` → `persist_analysis` → `build_response` |
| `build_fit_preview()` | `services/fit_preview_mapper.py` | `FitPreviewPayload { body, garment, regions, disclaimer }` |

## Entrada

`BodyProfile(height, weight, chest, waist, hip, shoulder)` · `GarmentSpec(category, modeling, elasticity_pct, fabric, sizes[GarmentSize])` · `FitPreference` · `VisualProportions | None` · `evaluated_sku`.

Via HTTP: `RecommendationRequest { sku | product_id+size, user_id | customer, fit_preference, photo_analysis_id, use_photo, channel, persist }`.

## Saída

`RecommendationResult` → `RecommendationResponse` (`apps/api/app/schemas/__init__.py`):
`recommended_size/sku`, `evaluated_size/sku`, `fit_score` (0–10), `confidence`, `confidence_score`, `confidence_message`, `scale_label/message`, `explanation`, `recommendation`, `regional_analysis`, `components`, `weights`, `regions[RegionDetail]` (com `body`, `garment`, `ease`, `design_ease`, `deviation`, `score`, `note`), `comparison[SizeComparison]` (hoje só `fit_score`, `components`, `regional_analysis` por tamanho), `visual_used`, `notes[]`, `fit_preview`.

Observação (Etapa 3): `RecommendationResult.comparison` contém `SizeEvaluation.regions` completos por tamanho e `build_response` agora os **propaga** em `SizeComparison.regions` (`region_details()` em `recommendation_service.py`), sem reexecutar `evaluate_size`.

## Onde o resultado é consumido

- Web: `apps/web/src/components/fit/result-view.tsx` (`/analise/[id]`), `apps/web/src/components/catalog/analyze-cta.tsx`, `apps/web/src/components/catalog/catalog-fit-preview-section.tsx`, `apps/web/src/app/empresa/api/page.tsx`
- Widget: `packages/widget/src/client.ts` (`VesteClient.recommend`) → `packages/widget/src/VesteFit.tsx`
- Persistência: `fit_analyses` via `persist_analysis`; recálculo determinístico em `GET /recommendations/{id}` (`apps/api/app/api/v1/routes/recommendations.py`)
- Seed/pipelines: `apps/api/app/seed/run.py`, `pipelines/examples/run_examples.py`

---

# Frontend

## Tela onde será integrado o provador

- Principal: `/analise/[id]` → `apps/web/src/app/analise/[id]/page.tsx` → `apps/web/src/components/fit/result-view.tsx` (seção "Provador visual 3D", modo `full`)
- Secundária: `/catalogo/[slug]` → `apps/web/src/app/catalogo/[slug]/page.tsx` → `apps/web/src/components/catalog/catalog-fit-preview-section.tsx` → `apps/web/src/components/catalog/product-fit-preview.tsx` (modo `medium`)
- Widget: `packages/widget/src/fit-preview-3d.tsx` (modo `compact`, prop `enable3D`)

## Componentes relevantes

- `apps/web/src/components/fit/fit-preview-3d-lazy.tsx` — `dynamic(..., { ssr: false })` + fallback com `RegionGrid`
- `apps/web/src/components/fit/size-comparison.tsx` — `SizeComparisonBars` (clique dispara nova chamada ao motor com `persist: false`)
- `apps/web/src/components/fit/region-grid.tsx` — `RegionGrid`, `STATUS_COLOR`
- `apps/web/src/components/fit/score-ring.tsx`, `confidence-badge.tsx`, `how-we-calculate.tsx`, `json-viewer.tsx`
- `apps/web/src/components/consumer/photo-upload.tsx` — padrão de upload com consentimento (reutilizável para VTO)
- `apps/web/src/components/consumer/measurement-form.tsx` — `BodyGuide` com `public/images/body-silhouette.png`
- Pacote 3D: `packages/fit-preview-3d/src/FitPreview3D.tsx`, `AvatarScene.tsx`, `AvatarBody.tsx`, `StylizedSilhouette.tsx`, `GarmentMesh.tsx`, `RegionalOverlay.tsx`, `scaleBody.ts`, `silhouette.ts`, `constants.ts`, `types.ts`, `useFitPreview.ts`, `WebGLContextGuard.tsx`

## Gerenciamento de estado

- Sem biblioteca global. Único contexto: `ProfileProvider` / `useProfile` em `apps/web/src/lib/profile.tsx` (guarda apenas `userId` em `localStorage`, chave `veste.profile.userId`, e refaz `GET /users/{id}`).
- Estado da tela de resultado é local (`useState`) em `result-view.tsx`: `base`, `current`, `product`, `loadingSize`, `previewPayload` (memo de `mergeFitPreviewPayload`).

## API client utilizado

- `apps/web/src/lib/api.ts` — objeto `api` (`recommend`, `getRecommendation(id, size?)`, `getProduct`, `getSizes`, `uploadPhoto`, …), `ApiError`, `apiBaseUrl()`; `fetch` com `cache: "no-store"`; headers `X-API-Key` opcional.
- Widget: `packages/widget/src/client.ts` (`VesteClient`).
- Tipos: `packages/contracts/src/index.ts`.

---

# Dados relevantes

| Dado | Tabela / campo (`apps/api/app/models/entities.py`) | Schema HTTP (`apps/api/app/schemas/__init__.py`) | Tipo TS (`packages/contracts/src/index.ts`) |
|---|---|---|---|
| Medidas corporais | `user_measurements` (`height, weight, chest, waist, hip, shoulder`) — última por `created_at` | `MeasurementsIn/Out`, `CustomerIn` | `Measurements`, `MeasurementsOut` |
| Proporções da foto | `photo_analyses` (`shoulder_hip_ratio, waist_hip_ratio, torso_leg_ratio, quality, source`) | `PhotoAnalysisOut` | `PhotoAnalysis` |
| Produtos | `products` (`category, modeling, fabric, composition, elasticity_pct, color, image_url`) | `ProductSummary`, `ProductOut` | `ProductSummary`, `Product` |
| SKU | `sku_sizes.sku` (único) | `SizeOut.sku` | `Size.sku` |
| Tamanhos | `sku_sizes.size_label`, `sort_order` | `SizeOut` | `Size` |
| Medidas das peças | `garment_measurements` 1:1 com SKU (`chest, waist, hip, shoulder, length, sleeve, width`) | `GarmentMeasurementIn` | `GarmentMeasurement` |
| Score | `fit_analyses.fit_score`, `components` JSON | `fit_score`, `components`, `weights` | `RecommendationResponse.fit_score` |
| Confiança | `fit_analyses.confidence`, `confidence_score` | `confidence`, `confidence_score`, `confidence_message` | idem |
| Justificativas | `fit_analyses.explanation`, `recommendation`, `regional_analysis` JSON, `comparison` JSON | `explanation`, `recommendation`, `regions[]`, `notes[]`, `scale_label/message` | idem |
| Snapshot | `fit_analyses.input_snapshot` JSON | — | — |

Seed: `apps/api/app/seed/catalog.py` (10 produtos), `apps/api/app/seed/run.py`, `database/seed/catalog.json`.

Lacunas: não há campo de asset 3D nem de imagem flat da peça em `products`/`sku_sizes`; `elasticity_pct` é por produto (não por SKU); o corpo tem apenas 6 medidas.

---

# Integração 3D

## Estado real do pacote `packages/fit-preview-3d` (após Etapa 2)

Detalhes em `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md`.

- Manifest `apps/web/public/models/manifest.json` (v2, com `placeholder` e `morphTargets`) **é lido** no cliente por `useModelsManifest.ts` / `manifest.ts` e é a única fonte de localização de assets.
- `AvatarBody.tsx`: GLB real (não-placeholder) → `useAvatarModel.ts` (`useGLTF` + clone + escala métrica + `avatarMorph.ts` aplicando `computeBodyScale` em morph targets); senão `StylizedSilhouette.tsx` (billboard com `apps/web/public/images/body-silhouette-alpha.png`).
- `GarmentMesh.tsx`: GLB por categoria → `useGarmentModel.ts` + `garmentVisual.ts` (cor, tecido, elasticidade, modelagem, medidas com escala limitada); senão `GarmentPrimitive.tsx` (caixas da v1).
- `RegionalOverlay.tsx` (Etapa 3): anéis por região dirigidos por `status` (cor), `1 − score` (espessura/opacidade/emissão) e sinal de `deviation` (raio para dentro/fora); legenda textual em `FitLegend.tsx` via `regionLegend.ts`. Posições em `silhouette.ts` (`REGION_BAND_Y`).
- Camada `FitVisualizationState` (`fitVisualization.ts`, Etapa 3): normaliza `RecommendationResponse`/`comparison[]` para o 3D; `SizeSelector3D.tsx` (HTML) troca de tamanho sem HTTP quando `comparison[].regions` existe. Detalhes em `docs/implementation/ETAPA_03_FIT_INTEGRATION.md`.
- UX (Etapa 4): CSS `vfp-*` injetado (`styles.ts`) com hover/focus-visible/reduced-motion; layout canvas → controles → seletor → legenda; fundo do palco `#e3dcd2` via `<color attach="background">`; altura responsiva (`useResponsiveCanvasHeight`); tolerância a perda de contexto WebGL; `FitLegend` em variantes `inline`/`list`. Detalhes em `docs/implementation/ETAPA_04_UX_PROVADOR.md`.
- Falhas de asset isoladas por `ModelErrorBoundary.tsx`; WebGL por `useFitPreview.ts` + `WebGLContextGuard.tsx`.
- Controles: `FitPreviewControls.tsx` + `CameraRig.tsx` + `cameraViews.ts` (frente/lateral/costas, zoom, reset) sobre o `OrbitControls` existente; um único `Canvas`.
- **GLBs em `apps/web/public/models/**` continuam sendo cubos placeholder** (`placeholder: true`) → a cena exibe silhueta + primitivas até que assets reais sejam fornecidos.

## Onde Avatar3D está integrado (Etapa 2 — infraestrutura concluída)

- `packages/fit-preview-3d/src/AvatarBody.tsx` resolve o avatar pelo manifest e, com GLB real, usa `useAvatarModel.ts` (`useGLTF`, morph targets `height/chest/waist/hip/shoulder/torsoLeg` via `avatarMorph.ts`, fatores de `computeBodyScale(payload)`).
- `StylizedSilhouette.tsx` é o fallback (manifest ausente, placeholder, erro de GLB).
- Asset esperado: `apps/web/public/models/body/*.glb` referenciado em `manifest.avatar` com `placeholder: false`. **PENDENTE: asset 3D real.**

## Onde Garment3D está integrado (Etapa 2 — infraestrutura concluída)

- `packages/fit-preview-3d/src/GarmentMesh.tsx` resolve `manifest.garments[payload.garment.category]` e, com GLB real, usa `useGarmentModel.ts` + `garmentVisual.ts` (cor via `parseGarmentColor`, material por `fabric`/`elasticity_pct`, volume por `modeling`, escala peça/corpo amortecida e limitada).
- Fallback: `GarmentPrimitive.tsx`.
- Feito (Etapa 3): `RegionalOverlay.tsx` dirigido por `regions[].status/deviation/score`. Pendente para quando houver GLB real: ancorar aos nós `Chest/Waist/Hip/Shoulder/Length` (`constants.ts` → `REGION_NODE`).
- Assets esperados: `apps/web/public/models/garments/{category}.glb` com `placeholder: false`. **PENDENTE: asset 3D real.**

## Dados existentes reutilizados

- `RecommendationResponse.fit_preview` (`FitPreviewPayload`): `body` (medidas + `photoRatios`), `garment` (`category, color, modeling, evaluatedSize, measurements`), `regions[]`, `disclaimer` — montado em `apps/api/app/services/fit_preview_mapper.py`.
- `regions[].ease / design_ease / deviation / score / status` — base numérica do caimento.
- `comparison[].regions` (Etapa 3) — seletor de tamanhos dentro do 3D sem nova chamada HTTP.
- `Product.color`, `fabric`, `composition`, `elasticity_pct`, `modeling`, `category`.
- Fallbacks client-side: `buildPreviewPayloadFromRecommendation`, `mergeFitPreviewPayload` (`packages/fit-preview-3d/src/types.ts`).
- Cores/labels: `STATUS_COLOR_HEX` (`constants.ts`), `REGION_LABEL`, `REGION_STATUS_LABEL` (`packages/contracts/src/index.ts`).

## Arquivos a criar / modificar (provável)

**Backend**
- Feito (Etapa 2): `apps/api/app/schemas/__init__.py` (`FitPreviewGarmentPayload.fabric`, `.elasticity_pct` opcionais) e `apps/api/app/services/fit_preview_mapper.py` (preenche ambos).
- Feito (Etapa 3): `SizeComparison.regions` em `schemas/__init__.py`; `region_details()` + propagação em `recommendation_service.build_response`; teste em `apps/api/tests/test_api.py`.
- Próximas etapas: `apps/api/app/models/entities.py` (`Product.asset_3d_url`, `Product.flat_image_url`, `Product.material_preset`); `apps/api/app/seed/catalog.py`; `database/seed/catalog.json`; criar `apps/api/alembic/versions/0002_3d_assets.py`

**Contratos**
- Feito (Etapa 2): `packages/contracts/src/index.ts` (`FitPreviewGarmentPayload.fabric?`, `.elasticity_pct?`). Feito (Etapa 3): `SizeComparison.regions?`.

**Pacote 3D**
- Feito (Etapa 2): `AvatarBody.tsx`, `GarmentMesh.tsx`, `AvatarScene.tsx`, `FitPreview3D.tsx`, `types.ts`, `index.ts` modificados; criados `manifest.ts`, `useModelsManifest.ts`, `avatarMorph.ts`, `useAvatarModel.ts`, `garmentVisual.ts`, `useGarmentModel.ts`, `modelUtils.ts`, `ModelErrorBoundary.tsx`, `GarmentPrimitive.tsx`, `cameraViews.ts`, `CameraRig.tsx`, `FitPreviewControls.tsx` + testes.
- Feito (Etapa 3): `RegionalOverlay.tsx`, `FitPreview3D.tsx`, `AvatarScene.tsx`, `types.ts`, `index.ts` modificados; criados `fitVisualization.ts`, `regionLegend.ts`, `SizeSelector3D.tsx`, `FitLegend.tsx` + testes.
- Próximas etapas (UX/UI, assets reais): `constants.ts`, `silhouette.ts` (ancoragem aos nós do GLB), refinamento visual do overlay.

**Web**
- Feito (Etapa 2): `apps/web/next.config.ts` (`transpilePackages` + `@veste-ai/fit-preview-3d`); `apps/web/public/models/manifest.json` (v2); `scripts/generate_3d_models.py` (manifest v2).
- Feito (Etapa 3): `apps/web/src/components/fit/result-view.tsx` (recommendedSize × selectedPreviewSize), `apps/web/src/components/catalog/product-fit-preview.tsx`, `apps/web/src/lib/fit-preview.ts` (+ teste).
- Feito (Etapa 4): `result-view.tsx` em duas colunas (desktop) / coluna única ordenada (mobile), `fit-preview-3d-lazy.tsx` ("Preparando provador…"), `region-grid.tsx` (compact 3 colunas), `apps/web/src/lib/api.ts` (`getRecommendation(id, size)`); API `GET /recommendations/{id}?size=` em `apps/api/app/api/v1/routes/recommendations.py`.
- Próximas etapas: substituir assets `apps/web/public/models/body/*.glb`, `apps/web/public/models/garments/*.glb` (PENDENTE: asset 3D real)

**Widget**
- Modificar: `packages/widget/src/VesteFit.tsx` (`enable3D` default `false`), `packages/widget/src/fit-preview-3d.tsx`

**Infra / docs**
- Modificar: `docker/Dockerfile.web` (copiar `packages/fit-preview-3d/package.json` antes do `npm ci`), `.github/workflows/ci.yml` (typecheck/test do web e do `fit-preview-3d`), `docs/12-provador-3d.md`, `README.md`

---

# CatVTON

**Etapa 5 concluída — serviço local funcional em `apps/tryon/`** (ver `docs/implementation/ETAPA_05_CATVTON_LOCAL.md`).

- Fonte oficial `Zheng-Chong/CatVTON` @ `7818397f` (branch `edited`), vendorizada em `apps/tryon/vendor/CatVTON` (gitignored; `apps/tryon/scripts/fetch_catvton.ps1`). **Licença CC BY-NC-SA 4.0 — uso não comercial.**
- Ambiente isolado: Python 3.12 em `apps/tryon/.venv`; `torch 2.7.1+cu128` (desvio do pin oficial 2.4.0 — sem kernels sm_120/RTX 5070), `accelerate 0.33.0` (pins oficiais peft↔accelerate inconsistentes), `diffusers 0.32.2`, `peft 0.17.0`. Checkpoints (6 GB) em `%LOCALAPPDATA%\veste-ai\tryon\models`, baixados pelo mecanismo oficial (`huggingface_hub`).
- Serviço FastAPI (`apps/tryon/service/`): `GET /health`, `POST /try-on` (multipart `person`, `garment`, `cloth_type`), `GET|DELETE /results/{id}`; `CatVTONRuntime` carrega o modelo uma vez e recusa CPU; `MAX_CONCURRENT_JOBS=1` (429 `busy`); OOM controlado (503); validação de imagens; foto só em memória, temporários removidos, resultados com TTL.
- Medições na RTX 5070 (768×1024, bf16, 50 passos): ≈36 s por imagem, pico 5,0 GB alocados / 7,1 GB reservados, 3,2 GB após load.

**Etapa 6 concluída — integração VESTE.AI ↔ CatVTON** (ver `docs/implementation/ETAPA_06_CATVTON_INTEGRATION.md`). `apps/api` (Python ≥ 3.11) não hospeda o modelo; atua como adaptador HTTP para `apps/tryon`:

```text
result-view.tsx → POST /api/v1/tryon → services/tryon/service.py → VirtualTryOnProvider → CatVTONProvider → apps/tryon
                ← TryOnJobOut (metadados) ← TryOnJob (PostgreSQL/SQLite)        ← resultId (PNG com TTL no provider)
                ← GET /api/v1/tryon/{job_id}/image (proxy)
```

- Provider abstrato `apps/api/app/services/tryon/provider.py` (`health/submit/result_exists/fetch_result/delete_result`) + `catvton_provider.py` (httpx, tradução de erros: offline→`provider_unavailable`, timeout→`provider_timeout`, 429→`provider_busy`, OOM→`provider_out_of_memory`, imagem→`provider_rejected_input`). Selecionado por `VESTE_TRYON_PROVIDER`.
- Endpoints: `GET /tryon/status`, `POST /tryon` (multipart `person`, `analysis_id`, `consent_tryon`, `size?`), `GET /tryon/{job_id}`, `GET /tryon/{job_id}/image`, `DELETE /tryon/{job_id}`; `GET /health` ganhou `tryon: {enabled, provider, available}`.
- Dados: `Product.flat_image_url` (+ `tryon_supported` derivado; assets internos em `apps/api/app/assets/flat`, allowlist para URLs remotas; usuário nunca envia URL de peça) e `TryOnJob` só com metadados (`cache_key` = digest composto, `result_ref` opaco). Migration `0002_tryon.py`; compat automática em modo demo (`ensure_compat_schema` + `backfill_flat_images`).
- Regras: consentimento específico `consent_tryon=true` (não reutiliza o da análise corporal); tamanho = recomendado pelo motor ou seleção válida do usuário — **o provider nunca escolhe tamanho, score ou confiança**; foto só em memória; cache determinístico (foto+peça+sku+tamanho+provider+model_version) reaproveita o PNG enquanto o TTL durar.
- Frontend: seção "Provador com foto · Experimental" em `result-view.tsx` (`lib/tryon.ts` máquina de estados + `fit/tryon-panel.tsx`), estados idle/consent_required/uploading/processing/completed/failed/provider_unavailable/expired, disclaimer "Visualização gerada por IA…" + nota de que a recomendação vem das medidas. Falha do provider mantém a recomendação visível. Widget não alterado.
- Medido: 37,6 s por geração via API principal (RTX 5070), cache hit 0,03 s; 67 testes API + 36 web.
- Licença dos pesos: CC BY-NC-SA 4.0, uso não comercial (herdada pela feature).

---

# Dependências

Somente para a etapa 3D.

Já instaladas (`packages/fit-preview-3d/package.json`): `three@^0.175`, `@react-three/fiber@^9.1`, `@react-three/drei@^10.0` (`useGLTF`, `useTexture`, `OrbitControls`), `@types/three`, `vitest`.

A adicionar:
- `@gltf-transform/cli` (devDependency raiz ou script) — otimizar/validar GLB (Draco/meshopt).
- Nenhuma dependência Python nova para o 3D (apenas campos, schemas e migração Alembic).

Assets (não são pacotes npm): avatar GLB paramétrico neutro com morph targets e 8 GLBs de peças em escala métrica, alinhados ao mesmo rig.

---

# Riscos

- ~~`docker/Dockerfile.web` não copia `packages/fit-preview-3d/package.json` antes do `npm ci` → build Docker do web tende a falhar.~~ Corrigido na Etapa 7 (multi-stage com todos os workspaces, standalone; build validado).
- Imagem `tryon` com ≈20 GB (CUDA + torch cu128); try-on síncrono (`MAX_CONCURRENT_JOBS=1`) — fila assíncrona necessária antes de produção multiusuário.
- ~~`apps/web/next.config.ts` não inclui `@veste-ai/fit-preview-3d` em `transpilePackages`.~~ Corrigido na Etapa 2.
- `npm run lint:web` falha com 8 erros `react-hooks/set-state-in-effect` pré-existentes em `apps/web/src/**` (ex.: `src/lib/profile.tsx`) — fora do escopo do 3D, mas bloqueia um gate de CI futuro.
- `.github/workflows/ci.yml` não roda typecheck/lint/test do web nem testes do `fit-preview-3d`.
- ~~Widget (`packages/widget`) empacota three/R3F no IIFE e `enable3D` default `true`.~~ Etapa 4: `enable3D` padrão `false` (opt-in); o IIFE ainda inclui three/R3F por ser lazy no mesmo bundle — separar chunk fica para a etapa Docker/build.
- Avatar com apenas 6 medidas corporais → morphs derivados por heurística; risco de representação enganosa. Manter clamps de `scaleBody.ts` e disclaimer.
- Deformação da peça sem física pode sugerir caimento incorreto → mapear estritamente de `regions[].deviation/status` do motor.
- ~~Comparar tamanhos no 3D com o contrato atual exige N chamadas a `POST /recommendations`.~~ Resolvido na Etapa 3 (`SizeComparison.regions`); só a explicação textual de outro tamanho ainda exige `persist:false` sob demanda.
- GLBs reais em `apps/web/public/models` afetam LCP da PDP → Draco/meshopt, preload tardio, `dpr` adaptativo.
- Sem autenticação de consumidor (`GET /users/{id}` aberto; `userId` em `localStorage`) → bloqueador antes de qualquer feature que gere imagem da pessoa (VTO).
- ~~Python local 3.14 vs API ≥ 3.11 vs CatVTON 3.9 → isolamento obrigatório do serviço VTO.~~ Resolvido na Etapa 5: `apps/tryon/.venv` com Python 3.12 dedicado; pins oficiais do CatVTON são internamente inconsistentes (peft ↔ accelerate) e `torch 2.4` não suporta RTX 50 — desvios documentados.
- CatVTON ≈ 36–38 s por imagem na RTX 5070 (WDDM, GPU compartilhada). A Etapa 6 integrou de forma **síncrona** (requisição aberta durante a geração, `provider_busy` para o segundo usuário simultâneo); fila assíncrona + polling ficam para a etapa de deployment.
- Try-on sem autenticação de consumidor: qualquer portador de `analysis_id` pode gerar a visualização daquela análise (foto só em memória, mas o acesso ao resultado depende do `job_id`). Bloqueador antes de ambiente compartilhado.
- Imagens flat do seed são geradas por IA (demo); catálogo real exige fotos flat dos produtos (`Product.flat_image_url`).
- Pasta órfã `veste-ai/apps/api/veste_ai.db` na raiz (remover).

---

# Plano

- [ ] Digital Twin 3D — **infraestrutura concluída (Etapa 2)**: manifest v2, `useAvatarModel`, morphs via `computeBodyScale` → `avatarMorph.ts`, silhueta como fallback, controles de câmera. **PENDENTE: asset 3D real** (avatar GLB com morph targets). Ver `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md`
- [ ] Garment3D — **infraestrutura concluída (Etapa 2)**: `useGarmentModel`, `garmentVisual.ts` (cor/tecido/elasticidade/modelagem/medidas), `GarmentPrimitive` como fallback. **PENDENTE: asset 3D real** (8 GLBs por categoria)
- [x] Integração com motor de caimento — **concluída (Etapa 3)**: `SizeComparison.regions` propagado do motor, `FitVisualizationState` (`fitVisualization.ts`), overlay por `status/deviation/score`, `SizeSelector3D` + `FitLegend`, troca de tamanho sem HTTP e `recommendedSize × selectedPreviewSize` em `result-view.tsx`. Ver `docs/implementation/ETAPA_03_FIT_INTEGRATION.md`
- [x] UX do provador — **concluída (Etapa 4)**: layout desktop 2 colunas / mobile ordenado, recomendado × visualizado explícito, seletor acessível (teclado, focus-visible, loading/disabled), controles Frente/Lateral/Costas/±/Reset, legenda de vestibilidade, estados loading/erro/fallback padronizados, `GET /recommendations/{id}?size=` para consistência de dados. Ver `docs/implementation/ETAPA_04_UX_PROVADOR.md`
- [x] CatVTON local — **concluída (Etapa 5)**: `apps/tryon/` isolado (Python 3.12, torch 2.7.1+cu128), CatVTON oficial pinado, inferência real na RTX 5070 (bf16, 768×1024, ≈36 s), serviço FastAPI `/health` + `/try-on` + `/results`, modelo carregado uma vez, concorrência/OOM controlados, 14 testes unitários + integração. Ver `docs/implementation/ETAPA_05_CATVTON_LOCAL.md`
- [x] Integração CatVTON — **concluída (Etapa 6)**: `services/tryon/` (provider abstrato + `CatVTONProvider`), `routes/tryon.py`, `TryOnJob` (metadados), `Product.flat_image_url` + assets flat, consentimento específico, cache determinístico, `health.tryon`, seção "Provador com foto · Experimental" em `result-view.tsx`, E2E real com CatVTON na RTX 5070. Ver `docs/implementation/ETAPA_06_CATVTON_INTEGRATION.md`
- [x] Docker / preparação para deployment — **concluída (Etapa 7)**: `Dockerfile.web` corrigido (multi-stage, standalone), `Dockerfile.api` com prestart (wait DB + Alembic não destrutivo, logs JSON, CORS/trusted hosts por ambiente), `Dockerfile.tryon` (CUDA 12.8, torch cu128, CatVTON pinado, checkpoints em volume), compose com healthchecks encadeados e profile `gpu` (`docker/gpu.env`, `VESTE_TRYON_URL=http://tryon:8100`), GPU validada no container (RTX 5070, geração real em 25,8 s). Ver `docs/implementation/ETAPA_07_DOCKER_DEPLOYMENT.md`
- [ ] Cloud / CI — registry e build das imagens na CI, fila assíncrona para o try-on, secrets, TLS/reverse proxy, autenticação de consumidor (sem escolha de provedor ainda)
- [ ] Testes finais — unitários do pacote 3D, `test_api.py` para novos schemas, E2E de fallback (WebGL off / GPU off / timeout)
