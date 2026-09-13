# 06 — VESTE.AI Studio (B2B)

Área da empresa em `/empresa`. Layout próprio (`StudioShell`) com navegação:

- Visão geral
- Produtos & SKUs
- Testar API
- Widget
- Métricas
- Integrações

## Visão geral `/empresa`

Painel com produtos, SKUs, análises, chamadas via API e via widget. Status do banco e da visão computacional. Atalhos para as demais telas.

## Produtos `/empresa/produtos`

Lista o catálogo com ficha técnica expansível. Ações:

- ver na loja VESTE.AI
- ver na loja parceira (widget)
- testar via API

Cadastro em `/empresa/produtos/novo` — nome, categoria, modelagem, tecido, elasticidade e medidas por tamanho. O POST vai para `/api/v1/products` com a chave demo.

## Testar API `/empresa/api`

Request editável + cURL + response visual e JSON. É o mesmo `POST /api/v1/recommendations` da aplicação e do widget.

Query `?sku=CAMISETA-001-M` pré-carrega o payload.

## Widget `/empresa/widget`

Pré-visualização ao vivo de `<VesteFit />` e snippet de integração.

## Métricas `/empresa/metricas`

Gráficos calculados com Pandas sobre análises persistidas:

- análises realizadas
- taxa de recomendação (score ≥ 7,0)
- tamanho mais recomendado
- score médio e confiança média
- distribuição de tamanhos, faixas de score, categorias e canais
- potencial ilustrativo de redução de devoluções

Sempre identificado como **Dados simulados para demonstração.**

## Integrações `/empresa/integracoes`

Chaves da empresa demo, guia de integração e cURL. Header obrigatório: `X-API-Key`.

## Como usar

Entre por **Sou empresa** na landing. Mostre produtos → API → widget → métricas. Feche ligando o resultado à hipótese de reduzir devoluções.
