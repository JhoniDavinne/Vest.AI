# Pipelines VESTE.AI

Dois pipelines acompanham o MVP: **exemplos** (demonstração reproduzível do motor) e **testes** (regressão automática).

## Pipeline de exemplos

Cenários em `pipelines/examples/payloads/`:

| Arquivo | O que demonstra |
|---|---|
| `01_camiseta_regular.json` | Perfil da banca → tamanho **M** com score alto |
| `02_camiseta_solto.json` | Preferência solta desloca o equilíbrio |
| `03_calca_alfaiataria.json` | Categoria calça (regiões cintura/quadril/comprimento) |
| `04_medidas_incompletas.json` | Confiança **baixa** quando faltam medidas |
| `05_corpo_menor.json` | Corpo menor tende a S/M |
| `06_corpo_maior.json` | Corpo maior tende a L/XL |
| `07_comparar_tamanho_L.json` | Score do L muda; o recomendado continua M |
| `08_polo_widget.json` | Canal widget + `X-API-Key` |

```bash
# Na raiz de veste-ai, com o ambiente Python da API instalado
python pipelines/examples/run_examples.py --inprocess --assert

# Contra a API já no ar
python pipelines/examples/run_examples.py --live --base http://localhost:8000
```

## Pipeline de testes

```bash
python pipelines/tests/run_all.py
# ou no PowerShell
pwsh -File pipelines/tests/run_all.ps1
```

Ordem:

1. `pytest` em `apps/api` (motor + HTTP + seed)
2. Pipeline de exemplos com `--assert`
3. Testes do pacote `@veste-ai/widget`

## Como usar na banca

1. Rode os exemplos in-process para provar que o motor é determinístico.
2. Suba a API e repita `--live` para mostrar o mesmo JSON na tela `/empresa/api`.
3. Abra `01_camiseta_regular.json` e compare com o request padrão do Studio.
