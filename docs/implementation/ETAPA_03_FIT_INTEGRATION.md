# ETAPA 03 — Integração do 3D com o motor de caimento

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md`.
Branch: `feature/virtual-fitting`.

## Objetivo

Ligar o provador 3D ao `RecommendationEngine` de ponta a ponta, permitindo comparação visual entre tamanhos **sem recalcular nada no cliente** e sem depender de assets GLB reais.

```text
RecommendationEngine (Python)
        ↓  recommend() → RecommendationResult.comparison[SizeEvaluation + regions]
RecommendationResponse  (regions + comparison[].regions)
        ↓  createFitVisualizationState / createFitVisualizationStateForSize
FitVisualizationState
        ↓
FitPreview3D
   ├── SizeSelector3D      (HTML)
   ├── FitPreviewControls  (HTML)
   ├── AvatarScene         (Canvas) → AvatarBody · GarmentMesh · RegionalOverlay
   └── FitLegend           (HTML)
```

Fonte oficial única de tamanho, `fit_score`, confiança, regiões (`ease`, `design_ease`, `deviation`, `score`, `status`) e justificativas: `apps/api/app/engine`. Nenhuma alteração foi feita no motor.

## Fluxo implementado

1. `POST /api/v1/recommendations` devolve, além de `regions` do tamanho avaliado, `comparison[]` com `regions` completas por tamanho (já calculadas em `RecommendationEngine.recommend()`).
2. O cliente cria `FitVisualizationState` para o tamanho avaliado (`createFitVisualizationState`) e, ao trocar de tamanho, para o tamanho escolhido a partir de `comparison[]` (`createFitVisualizationStateForSize`) — sem HTTP.
3. `FitPreview3D` recebe `fit` + `sizes` e aplica o estado ao payload (`applyFitStateToPayload`): regiões e medidas da peça passam a ser as do tamanho selecionado (valores do motor); corpo, categoria, cor e tecido não mudam.
4. `RegionalOverlay` e `FitLegend` renderizam exclusivamente `status`/`deviation`/`score` do estado.
5. Se `comparison[]` não trouxer `regions` (resposta antiga/incompleta), o host consulta `POST /recommendations` com `persist: false` (fluxo existente) e deriva o estado da resposta detalhada.

## FitVisualizationState

Arquivo: `packages/fit-preview-3d/src/fitVisualization.ts`.

```ts
interface FitVisualizationState {
  size: string; sku: string;
  fitScore: number | null;            // fit_score do motor para este tamanho
  confidence: Confidence | null;      // nível da análise (não é por tamanho)
  recommendedSize: string | null; recommendedSku: string | null;
  isRecommended: boolean;             // size === recommended_size
  regions: Record<FitRegionKey, FitRegionVisual | null>;  // chest, waist, hip, shoulder, length, sleeve
  regionList: FitRegionVisual[];      // ordem do motor, só presentes
  source: "response" | "comparison" | "payload";
}
interface FitRegionVisual { region; status: RegionStatus; label; body; garment; ease; designEase; deviation; score; note }
```

Regras: normaliza somente dados retornados pela API; ausentes ficam `null` (inclusive `sleeve`, que o motor não avalia); nenhum valor é inferido.

Funções: `createFitVisualizationState(response)`, `createFitVisualizationStateFromComparison(response, entry)`, `createFitVisualizationStateForSize(response, size)` (→ `null` quando não há dados), `createFitVisualizationStateFromPayload(payload)`, `listSizeOptions(response)` (`SizeOption { size, sku, fitScore, recommended, hasRegions }`), `applyFitStateToPayload(payload, state)`, `fitStateToRegionDetails(state)`, `buildRegions`, `toRegionVisual`.

## Mudanças nos contratos

| Local | Mudança |
|---|---|
| `apps/api/app/schemas/__init__.py` | `SizeComparison.regions: list[RegionDetail] = []` |
| `packages/contracts/src/index.ts` | `SizeComparison.regions?: RegionDetail[]` (opcional, compatível com respostas antigas) |

`FitPreviewPayload`, `RecommendationResponse.regions`, `RegionDetail` e `RegionStatus` (`good | attention | ease_recommended | not_evaluated`) permanecem iguais. Nenhuma nova nomenclatura de status foi criada.

## SizeComparison.regions

`apps/api/app/services/recommendation_service.py`:

- Nova função `region_details(regions: list[RegionResult]) -> list[RegionDetail]` (serialização pura).
- `build_response` usa `region_details(result.evaluated.regions)` para o topo e `region_details(e.regions)` para cada `e in result.comparison`.
- **Não** chama `evaluate_size` novamente: `RecommendationResult.comparison` já contém um `SizeEvaluation` completo por tamanho.
- Persistência (`FitAnalysis.comparison` JSON) não foi alterada (continua `size/sku/fit_score`); `GET /recommendations/{id}` recalcula deterministicamente e devolve o contrato completo.

Teste: `apps/api/tests/test_api.py::test_comparison_propagates_engine_regions_per_size` — todas as entradas trazem `regions` com as mesmas chaves de `regional_analysis`; `comparison[evaluated].regions == regions`; avaliar `L` diretamente devolve exatamente `comparison[L].regions` e `fit_score`.

## Troca de tamanho

```text
seleção (SizeSelector3D | SizeComparisonBars)
        ↓
