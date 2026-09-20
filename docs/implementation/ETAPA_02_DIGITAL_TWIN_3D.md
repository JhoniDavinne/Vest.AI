# ETAPA 02 — Digital Twin 3D (infraestrutura)

Fonte arquitetural: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`.
Branch: `feature/virtual-fitting`.

## Objetivo

Evoluir o pacote existente `packages/fit-preview-3d` para carregar um avatar GLB paramétrico e peças GLB por categoria a partir de `apps/web/public/models/manifest.json`, mantendo a silhueta estilizada como fallback e sem tocar no `RecommendationEngine`.

Premissa mantida: o motor Python é a única fonte de tamanho, score, confiança, regiões e justificativas. O 3D só consome `RecommendationResponse.fit_preview` / `regions[]`.

## Status

**Infraestrutura concluída. PENDENTE: asset 3D real.**

Não existe no repositório um avatar GLB com morph targets nem peças GLB reais. Os arquivos em `apps/web/public/models/**/*.glb` continuam sendo cubos placeholder gerados por `scripts/generate_3d_models.py` e estão marcados como `placeholder: true` no manifest — portanto **a cena continua exibindo a silhueta estilizada + primitivas**. Nenhum asset foi inventado, gerado proceduralmente como "humano" ou baixado.

## Arquitetura implementada

```text
RecommendationResponse.fit_preview (motor)
        │
        ▼
FitPreview3D ──useWebGLAvailable──▶ (sem WebGL) fallback do host (RegionGrid)
   │  useModelsManifest(modelsBaseUrl)  →  GET {modelsBaseUrl}/manifest.json (cliente, cacheado)
   ▼
AvatarScene (1 Canvas · OrbitControls makeDefault · CameraRig · WebGLContextGuard)
   ├─ AvatarBody
   │     resolveAvatarAsset(manifest) ─ placeholder/ausente → StylizedSilhouette
   │     GLB real → ModelErrorBoundary > Suspense > AvatarGLB
   │                 useAvatarModel: useGLTF → clone → escala métrica →
   │                 computeBodyScale → computeAvatarMorphState → applyMorphState
   ├─ GarmentMesh
   │     resolveGarmentAsset(manifest, category) ─ placeholder/ausente → GarmentPrimitive
   │     GLB real → ModelErrorBoundary > Suspense > GarmentGLB
   │                 useGarmentModel: useGLTF → clone → escala métrica →
   │                 computeGarmentVisualState (cor/tecido/elasticidade/modelagem/medidas)
   └─ RegionalOverlay (inalterado — anéis por status do motor)
