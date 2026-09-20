# ETAPA 09 — Avatar humano 3D real

Fonte arquitetural: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`.
Branch: `feature/virtual-fitting`.

Premissa mantida: o `RecommendationEngine` continua a única fonte de tamanho recomendado, `fit_score`, confiança, regiões e justificativas. O avatar 3D e o CatVTON apenas visualizam esses dados.

## Diagnóstico inicial

A infraestrutura 3D da ETAPA 02 já existia (`FitPreview3D`, `AvatarScene`, `AvatarBody`, `GarmentMesh`, `useGLTF`, `manifest.json`, morph abstraction, `CameraRig`, `RegionalOverlay`, `WebGLContextGuard`).

O manifest v2 marcava o avatar como `placeholder: true` e `scripts/generate_3d_models.py` gerava cubos low-poly. `isRenderableAsset` recusava placeholders, então a cena caía sempre na `StylizedSilhouette`. A câmera usava posição fixa (`[0, 0.9, 2.55]`) e o grupo da cena tinha offset Y que deixava o corpo pequeno no Canvas.

Relatórios anteriores: “Avatar/peça GLB reais ausentes — silhueta/primitivas.”

## Arquitetura encontrada (evoluída, não recriada)

```text
RecommendationResponse.fit_preview (motor)
        │
        ▼
FitPreview3D
   useModelsManifest → GET /models/manifest.json
   │
   ▼
AvatarScene (1 Canvas)
   ├─ AvatarBody
   │     resolveAvatarAsset
   │       placeholder/ausente → StylizedSilhouette
   │       GLB real → ModelErrorBoundary > Suspense
   │                    useAvatarModel: useGLTF + SkeletonUtils.clone
   │                    computeAvatarDeformationProfile(medidas)
   │                    detectAdapterKind → morph | skeleton | regional | global
   ├─ GarmentMesh
   │     GLB da categoria (se não-placeholder) senão GarmentPrimitive
   │     escala segue height/torso do perfil visual
   └─ RegionalOverlay
         anéis posicionados pela bounding box do GLB
