# ETAPA 04 — UX/UI do Provador Virtual

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md`, `docs/implementation/ETAPA_03_FIT_INTEGRATION.md`.
Branch: `feature/virtual-fitting`.

## Objetivo

Transformar o provador em uma experiência coerente com e-commerce moderno — hierarquia clara, responsividade, acessibilidade e estados padronizados — **sem** alterar `RecommendationEngine`, sem nova fórmula de caimento, sem recriar a infraestrutura 3D e sem depender de GLB real. A lógica funcional da Etapa 3 (`FitVisualizationState`, `comparison[].regions`, troca de tamanho) permanece intacta.

## Layout final (`/analise/[id]` — `apps/web/src/components/fit/result-view.tsx`)

### Desktop (≥ 1024 px) — duas colunas

```text
┌──────────────────────────────────────┬────────────────────────────────┐
│ PROVADOR VIRTUAL                     │ Atelier Norte · Regular        │
│  ┌──────────────────────────────┐    │ [M]  Tamanho recomendado       │
│  │           3D VIEW            │    │      Confiança média           │
│  │  (silhueta/GLB + anéis)      │    │ ─────────────────────────────  │
│  └──────────────────────────────┘    │ (se ≠) Visualizando tamanho L  │
│  Frente · Lateral · Costas   + − ⟲   │        Recomendado: M          │
│  S 6,7   M 8,8●  L 8,4   XL 6,3      │        [Voltar ao recomendado] │
│  ● recomendado pelo motor            │ ─────────────────────────────  │
│  disclaimer                          │ (8,4) Caimento · tamanho L     │
│                                      │       Alta compatibilidade     │
│                                      ├────────────────────────────────┤
│                                      │ REGIÕES · TAMANHO L            │
│                                      │ Peito        ✓ Compatível      │
│                                      │ Cintura      ↑ Levemente…      │
└──────────────────────────────────────┴────────────────────────────────┘
│ Por que este resultado (explicação · recomendação) │ Comparação entre tamanhos (barras) │
│ Detalhe técnico · Folga por região (RegionGrid, valores em cm)                          │
│ Como calculamos · Feedback                                                              │
```

Grid: `lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:grid-rows-[auto_1fr]`; o provador ocupa `row-span-2` na coluna esquerda.

### Mobile (< 640 px) — coluna única, ordem por DOM

1. Recomendação (tamanho recomendado · confiança · score do tamanho visualizado)
2. Provador (canvas com altura reduzida → controles → seletor → disclaimer)
3. Regiões (lista "Peito — Compatível")
4. Explicação · comparação
5. Detalhe técnico · Como calculamos · Feedback

Canvas: 340/300/260 px (`full/medium/compact`) abaixo de 640 px via `useResponsiveCanvasHeight`. Sem overflow horizontal (verificado: `scrollWidth === clientWidth` a 390 px).

## Componentes alterados

| Componente | Mudança de UX |
|---|---|
| `packages/fit-preview-3d/src/FitPreview3D.tsx` | Nova ordem: canvas → controles (abaixo, não cobrem o avatar) → seletor → legenda. Pílula "Atualizando tamanho…" sobre o palco (`role=status`). Fallback sem WebGL mantém seletor/legenda/disclaimer. Tolerância de 1,5 s para restauração de contexto WebGL antes de cair no fallback. Props `showSummary`/`showLegend` permitem ao host evitar duplicar score/legenda |
| `packages/fit-preview-3d/src/SizeSelector3D.tsx` | Chips compactos com score; recomendado marcado por ponto terracota + `aria-label` (não só cor); `role=radiogroup` com roving tabindex (setas, Home/End); `aria-busy`/`data-loading` por tamanho; `disabled`; `focus-visible`; dica "● recomendado pelo motor · valor = caimento /10" |
| `packages/fit-preview-3d/src/FitPreviewControls.tsx` | Segmentos "Frente · Lateral · Costas" + "+ · − · Reset" com ícones SVG inline (sem dependência nova), `aria-label`/`title`, hover/focus, `aria-pressed` na vista ativa |
| `packages/fit-preview-3d/src/FitLegend.tsx` | Variantes `inline` (sob o canvas) e `list` (painel lateral); glifos textuais ✓ ↑ ↓ – além da cor; somente regiões avaliadas; sem valores técnicos |
| `packages/fit-preview-3d/src/styles.ts` (novo) | CSS `vfp-*` injetado uma vez (hover, `:focus-visible`, `prefers-reduced-motion`, transições) alinhado aos tokens do VESTE.AI |
| `packages/fit-preview-3d/src/useFitPreview.ts` | `useResponsiveCanvasHeight`, `usePrefersReducedMotion` |
| `packages/fit-preview-3d/src/AvatarScene.tsx` | `<color attach="background">` (`#e3dcd2`) — corrige palco **preto** (clear color padrão com `alpha:false`) e garante contraste da silhueta; repassa `onContextRestored` |
| `packages/fit-preview-3d/src/WebGLContextGuard.tsx` | Também escuta `webglcontextrestored` |
| `packages/fit-preview-3d/src/scaleBody.ts` | `parseGarmentColor`: "off-white", "cru", "areia" (a Camiseta Essential é "Off-white" e caía no cinza padrão) |
| `apps/web/src/components/fit/result-view.tsx` | Layout 2 colunas/mobile; painel de recomendação com `recommendedSize × selectedPreviewSize`; score único (`ScoreRing`) + rótulo da escala do motor; `FitLegend` lista; explicação sob demanda; erro local de troca de tamanho com fechar; textos "Preparando provador…"/"Atualizando tamanho…"; `useReducedMotion` |
| `apps/web/src/components/fit/fit-preview-3d-lazy.tsx` | Loading "Preparando provador…" (`role=status`); fallback sem WebGL não renderiza grade vazia |
| `apps/web/src/components/fit/region-grid.tsx` | `compact`: 2→3 colunas (5 colunas estouravam a coluna do provador) |
| `apps/web/src/components/catalog/product-fit-preview.tsx` | Seleção sem `setState` em effect (chave por recomendação) |
| `apps/web/src/lib/api.ts` | `getRecommendation(analysisId, size?)` |
| `apps/api/app/api/v1/routes/recommendations.py` | `GET /recommendations/{id}?size=L` — recalcula outro tamanho a partir do `input_snapshot` persistido (não persiste) |
| `apps/api/tests/test_api.py` | `test_get_recommendation_with_size_uses_persisted_snapshot` |
| `packages/widget/src/VesteFit.tsx` | `enable3D` padrão **`false`** |

