# 07 — Widget incorporável

Pacote: `@veste-ai/widget`

Componente:

```tsx
import { VesteFit } from "@veste-ai/widget";

<VesteFit
  productId="camiseta-essential-algodao"
  sku="CAMISETA-001-M"
  apiBaseUrl="http://localhost:8000"
  apiKey="veste_demo_key_loja_parceira"
  label="Descubra seu tamanho ideal"
/>
```

## O que o widget faz

1. Mostra o botão **Descubra seu tamanho ideal**.
2. Abre um modal com medidas e preferência.
3. Chama `POST /api/v1/recommendations` com `channel: "widget"`.
4. Exibe tamanho, score, confiança, regiões e comparação.
5. Permite escolher o tamanho para o fluxo da loja (`onSelectSize`).

Nenhum cálculo de caimento vive no widget. Ele é um cliente HTTP.

## Props

| Prop | Uso |
|---|---|
| `productId` | Id ou slug do produto |
| `sku` | SKU específico (tem prioridade) |
| `apiBaseUrl` | URL da API |
| `apiKey` | Chave `X-API-Key` |
| `initialMeasurements` | Perfil autorizado / demo |
| `initialPreference` | `tight` / `regular` / `loose` |
| `accentColor` | Cor da loja hospedeira |
| `label` | Texto do botão |
| `onSelectSize` | Callback da loja |
| `onResult` | Callback com o JSON |
| `enable3D` | Provador visual 3D lazy no resultado (padrão: `true`) |

O canal do widget **não envia foto**. A análise visual fica no fluxo da aplicação VESTE.AI, com consentimento.

O provador 3D é carregado sob demanda (`React.lazy`) para não inflar o bundle inicial do embed. Desative com `enable3D={false}` se a loja preferir só a grade 2D.

Ver também: [12 — Provador visual 3D](12-provador-3d.md).

## Loja parceira (demonstração)

Marca fictícia **ATELIER NORTE**.

- `/loja-parceira` — vitrine
- `/loja-parceira/produto/[slug]` — PDP com o widget

Esta tela prova visualmente que o mesmo motor serve um e-commerce de terceiros.

## Build do pacote

```bash
npm run build:widget
```

Gera ESM e IIFE em `packages/widget/dist` (script de embed).

## Como usar na banca

1. Abra `/empresa/widget` e dispare o modal.
2. Depois abra `/loja-parceira/produto/camiseta-essential-algodao`.
3. Use as medidas já preenchidas (perfil demo) e mostre o resultado.
4. Volte ao Studio e aponte o incremento de “chamadas via widget”.