```

## Arquivos criados

Pacote `packages/fit-preview-3d/src/`:

| Arquivo | Papel |
|---|---|
| `manifest.ts` | Tipos `ModelsManifest`/`ManifestAsset`, `normalizeManifest` (aceita v1 legado e v2), `resolveAvatarAsset`, `resolveGarmentAsset`, `isRenderableAsset`, `joinModelUrl`, `loadModelsManifest` (nunca rejeita; cache por `baseUrl`), `clearManifestCache` |
| `useModelsManifest.ts` | Hook cliente com estados `idle/loading/ready/unavailable` |
| `avatarMorph.ts` | `AvatarMorphState`, `computeAvatarMorphState(factors)`, `factorToMorph`, `applyMorphState(mesh, state, mapping)`, `DEFAULT_MORPH_TARGET_MAPPING`, `mergeMorphMapping` — camada desacoplada do asset |
| `useAvatarModel.ts` | `useGLTF` + `SkeletonUtils.clone` + escala métrica + aplicação de morphs; expõe `appliedAxes` e `rigid` |
| `garmentVisual.ts` | `GarmentVisualState`, `computeGarmentVisualState(payload)`, `garmentBodyScale` (diferença peça/corpo amortecida 50% e limitada 0.9–1.15), `inferMaterial(fabric)`, `MODELING_VOLUME` |
| `useGarmentModel.ts` | `useGLTF` + clone + escala métrica + `MeshStandardMaterial` próprio por mesh (descartado no unmount) |
| `modelUtils.ts` | Contrato métrico: `SCENE_UNITS_PER_METER`, `SCENE_FLOOR_Y`, `placeMetricObject`, `measureObject`, `metricCorrectionFactor` (detecta cm/mm), `forEachMesh`, `disposeMaterials`, `hasMorphTargets` |
| `ModelErrorBoundary.tsx` | Error boundary por asset (404/GLB inválido) com `resetKey` e `onError` |
| `GarmentPrimitive.tsx` | Primitivas da v1 (caixas) extraídas de `GarmentMesh` — fallback da peça |
| `cameraViews.ts` | Vistas `front/side/back`, `stepDistance`, `clampDistance`, `defaultSphericalPose`, `sphericalToPosition`, `poseForView` |
| `CameraRig.tsx` | Executa `CameraCommand` (view/zoom/reset) sobre o OrbitControls padrão |
| `FitPreviewControls.tsx` | Toolbar HTML fora do Canvas: Frente · Lateral · Costas · + · − · Reset |
| Testes | `manifest.test.ts`, `avatarMorph.test.ts`, `garmentVisual.test.ts`, `modelUtils.test.ts`, `cameraViews.test.ts` |

Documentação: `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md` (este arquivo).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `packages/fit-preview-3d/src/AvatarBody.tsx` | Resolve avatar pelo manifest; GLB real → `AvatarGLB`; senão `StylizedSilhouette`. Altura por morph quando o eixo `height` existe, senão escala Y |
| `packages/fit-preview-3d/src/GarmentMesh.tsx` | Resolve peça por categoria; GLB real → `GarmentGLB`; senão `GarmentPrimitive` |
| `packages/fit-preview-3d/src/AvatarScene.tsx` | Recebe `manifest`, `renderPlaceholders`, `cameraCommand`, `onAssetError`; adiciona `CameraRig`; `dpr={[1, 1.5]}`; constantes de câmera centralizadas em `cameraViews.ts` |
| `packages/fit-preview-3d/src/FitPreview3D.tsx` | Carrega manifest (`useModelsManifest`), barra de controles, props `showControls`, `renderPlaceholders`, `onAssetError`; `data-manifest-status` para depuração |
| `packages/fit-preview-3d/src/types.ts` | Novas props em `FitPreview3DProps`; `buildPreviewPayloadFromRecommendation` propaga `fabric`/`elasticity_pct` do produto |
| `packages/fit-preview-3d/src/index.ts` | Exporta a nova infraestrutura |
| `packages/contracts/src/index.ts` | `FitPreviewGarmentPayload.fabric?` e `.elasticity_pct?` (opcionais) |
| `apps/api/app/schemas/__init__.py` | `FitPreviewGarmentPayload.fabric = ""`, `elasticity_pct: float | None = None` |
| `apps/api/app/services/fit_preview_mapper.py` | Preenche `fabric` (fabric ou composition) e `elasticity_pct` a partir de `Product` |
| `apps/web/public/models/manifest.json` | Formato v2 com `placeholder: true` e mapeamento de morph targets |
| `scripts/generate_3d_models.py` | Emite manifest v2 (sempre `placeholder: true`) |
| `apps/web/next.config.ts` | `transpilePackages` inclui `@veste-ai/fit-preview-3d` |
| `docs/VIRTUAL_FITTING_ARCHITECTURE.md` | Checklist e estado do 3D atualizados |

Não alterados: `RecommendationEngine` e componentes (`apps/api/app/engine/**`), `StylizedSilhouette.tsx`, `RegionalOverlay.tsx`, `scaleBody.ts`, `silhouette.ts`, `constants.ts`, `useFitPreview.ts`, `WebGLContextGuard.tsx`, `apps/web/src/**` (exceto `next.config.ts`), `packages/widget/**`.

## Dependências adicionadas

Nenhuma. Reutiliza `three@0.175`, `@react-three/fiber@9.7`, `@react-three/drei@10.7` (`useGLTF`) já presentes. `three/examples/jsm/utils/SkeletonUtils.js` vem do próprio `three`.

## Funcionamento do Avatar3D

1. `FitPreview3D` obtém o manifest no cliente (`useModelsManifest`). Durante o carregamento ou se indisponível, `AvatarBody` renderiza `StylizedSilhouette`.
2. `resolveAvatarAsset(manifest, modelsBaseUrl)` → `{ url, placeholder }`. Se `placeholder === true` (caso atual) ou ausente, permanece a silhueta. `renderPlaceholders` (padrão `false`) permite exibir o cubo apenas para validar o pipeline.
3. Com GLB real: `useAvatarModel(url, factors, manifest.avatar.morphTargets)`
   - `useGLTF(url)` (cache global por URL — o mesmo GLB nunca é baixado duas vezes);
   - `SkeletonUtils.clone` cria instância própria (evita compartilhar `morphTargetInfluences` entre catálogo e resultado);
   - `metricCorrectionFactor` corrige assets exportados em cm/mm; pés são levados a y=0; `placeMetricObject` converte metros → unidades da cena (`SCENE_UNITS_PER_METER = 1.62 / 1.75`), mantendo câmera, OrbitControls e `RegionalOverlay` inalterados;
   - `computeBodyScale(payload)` (reutilizado, com clamps 0.82–1.22 e `photoRatios`) → `computeAvatarMorphState` → estado −1..1 por eixo (`height, chest, waist, hip, shoulder, torsoLeg`) → `applyMorphState` escreve em `morphTargetInfluences` via nomes do manifest (`*_plus`/`*_minus` ou alvo único bipolar). Eixos sem alvo são ignorados.
   - Se o eixo `height` não tiver morph, a altura é representada por escala Y do grupo (mesmo comportamento da silhueta).
4. Qualquer erro de carregamento cai em `ModelErrorBoundary` → silhueta, e `onAssetError` é notificado. A recomendação nunca é afetada.

Sem classificação estética: apenas proporções relativas a `REFERENCE_BODY`, com limites.

## Funcionamento do Garment3D

`garment.category → manifest.garments[category] → GLB → GarmentMesh`.

- Placeholder/ausente/erro → `GarmentPrimitive` (caixas da v1).
- GLB real → `useGarmentModel(url, visual)` com `computeGarmentVisualState(payload)`:
  - cor: `parseGarmentColor(garment.color)`;
  - material: `inferMaterial(garment.fabric)` → `knit/woven/denim/smooth/fleece/unknown` define `roughness`; `elasticity_pct ≥ 8` deixa a superfície levemente mais fosca;
  - escala: `garmentBodyScale` (peça vs corpo do payload, diferença amortecida 50%) × `MODELING_VOLUME[modeling]` (slim 0.98 … oversized 1.06), sempre limitada a 0.9–1.15;
  - materiais criados por instância e descartados no unmount; geometrias permanecem no cache do `useGLTF`.
- Sem cloth simulation e sem deformação que sugira precisão física; o caimento regional continua vindo de `regions[]`.

## Estratégia de manifest

`apps/web/public/models/manifest.json` (v2) é a única fonte de localização de assets:

```json
{
  "version": 2,
  "avatar": { "url": "body/base-male.glb", "placeholder": true, "morphTargets": { "chest": { "plus": "chest_plus", "minus": "chest_minus" }, "...": {} } },
  "garments": { "tshirt": { "url": "garments/tshirt.glb", "placeholder": true }, "...": {} },
  "regions": ["Chest", "Waist", "Hip", "Shoulder", "Length"],
  "note": "..."
}
```

- `normalizeManifest` também aceita o formato v1 (`body`/`garments` como strings), tratando-o como placeholder por segurança.
- `loadModelsManifest` nunca rejeita: 404, JSON inválido ou erro de rede → `null` → fallback. Cache em memória por `baseUrl`.
- Para ativar um asset real basta trocar `url` e marcar `placeholder: false`; nomes de morph targets são configuráveis por eixo.
- Contrato dos assets: metros, eixo Y para cima, pés em y = 0, avatar e peças no mesmo rig/escala.

## Fallbacks implementados

| Condição | Resultado |
|---|---|
| Sem WebGL (`useWebGLAvailable`) ou `webglcontextlost` (`WebGLContextGuard`) | `fallback` do host (`RegionGrid` em `apps/web/src/components/fit/fit-preview-3d-lazy.tsx`) |
| Manifest ausente/inválido/carregando | Silhueta estilizada + primitivas |
| Asset `placeholder: true` (estado atual) | Silhueta estilizada + primitivas |
| GLB da categoria inexistente no manifest | `GarmentPrimitive` |
| GLB falha ao carregar (404/corrompido) | `ModelErrorBoundary` → silhueta / primitivas, `onAssetError` |
| GLB sem morph targets | Avatar rígido com altura por escala Y |

SSR: `apps/web` continua usando `dynamic(..., { ssr: false })`; o manifest e os GLBs só são requisitados no cliente.

## Controles 3D

Um único `Canvas`. `OrbitControls` (rotação 360° por arraste, zoom por scroll, sem pan) + toolbar `FitPreviewControls` (fora do Canvas) → `CameraCommand` → `CameraRig` altera a posição da câmera e chama `controls.update()`: Frente/Lateral/Costas (troca só o azimute, mantém raio/elevação), +/− (passo 0.85 respeitando `minDistance`/`maxDistance`) e Reset (pose inicial). Prop `showControls` (padrão `true`).

## Testes executados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (todos os workspaces) | PASS |
| `npx vitest run --root packages/fit-preview-3d` | PASS — 7 arquivos, 35 testes (manifest v1/v2, resolução, cache, fallback sem GLB, morph state/aplicação, estado visual da peça, escala métrica, câmera) |
| `npm run test:web` | PASS (3) |
| `npm run test:widget` | PASS (3) |
| `apps/api`: `python -m pytest` | PASS — 30 testes (inclui `fit_preview` com novos campos) |
| `npm run lint:web` | FAIL — 8 erros `react-hooks/set-state-in-effect` + 1 aviso `@next/next/no-img-element`, todos **pré-existentes** em `apps/web/src/**` (ex.: `src/lib/profile.tsx`), não relacionados a esta etapa. Único arquivo do web alterado: `next.config.ts` |

Não foi possível testar componentes React/WebGL (sem jsdom/testing-library no repositório); o comportamento sem WebGL está coberto pela lógica pré-existente em `useFitPreview.ts`.

## Resultado do build

- `npm run build:web` — PASS (Next.js 16.3.5 / Turbopack, 17 rotas).
- `npm run build:widget` — PASS (`dist/index.global.js` 2,79 MB, `dist/embed.global.js` 4,34 MB — o IIFE já incluía three/R3F antes desta etapa).
- `python scripts/generate_3d_models.py` — regenera placeholders e manifest v2 idênticos ao commitado.

## Limitações

- Sem asset real, o usuário final vê exatamente a mesma cena da v1 (silhueta + primitivas), agora com toolbar de câmera.
- Morph targets suportam 6 eixos derivados de 6 medidas corporais; não há entrepernas, braço, pescoço.
- Escala visual da peça é heurística (amortecida/limitada), não física.
- Lint do web com falhas pré-existentes fora do escopo.
- Widget continua com `enable3D` padrão `true` e bundle pesado (decisão adiada para a etapa de UX/Docker).

## Pendências

- **PENDENTE: asset 3D real** — avatar GLB paramétrico (neutro, sem rosto identificável) com morph targets nomeados conforme o manifest, em metros, pés em y=0.
- **PENDENTE: asset 3D real** — 8 peças GLB (`tshirt, shirt, polo, hoodie, jacket, dress, pants, shorts`) alinhadas ao mesmo rig.
- Após fornecer os assets: marcar `placeholder: false` no manifest, validar com `renderPlaceholders` desligado, otimizar (Draco/meshopt) e revisar `REGION_BAND_Y` do `RegionalOverlay` contra os nós `Chest/Waist/Hip/Shoulder/Length` do GLB.
- Próxima etapa (não iniciada): integração do 3D com o motor — `SizeComparison.regions`, heatmap por `deviation/status`, seletor de tamanho no 3D.

## Assets 3D ainda necessários

| Asset | Caminho esperado | Requisitos |
|---|---|---|
| Avatar paramétrico | `apps/web/public/models/body/*.glb` | glTF 2.0; metros; Y up; pés em y=0; morph targets `height_plus/minus`, `chest_plus/minus`, `waist_plus/minus`, `hip_plus/minus`, `shoulder_plus/minus`, `torso_plus/minus` (ou nomes próprios declarados em `manifest.avatar.morphTargets`); licença CC0/própria |
| Peças por categoria | `apps/web/public/models/garments/{category}.glb` | Mesmo rig/escala do avatar; malha única ou poucas malhas; materiais serão substituídos em runtime |