## Recomendado × visualizado

- Bloco fixo "Tamanho recomendado" com a letra grande e `ConfidenceBadge` — nunca muda com a seleção.
- Quando `selectedPreviewSize !== recommendedSize`: faixa terracota "Visualizando tamanho L · Recomendado: M" + botão "Voltar ao recomendado" (`data-testid=back-to-recommended`). Quando iguais: nada extra.
- Score exibido uma única vez na viewport (`ScoreRing` do tamanho visualizado) com o `scale_label` do motor quando disponível; comparação por barras fica abaixo da dobra.

## Consistência de dados descoberta na validação (corrigida)

Ao gerar a explicação de outro tamanho sem perfil, o cliente reconstruía `customer` a partir de `regions[].body` (perdendo altura/peso) e o motor devolvia `fit_score` diferente do `comparison` (L: 8,1 × 8,4). Correção na fonte: `GET /recommendations/{id}?size=` reutiliza o `input_snapshot` da análise; o cliente prefere essa rota e só usa `POST persist:false` (agora incluindo `fit_preview.body.height`) quando a análise não foi persistida. Teste de API garante `fit_score` e `regions` idênticos ao `comparison`.

## Acessibilidade

- Seletor: `radiogroup`/`radio`, `aria-checked`, `aria-label` com tamanho, score e "recomendado", teclado (← → ↑ ↓ Home End), `:focus-visible` com anel duplo, `aria-busy` no tamanho em carregamento.
- Controles: `toolbar` + `group`, `aria-label`/`title`, `aria-pressed` na vista ativa, alvos ≥ 28–32 px.
- Legenda: `ul[aria-label]`, glifos textuais (✓ ↑ ↓ –) e rótulo por extenso — status não depende só de cor.
- Estados vivos: `role=status`/`aria-live=polite` em "Preparando provador…" e "Atualizando tamanho…"; `role=alert` no erro de troca de tamanho.
- Movimento: `prefers-reduced-motion` desliga fade/transições no pacote (CSS) e `useReducedMotion` no web (Framer Motion).
- Landmarks: `section[aria-label]` para provador, recomendação, regiões, explicação e detalhe técnico.

## Estados

| Situação | UI |
|---|---|
| Carregando análise | skeleton + "Preparando provador…" |
| Import dinâmico do 3D | "Preparando provador…" (`role=status`) |
| Troca de tamanho com `comparison[].regions` | instantânea, fade curto; canvas não desmonta |
| Troca de tamanho sem dados (comparison incompleto) | pílula "Atualizando tamanho…" no palco; chip com `aria-busy`; `GET ?size=` |
| Erro da API ao trocar tamanho | `role=alert` local, com fechar; recomendação original intacta |
| Sem WebGL / contexto perdido (após 1,5 s sem restauração) | `RegionGrid` compacto (3 colunas) + seletor + legenda + disclaimer |
| GLB placeholder / erro de GLB | silhueta + primitivas (silencioso) |
| Sem regiões avaliadas | painel "Sem detalhe regional…" (sem tabela vazia); detalhe técnico oculto |
| Explicação de outro tamanho | botão "Gerar explicação para {tamanho}" (sob demanda) |

Disclaimer do backend permanece visível e discreto sob o provador.

## Decisões de UX

