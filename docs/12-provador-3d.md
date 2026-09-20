# 12 — Provador visual 3D (avatar rotacionável)

## O que é

Silhueta **estilizada** (cabeça circular + tronco blob + pernas), alinhada ao guia "Como medir" do perfil do consumidor — **sem representação humana realista** e sem rosto identificável.

Faixas horizontais coloridas indicam caimento por região (ombros, peito, cintura, quadril). O motor Python continua sendo a fonte da verdade; o 3D **só visualiza** `regions[]`, medidas e categoria.

Mensagem obrigatória na UI:

> Silhueta estilizada com faixas de caimento estimadas. Não substitui prova física da peça nem representa o seu corpo.

## Onde aparece

| Superfície | Modo | Componente |
|---|---|---|
| `/analise/[id]` | `full` | `FitPreview3DLazy` em `result-view.tsx` |
| `/catalogo/[slug]` | `medium` | `CatalogFitPreviewSection` (tamanho M default) |
| Widget `<VesteFit />` | `compact` | `WidgetFitPreview3D` (lazy, prop `enable3D`) |
| `/loja-parceira/produto/[slug]` | `compact` | widget com `enable3D` |

## Pacote

`@veste-ai/fit-preview-3d` — Canvas + OrbitControls, corpo escalado, roupa por categoria, overlay regional (compatível / atenção / folga).

Integração Next.js sempre com `dynamic(..., { ssr: false })`.

## Contrato API

Campo opcional `fit_preview` em `RecommendationResponse`:

```json
{
  "fit_preview": {
    "body": { "height": 180, "chest": 102, "waist": 88, "hip": 100, "shoulder": 45, "photoRatios": null },
    "garment": { "category": "tshirt", "color": "Preto", "modeling": "regular", "evaluatedSize": "M", "measurements": {} },
    "regions": [],
    "disclaimer": "Representação visual estimada..."
  }
}
```

Montado em `apps/api/app/services/fit_preview_mapper.py`.

## Assets 3D

GLB placeholder em `apps/web/public/models/`:

- `body/base-male.glb` — corpo neutro (sem rosto identificável)
- `garments/{category}.glb` — 8 categorias

Regenerar:

```bash
npm run models:3d
```

Substituíveis por assets Blender/CC0 sem alterar paths.

## Fallback

Se WebGL não estiver disponível (GPU fraca, SSR, navegador antigo), a UI mantém o `RegionGrid` 2D e exibe: *“Prévia 3D indisponível neste dispositivo.”*

## Roteiro de demo (banca)

1. Perfil demo → Camiseta Essential → **Analisar caimento**
2. Na tela de resultado, **gire o avatar** com o mouse
3. Troque S/M/L/XL na comparação — regiões e deformação atualizam
4. Abra a PDP do catálogo — prévia média antes da análise formal
5. Abra a loja parceira — widget compact com o mesmo componente
6. Leia o disclaimer — reforça que não substitui prova física

## Limitações (v1)

- Sem simulação física de tecido ou alfaiataria por SKU
- Corpo neutro; foto só ajusta proporções (`photoRatios`)
- Assets low-poly placeholder — arte final é evolução futura
