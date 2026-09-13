# 10 — Pipelines de exemplos e testes

Há dois pipelines versionados em `pipelines/`.

## Pipeline de exemplos

Arquivos JSON em `pipelines/examples/payloads/`. Cada um tem `name`, `request` e `expect`.

| Caso | Demonstra |
|---|---|
| 01 camiseta regular | Resultado canônico da banca (M, score alto) |
| 02 camiseta solto | Preferência desloca o equilíbrio |
| 03 calça alfaiataria | Outra categoria e grade numérica |
| 04 medidas incompletas | Confiança baixa |
| 05 corpo menor | Recomendação tende a S/M |
| 06 corpo maior | Recomendação tende a L/XL |
| 07 comparar L | Score muda; recomendado continua M |
| 08 polo widget | Canal widget + API key |

### Como rodar

```bash
# Sem servidor — TestClient + SQLite + seed
python pipelines/examples/run_examples.py --inprocess --assert

# API já no ar
python pipelines/examples/run_examples.py --live --base http://localhost:8000

# Atalho npm
npm run pipeline:examples
```

`--assert` faz o processo sair com código 1 se alguma expectativa falhar. Sem a flag, o script só imprime a tabela.

### Como adicionar um exemplo

1. Copie um JSON em `payloads/`.
2. Ajuste `request` e `expect`.
3. Rode o pipeline. Não é preciso alterar Python.

Expectativas suportadas: `recommended_size`, `recommended_size_in`, `confidence`, `evaluated_size`, `min_score`, `max_score`.

## Pipeline de testes

```bash
python pipelines/tests/run_all.py
pwsh -File pipelines/tests/run_all.ps1
npm run pipeline:test
```

Ordem:

1. `pytest` em `apps/api` — motor puro + HTTP + persistência
2. Pipeline de exemplos com `--assert`
3. Testes Vitest do `@veste-ai/widget`

Flags: `--skip-widget`, `--skip-examples`.

## Testes unitários já existentes

- `apps/api/tests/test_engine.py` — pesos, gaussiana, curva da camiseta, preferência, foto, determinismo, catálogo inteiro
- `apps/api/tests/test_api.py` — health, OpenAPI, recomendação, usuário, foto, feedback, produto, métricas
- `packages/widget/tests/client.test.ts` — montagem do request e header
- `apps/web/src/lib/utils.test.ts` — formatação e faixas de score

```bash
npm run test:api
npm run test:widget
npm run test:web
```

## CI

`.github/workflows/ci.yml` roda pytest, pipeline de exemplos e testes do widget em Ubuntu.

## Como usar na banca

Mostre a tabela do pipeline de exemplos no terminal e compare a linha 01 com o JSON da tela `/empresa/api`. Isso prova que o motor não é um mock.