- Controles **abaixo** do canvas (não sobrepostos) para não cobrir o avatar no mobile.
- Painel lateral usa linguagem de vestibilidade (`describeRegionFit`); valores em cm ficam na seção "Detalhe técnico" mais abaixo.
- `showSummary=false`/`showLegend=false` no `/analise/[id]` para não duplicar score/legenda com o painel; na PDP e no widget o próprio `FitPreview3D` mostra o resumo.
- Fundo do palco `#e3dcd2` (mist) — a silhueta `#ede6dc` precisa de contraste; ivory puro a tornava invisível.
- Widget: `enable3D` passa a `false` por padrão (bundle three/R3F só sob opt-in). Sem breaking change: pacote privado e o único consumidor (`apps/web/src/components/partner/product-widget.tsx`) já passa `enable3D` explicitamente.

## Validação visual realizada

Ambiente: browser embutido do Cursor, `next dev` em `http://localhost:3000` + API `uvicorn` local; análise real criada via `POST /api/v1/recommendations` (Camiseta Essential, perfil demo → M · 8,8).

| Verificação | Resultado |
|---|---|
| Desktop (~1910 px): duas colunas, provador à esquerda, recomendação/regiões à direita | OK |
| Troca M → L → XL pelo seletor: faixa "Visualizando…", score, legenda, detalhe técnico, componentes atualizam; "Voltar ao recomendado" funciona | OK |
| "Gerar explicação para L": textos do motor para L carregados; scores consistentes com o comparison após a correção `?size=` | OK |
| Canvas 3D renderizado (silhueta, peça primitiva, anéis, controles) | OK — observado; **fundo preto** detectado e corrigido |
| Fallback sem WebGL: `RegionGrid` 3 colunas + seletor + legenda, sem overflow | OK (overflow de 5 colunas detectado e corrigido) |
| Mobile 390×844 (CDP `Emulation.setDeviceMetricsOverride`): ordem recomendação → provador → regiões; `scrollWidth === clientWidth`; toque no seletor funciona | OK |
| Hydration warning em `src/components/site/header.tsx` | pré-existente, fora do escopo |

Limitação do ambiente: o browser embutido perde o contexto WebGL de forma intermitente (fallback 2D ativado corretamente); o render 3D foi observado em uma das cargas, e a correção de fundo (`<color attach="background">`) não pôde ser re-capturada em screenshot.

## Arquivos criados

- `packages/fit-preview-3d/src/styles.ts`
- `docs/implementation/ETAPA_04_UX_PROVADOR.md`

## Arquivos modificados

- `packages/fit-preview-3d/src/FitPreview3D.tsx`, `SizeSelector3D.tsx`, `FitPreviewControls.tsx`, `FitLegend.tsx`, `AvatarScene.tsx`, `WebGLContextGuard.tsx`, `useFitPreview.ts`, `scaleBody.ts`, `index.ts`
- `apps/web/src/components/fit/result-view.tsx`, `fit-preview-3d-lazy.tsx`, `region-grid.tsx`
- `apps/web/src/components/catalog/product-fit-preview.tsx`
- `apps/web/src/lib/api.ts`
- `apps/api/app/api/v1/routes/recommendations.py`, `apps/api/tests/test_api.py`
- `packages/widget/src/VesteFit.tsx`
- `docs/VIRTUAL_FITTING_ARCHITECTURE.md`

Não alterados: `apps/api/app/engine/**`, `fitVisualization.ts`, `regionLegend.ts`, `RegionalOverlay.tsx`, `AvatarBody.tsx`, `GarmentMesh.tsx`, assets.

## Testes

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npx vitest run --root packages/fit-preview-3d` | PASS — 48 |
| `npm run test:web` | PASS — 7 |
| `npm run test:widget` | PASS — 3 |
| `apps/api`: `python -m pytest` | PASS — 32 (novo teste `?size=`) |

## Build

- `npm run build:web` — PASS
- `npm run build:widget` — PASS (IIFE 2,82 MB / 4,37 MB; 3D agora opt-in)

## Lint

`npm run lint:web` — FAIL com 8 erros `react-hooks/set-state-in-effect` + 2 avisos **pré-existentes** em arquivos não tocados (`profile.tsx`, `analyze-cta.tsx`, `catalog-grid.tsx`, `catalog-fit-preview-section.tsx`, `measurement-form.tsx`, `photo-upload.tsx`, `empresa/integracoes`, `empresa/widget`). Zero problemas nos arquivos desta etapa (um aviso novo de import não usado foi corrigido).

## Limitações

- Sem asset GLB real, o palco mostra silhueta + primitivas (herdado).
- Transição da peça primitiva ao trocar tamanho é instantânea (sem interpolação no Canvas); o fade aplica-se aos elementos HTML.
- Contexto WebGL perdido e não restaurado em 1,5 s vira fallback definitivo (sem re-tentativa automática).
- `result-view.tsx` importa helpers do índice de `@veste-ai/fit-preview-3d` (mesmo padrão anterior); o Canvas continua em `dynamic(..., { ssr:false })`.

## Pendências

- PENDENTE: asset 3D real (avatar e peças) — herdado das Etapas 2/3.
- Re-validar o render 3D com fundo mist em navegador com GPU estável.
- Lint pré-existente do web fora do escopo.
- Próxima etapa (não iniciada): CatVTON local.