resolvePreviewSelection(base, size, detailBySize)      apps/web/src/lib/fit-preview.ts
   1. base.comparison[size].regions  → estado (sem HTTP)
   2. detailBySize[size] (resposta persist:false já obtida) → estado
   3. null → needsEngineFetch → api.recommend({ sku, persist:false })
        ↓
FitVisualizationState → FitPreview3D (fit, sizes, loadingSize) · RegionGrid · ScoreRing
```

Em `apps/web/src/components/fit/result-view.tsx`:

- `base` = análise original; **nunca sobrescrita**. `recommendedSize = base.recommended_size`.
- `previewSize` = `selectedPreviewSize`; inicia no tamanho avaliado.
- Score, regiões, componentes e 3D do tamanho selecionado vêm do estado (comparison). Botão **"Voltar ao tamanho recomendado"** quando `selectedPreviewSize !== recommendedSize`.
- Textos do motor (`explanation`, `recommendation`, `scale_label/message`, `confidence_message`) são por tamanho avaliado; para outro tamanho são exibidos apenas quando há resposta detalhada — botão **"Gerar explicação para {tamanho}"** dispara `persist:false` sob demanda (nunca reutiliza o texto de outro tamanho).
- Dialog JSON mostra a resposta detalhada do tamanho selecionado quando existir, senão `base`.

`apps/web/src/components/catalog/product-fit-preview.tsx` (PDP): seleção local só entre tamanhos com `hasRegions` (sem HTTP). `packages/widget/src/fit-preview-3d.tsx` + `VesteFit.tsx`: seletor 3D atualiza `selectedSize`; chama `onEvaluate` apenas se o comparison não trouxer `regions`.

## Overlay regional

`packages/fit-preview-3d/src/RegionalOverlay.tsx` + `regionLegend.ts` + `FitLegend.tsx`:

| Elemento visual | Derivado de |
|---|---|
| Cor do anel | `status` (paleta `STATUS_COLOR_HEX`, igual ao `RegionGrid`) |
| Espessura, opacidade, emissão | intensidade = `1 − score` (ou padrão por status quando `score` é null) |
| Raio do anel (±0,012 un.) | sinal de `deviation`: negativo → para dentro ("mais ajustado"), positivo → para fora ("mais folgado"); anel fino de referência na posição neutra |
| Legenda "Peito — Compatível" | `describeRegionFit(status, deviation)`: `good`→Compatível · `ease_recommended`→Mais ajustado · `attention`+dev<0→Levemente mais ajustado · `attention`+dev>0→Levemente mais folgado · `not_evaluated`→Não avaliado |

O sinal de `deviation` apenas refina o texto de `attention`, exatamente como o motor faz ao redigir `note` (`engine/components/measurements.py::_classify`). Não há fórmula de caimento no cliente nem representação de precisão física.

## Arquivos criados

- `packages/fit-preview-3d/src/fitVisualization.ts`
- `packages/fit-preview-3d/src/regionLegend.ts`
- `packages/fit-preview-3d/src/SizeSelector3D.tsx`
- `packages/fit-preview-3d/src/FitLegend.tsx`
- `packages/fit-preview-3d/src/fitVisualization.test.ts`
- `packages/fit-preview-3d/src/regionLegend.test.ts`
- `apps/web/src/lib/fit-preview.ts`
- `apps/web/src/lib/fit-preview.test.ts`
- `docs/implementation/ETAPA_03_FIT_INTEGRATION.md`

## Arquivos modificados

- `apps/api/app/schemas/__init__.py` — `SizeComparison.regions`
- `apps/api/app/services/recommendation_service.py` — `region_details`, propagação em `build_response`
- `apps/api/tests/test_api.py` — novo teste de propagação
- `packages/contracts/src/index.ts` — `SizeComparison.regions?`
- `packages/fit-preview-3d/src/RegionalOverlay.tsx` — overlay dirigido por status/deviation/score
- `packages/fit-preview-3d/src/FitPreview3D.tsx` — props `fit`, `sizes`, `onSelectSize`, `loadingSize`, `showLegend`, `showSummary`; compõe seletor, resumo, controles, cena e legenda; fallback sem WebGL mantém seletor/resumo/legenda
- `packages/fit-preview-3d/src/AvatarScene.tsx` — prop `regions` repassada ao overlay
- `packages/fit-preview-3d/src/types.ts` — novas props em `FitPreview3DProps`
- `packages/fit-preview-3d/src/index.ts` — exports
- `apps/web/src/components/fit/result-view.tsx` — `recommendedSize` × `selectedPreviewSize`, estado via comparison, fetch sob demanda, botão de retorno
- `apps/web/src/components/catalog/product-fit-preview.tsx` — seleção local via comparison
- `packages/widget/src/fit-preview-3d.tsx`, `packages/widget/src/VesteFit.tsx` — seletor 3D no widget
- `docs/VIRTUAL_FITTING_ARCHITECTURE.md` — checklist e estado

Não alterados: `apps/api/app/engine/**`, `StylizedSilhouette.tsx`, `scaleBody.ts`, `silhouette.ts`, `constants.ts`, `useFitPreview.ts`, `WebGLContextGuard.tsx`, assets em `apps/web/public/models`.

## Testes

| Comando | Resultado |
|---|---|
| `npm run typecheck` (todos os workspaces) | PASS |
| `npx vitest run --root packages/fit-preview-3d` | PASS — 9 arquivos, 48 testes (criação do estado, troca de tamanho via comparison, recomendado × selecionado, região inexistente/`sleeve` null, `null` com comparison incompleto, `applyFitStateToPayload`, rótulos por `RegionStatus`, intensidade por score, manifest/fallback da Etapa 2) |
| `npm run test:web` | PASS — 7 testes (inclui `fit-preview.test.ts`: resolução sem HTTP, `needsEngineFetch`, voltar ao recomendado) |
| `npm run test:widget` | PASS — 3 |
| `apps/api`: `python -m pytest` | PASS — 31 (novo `test_comparison_propagates_engine_regions_per_size`) |
| `npm run lint:web` | FAIL — 8 erros `react-hooks/set-state-in-effect` + 2 avisos, **pré-existentes** (`profile.tsx`, `analyze-cta.tsx`, `catalog-grid.tsx`, `catalog-fit-preview-section.tsx`, `measurement-form.tsx`, `photo-upload.tsx`, `empresa/integracoes`, `empresa/widget`). Nenhum problema nos arquivos desta etapa (`result-view.tsx`, `product-fit-preview.tsx`, `lib/fit-preview.ts`) |

## Build

- `npm run build:web` — PASS (Next.js 16.3.5).
- `npm run build:widget` — PASS (tsup esm + iife + dts).

## Fallbacks verificados por construção

| Condição | Comportamento |
|---|---|
| GLB inexistente / placeholder / manifest indisponível | Silhueta + primitivas (Etapa 2); seletor, resumo e legenda continuam com dados do motor |
| WebGL indisponível / contexto perdido | `FitPreview3D` renderiza seletor + resumo + `fallback` do host (`RegionGrid`) + legenda; sem Canvas |
| Região ausente no motor | `regions[key] = null`; overlay e legenda ignoram; `RegionGrid` mostra só as presentes |
| `comparison` sem `regions` | `createFitVisualizationStateForSize` → `null`; host consulta a API (`persist:false`); PDP/widget restringem o seletor a tamanhos com `hasRegions` |
| Erro HTTP ao detalhar tamanho | Mensagem de erro; recomendação original (`base`) permanece intacta |

A recomendação textual nunca depende do Canvas.

## Limitações

- `FitAnalysis.comparison` persistido continua resumido; o detalhe regional por tamanho é recomputado deterministicamente em `GET /recommendations/{id}` (mesmo motor, mesma saída).
- Textos explicativos de outro tamanho exigem uma chamada `persist:false` sob demanda (o motor os gera por tamanho avaliado).
- Overlay usa anéis (sem heatmap por vértice) — adequado sem assets GLB reais; refinamento visual fica para UX/UI.
- Lint do web com falhas pré-existentes fora do escopo.

## Pendências

- PENDENTE: asset 3D real (avatar e peças GLB) — herdado da Etapa 2.
- UX/UI do provador: layout do seletor/legenda, animações de transição entre tamanhos, modo lado a lado.
- Opcional: persistir `regions` por tamanho em `FitAnalysis.comparison` (implica migração — fora desta etapa).