CameraRig + computeCameraFraming(Box3)  → 70–85% da altura visível
```

## Estratégia utilizada

1. Integrar um GLB humano CC0 estático em `apps/web/public/models/avatar/avatar_base.glb`.
2. Marcar `placeholder: false` e `type: "human"` no manifest (compatível com v2 + `avatars.default`).
3. Deformação visual relativa a `baseMeasurements` (não recalcula fit).
4. Descoberta automática de adapter: morph → skeleton → regional → escala Y global.
5. Enquadramento pela bounding box (com clamp da envergadura T-pose).
6. Fallback obrigatório: GLB real → silhueta → HTML/UI se WebGL falhar.

## Asset escolhido

| Campo | Valor |
|---|---|
| Arquivo | `apps/web/public/models/avatar/avatar_base.glb` |
| URL runtime | `/models/avatar/avatar_base.glb` |
| Origem | [Male Base Mesh](https://orange-juice-games.itch.io/male-base-mesh) (orange-juice-games), espelho GitHub [BoQsc/Godot-3D-Male-Base-Mesh](https://github.com/BoQsc/Godot-3D-Male-Base-Mesh) (`Original/male_base_mesh.glb`) |
| Licença | **CC0 1.0 Universal** (domínio público). Texto em `apps/web/public/models/avatar/LICENSE`. Atribuição em `ATTRIBUTION.md`. |
| Tipo | Mesh humano adulto em T-pose, low-poly, armature Rigify (`metarig`) |
| Morph targets | nenhum no GLB |
| Runtime | arquivo estático no `public/` do Next.js; sem API, sem autenticação, sem Blender |

Atualizar o asset:

```powershell
.\scripts\fetch_avatar_glb.ps1
```

Se o arquivo disponível for FBX/GLTF:

```powershell
.\scripts\convert_avatar.ps1 -InputPath .\meu_avatar.fbx
```

A conversão usa, nesta ordem, `FBX2glTF` / `assimp` / `gltf-transform`. Não exige Blender.

## Estrutura do manifest

`apps/web/public/models/manifest.json` (v2, compatível com o schema anterior):

- `avatar.url` = `avatar/avatar_base.glb`
- `avatar.placeholder` = `false`
- `avatar.type` = `human`
- `avatar.baseMeasurements` = `{ height: 175, chest: 96, waist: 82, hips: 98, shoulders: 44, weight: 72 }`
- `avatars.default` = mesmo objeto (aceito por `normalizeManifest` se `avatar` estiver ausente)
- `garments.*` continuam `placeholder: true` → `GarmentPrimitive`

`scripts/generate_3d_models.py` preserva o avatar real se `avatar_base.glb` existir.

## Deformação baseada em medidas

`computeAvatarDeformationProfile` converte cm/kg em escalas limitadas (não usa o motor):

| Medida | Efeito |
|---|---|
| height | `heightScale` (grupo Y se não houver morph de altura) |
| shoulders | ossos `shoulder` / clavícula (XZ) |
| chest | `spine.002` / `spine.003` |
| waist | `spine.001` |
| hips | `spine` / pelvis |
| weight | `bodyMassScale` via razão de BMI, amortecido |

Corpo-base: 175 / 96 / 82 / 98 / 44 / 72 kg.

Limites: altura 0.88–1.16; XZ 0.90–1.14; massa 0.94–1.10. Mãos, pés, cabeça, pescoço (`spine.004`/`spine.005`) são protegidos.

Perfis A (165/86/70/92/40) e B (185/112/100/110/50) produzem diferenças visuais claras e limitadas (`profilesDifferVisually`).

## Morph targets e bones

- MorphTargetAdapter: reutiliza `avatarMorph.ts` se o GLB declarar alvos.
- SkeletonAdapter (ativo neste asset): Rigify `metarig`. Após o `GLTFLoader` os nomes perdem o ponto: `spine`, `spine001`–`spine003` (torso), `shoulderL`/`shoulderR`, `pelvisL`/`pelvisR`. `spine004`/`spine005` (pescoço/cabeça) são protegidos.
- RegionalScaleAdapter: meshes nomeados `chest`/`waist`/`hip`/`shoulder` (placeholders segmentados).
- Global: só a escala Y do grupo em `AvatarBody`.

## Fallbacks

1. GLB humano real (`placeholder: false`)
2. `StylizedSilhouette` (manifest ausente, placeholder, 404, GLB inválido via `ModelErrorBoundary`)
3. Fallback HTML do host se WebGL falhar / contexto perdido (`WebGLContextGuard`)
4. Peça: GLB da categoria → `GarmentPrimitive`

## Framing da câmera

`computeCameraFraming` usa altura/largura da Box3:

- fill padrão 78% (clamp 70–85%)
- `radius = height / (2 * fill * tan(fov/2))`
- alvo no peito (~54% da altura)
- largura limitada a 45% da altura para ignorar braços em T-pose
- vistas frente / lateral / costas, zoom ± e reset usam o mesmo `framing`

Canvas: 480/400/340 desktop; 360/320/280 em viewport ≤ 639px.

## Testes executados

Pacote `@veste-ai/fit-preview-3d` (`vitest run` + `tsc --noEmit`):

- 11 arquivos, 68 testes, todos passando
- `avatarDeformation.test.ts` — perfil base, limites, A vs B, bones protegidos, seleção de adapter, skeleton, morph, global no-op
- `cameraFraming.test.ts` — fill 70–85%, corpo alto mais distante, layout regional sem T-pose
- `manifest.test.ts` — `avatars.default`, `baseMeasurements`, fallback sem asset / placeholder

Typecheck do pacote: OK.

## Resultado visual

- GLB inspecionado com `GLTFLoader`: 1 mesh, 56 bones, 0 morphs, ~94 KB. Adapter efetivo: **skeleton**.
- `GET /models/avatar/avatar_base.glb` → 200 (`model/gltf-binary`) no Next em `localhost:3000`.
- `GET /models/manifest.json` → `placeholder: false`, `type: "human"`.
- Docker image `veste-ai-web`: arquivo presente em `/app/apps/web/public/models/avatar/avatar_base.glb`.
- `docker compose -f docker/docker-compose.yml build web` concluiu com TypeScript OK.
- No browser de automação o Canvas WebGL perdeu contexto (vendor WebKit); o fallback HTML (`fit-preview-fallback` + RegionGrid) manteve a página estável, com seletor de tamanhos e scores do motor.
- Deformação A vs B coberta por testes unitários (`profilesDifferVisually`).
- Enquadramento 70–85% coberto por `cameraFraming.test.ts`.

## Docker

`docker/Dockerfile.web` copia `apps/web/public` para a imagem standalone. O GLB é servido em `/models/avatar/avatar_base.glb` (caminho web relativo, nunca path Windows).

```bash
docker compose -f docker/docker-compose.yml build web
```

## Limitações

- O mesh CC0 é low-poly, sem textura PBR e em T-pose (braços abertos). Material de pele é aplicado no clone.
- Sem morph targets: deformação é óssea + escala Y, não biomecânica.
- Peças 3D reais ainda não existem; primitivas acompanham a escala do torso.
- Sem simulação de tecido.
- Peso só altera volume visual; o motor não usa peso para score de região.

## Próximos passos

- Substituir peças placeholder por GLB por SKU/categoria no manifest.
- Opcional: mesh com morphs antropométricos (ainda CC0/CC-BY) para deformação mais natural.
- Pose A (braços baixos) se houver asset com a mesma licença.
- LOD / Draco se o próximo avatar for pesado.

## Arquivos principais

- `packages/fit-preview-3d/src/avatarDeformation.ts`
- `packages/fit-preview-3d/src/avatarAdapters.ts`
- `packages/fit-preview-3d/src/useAvatarModel.ts`
- `packages/fit-preview-3d/src/cameraFraming.ts`
- `packages/fit-preview-3d/src/regionLayout.ts`
- `packages/fit-preview-3d/src/AvatarBody.tsx`, `AvatarScene.tsx`, `CameraRig.tsx`, `RegionalOverlay.tsx`, `GarmentMesh.tsx`
- `apps/web/public/models/manifest.json`
- `apps/web/public/models/avatar/avatar_base.glb`
- `scripts/fetch_avatar_glb.ps1`, `scripts/convert_avatar.ps1`
