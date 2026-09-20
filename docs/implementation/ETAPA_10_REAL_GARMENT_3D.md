# ETAPA 10 — Peça de roupa 3D real

Fonte: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`.
Não altera a ETAPA 09 (avatar humano), o `RecommendationEngine` nem o CatVTON.

## Diagnóstico

O loader de peça já existia (`GarmentMesh` → `useGarmentModel` → `ModelErrorBoundary`). O manifest marcava todas as categorias como `placeholder: true`, então a cena caía em `GarmentPrimitive` (caixas). O objetivo desta etapa é mostrar **avatar humano + camiseta GLB**, com troca S/M/L/XL e regiões do motor.

## Asset utilizado

| Campo | Valor |
|---|---|
| Arquivo | `apps/web/public/models/garments/tshirt_basic.glb` |
| URL | `/models/garments/tshirt_basic.glb` |
| Origem | Geometria **original** gerada por `scripts/generate_tshirt_glb.py` |
| Licença | **CC0 1.0** (`apps/web/public/models/garments/LICENSE`) |
| Forma | Casca oca em T (gola, ombros, mangas curtas, torso, barra). Não é cubo. |
| Eixos | Y para cima; mangas no **X**; frente em **+Z** (após orientar o avatar) |
| Base | tamanho `M`, peito/cintura 111 cm, comprimento 71 cm |

Não foi incluído um GLB de terceiro: packs CC0 conhecidos (Quaternius, Kenney) não ofereciam uma camiseta isolada com download direto e licença explícita no arquivo. Meshy/CGTrader/itch foram descartados por licença obscura, conta ou preço. A malha do projeto é original e dedicada a CC0 — não há licença inventada de terceiros.

Regenerar: `python scripts/generate_tshirt_glb.py`

## Manifest

`garments.tshirt`:

- `url`: `garments/tshirt_basic.glb`
- `placeholder`: `false`
- `type`: `tshirt`
- `baseSize`: `M`
- `baseMeasurements`: chest/waist/length/shoulder

Demais categorias continuam `placeholder: true` → `GarmentPrimitive`. Compatível com v1/v2.

`scripts/generate_3d_models.py` preserva o GLB real se o arquivo existir (não o sobrescreve; só atualiza o manifest).

## Loader

`useGarmentModel`: `useGLTF` + `SkeletonUtils.clone` + escala métrica + dispose de materiais próprios. `useGLTF.preload` em `GarmentMesh`. Sem textura PBR → tecido fosco opaco (`roughness` 0.7–0.9, `metalness = 0`, `DoubleSide`, sem transparência). Com mapa de albedo → clona o material original (também opaco). Erro/404 → `GarmentPrimitive`.

## Transformações (`GarmentTransformProfile`)

```
scaleX, scaleY, scaleZ, positionY, torsoScale, shoulderScale
```

Composição (só visual):

1. deformação do avatar (altura/peito/ombros);
2. letra do tamanho selecionado (`evaluatedSize` já vindo do motor via `applyFitStateToPayload`);
3. direção regional `tight` / `regular` / `loose` a partir de `deviation` do motor;
4. comprimento relativo a `baseMeasurements.length`.

Limites: 0.88–1.18. **Não calcula `fit_score`.**

## Size mapping

| Tamanho | Escala |
|---|---|
| S | 0.96 |
| M | 1.00 |
| L | 1.04 |
| XL | 1.08 |

## Fit regional

| Direção (`deviation`) | Escala |
|---|---|
| tight (`< 0`) | 0.98 |
| regular / unknown | 1.00 |
| loose (`> 0`) | 1.022 |

Peito/cintura → `torsoScale`; ombros → `shoulderScale` (eixo Z da T-pose). Sem física e sem deformar o corpo para “vestir” a peça.

## Overlay

`RegionalOverlay` com `polygonOffset` e `z = 0.08`, `renderOrder = 3`. Peça opaca com `renderOrder = 1`. Overlay não entra no bounding box da câmera.

## Hotfix de validação visual

Após as ETAPAS 09 e 10 a validação no Chrome mostrou: avatar pequeno no Canvas, camiseta como bloco cinza retangular no torso, texto de silhueta estilizada apesar do GLB humano.

### Problema observado

- Corpo humano visível, mas ocupando muito menos de 75% da altura útil.
- Peça carregava (`tshirt_basic.glb` HTTP 200) porém parecia um paralelepípedo cinza/transparente.
- Frente da câmera olhava pelo eixo dos braços em T-pose.
- Disclaimer: “Silhueta estilizada com faixas de caimento estimadas”.

### Causa raiz

O gerador original produzia um **tubo elíptico fechado com mangas no eixo Z** (AABB ~0.37 × 0.52 × 0.80 m). O `avatar_base.glb` também tem os braços em T-pose ao longo de Z (0.28 × 1.95 × 1.17 m). A câmera em +Z olhava pelo comprimento das mangas e via um retângulo no torso. `DoubleSide` + opacidade 0.94 preenchia o volume. O framing usava largura/inclinação (`phi = π/2.15`) e o disclaimer vinha de `payload.disclaimer`, não do renderer ativo.

### Correção da geometria

`scripts/generate_tshirt_glb.py` passou a gerar uma **casca oca em T**: frente, costas, laterais, mangas curtas e gola. Sem tampas, sem BoxGeometry. Unidades relativas ao avatar já com pés em y=0 (barra ~0.96 m, gola ~1.61 m). Regenerar: `python scripts/generate_tshirt_glb.py`.

### Correção de framing

- `orientTPoseToCamera`: −90° em Y quando `depth > width`, frente em +Z.
- `framingBoundsFromAvatar`: só altura do avatar (peça, overlay e braços não afastam a câmera).
- Fill 80% (clamp 75–82%), `phi = π/2`.

### Correção de material

Tecido opaco `MeshStandardMaterial`, roughness 0.7–0.9, metalness 0. Overlay permanece por cima (`polygonOffset`), sem tornar a peça transparente.

### Resultado final

Corpo inteiro visível (cabeça e pés), camiseta reconhecível envolvendo o torso, S/M/L/XL e tight/regular/loose com deltas moderados, texto correto para avatar real vs silhueta.

### Testes

Novos: `tshirtGeometry.test.ts`, `previewDisclaimer.test.ts`, framing sem T-pose, `orientTPoseToCamera`, S=0.96 < M < L=1.04 < XL=1.08.

### Validação Docker

`docker compose -f docker/docker-compose.yml build web` — confirmar `avatar_base.glb` e `tshirt_basic.glb` em `/app/apps/web/public/models/...` e URLs `/models/avatar/avatar_base.glb` e `/models/garments/tshirt_basic.glb`.

## Testes

`@veste-ai/fit-preview-3d`: 14 arquivos, **84 testes**, `tsc` OK.

- resolução de garment no manifest (`tshirt_basic`, `baseSize`);
- fallback placeholder / categoria ausente;
- `GarmentTransformProfile`, limites, S/M/L/XL, tight/loose;
- payload do motor não é mutado.

## Docker

`docker compose -f docker/docker-compose.yml build web`

O GLB vai em `apps/web/public/models/garments/tshirt_basic.glb` (caminho web relativo). `.dockerignore` exclui `*.md`; `LICENSE` (sem extensão) entra na imagem.

## Resultado visual

- `GET /models/garments/tshirt_basic.glb` → 200 (7 688 bytes) no Next local; `avatar_base.glb` → 200 (93 936 bytes).
- Manifest inclui `tshirt_basic` com `placeholder: false`.
- Imagem Docker `veste-ai-web`: `/app/apps/web/public/models/avatar/avatar_base.glb` e `/app/apps/web/public/models/garments/tshirt_basic.glb`.
- GLB da camiseta (hotfix): casca oca, ~0.70 × 0.65 × 0.33 m, barra y=0.96, gola y=1.61, 144 verts.
- Avatar `avatar_base.glb`: ~0.28 × 1.95 × 1.17 m (T-pose em Z) → `orientTPoseToCamera` deixa frente em +Z.
- Disclaimer com avatar real: “Visualização 3D estimada com base nas medidas informadas…”. Fallback de silhueta mantém o texto antigo.
- O browser de automação/headless costuma perder o contexto WebGL (canvas branco); o Chrome do usuário com GPU é a validação visual da malha.

## Limitações

- Malha low-poly gerada por script (demonstração de TCC, não scan de peça real).
- Sem skeleton compartilhado com o avatar; transformação estática/regional.
- Sem simulação de tecido; possível interpenetração leve nos braços em T-pose.
- Só `tshirt` tem GLB real; shirt/polo/etc. seguem primitivas.
- Tamanho visual é representação, não o score.

## Próximos passos

- GLB por categoria (polo, calça) com a mesma licença explícita.
- Pose A (braços baixos) se o avatar for atualizado.
- Skinning compartilhado se houver rig compatível.

## Arquivos principais

- `packages/fit-preview-3d/src/garmentTransform.ts`
- `packages/fit-preview-3d/src/GarmentMesh.tsx`
- `packages/fit-preview-3d/src/useGarmentModel.ts`
- `packages/fit-preview-3d/src/manifest.ts`
- `apps/web/public/models/garments/tshirt_basic.glb`
- `apps/web/public/models/manifest.json`
- `scripts/generate_tshirt_glb.py`
