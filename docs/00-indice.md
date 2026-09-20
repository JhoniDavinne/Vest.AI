# Documentação VESTE.AI — Índice

Este conjunto descreve o MVP da plataforma: o que ela faz, como está organizada, como o motor calcula, como a API e o widget se usam, e como reproduzir a demonstração.

Cada arquivo também é gerado em PDF em `docs/pdf/` pelo comando `npm run docs:pdf`.

| # | Documento | Para quem | Como usar |
|---|---|---|---|
| 01 | [Visão geral](01-visao-geral.md) | Banca e equipe | Entender o problema e a mensagem central |
| 02 | [Arquitetura](02-arquitetura.md) | Engenharia | Ver as camadas e o fluxo de dados |
| 03 | [Motor de recomendação](03-motor-recomendacao.md) | Engenharia / banca | Explicar o score |
| 04 | [API](04-api.md) | Integração B2B | Consumir o endpoint |
| 05 | [Experiência do consumidor](05-experiencia-consumidor.md) | Demo | Percorrer as telas |
| 06 | [Studio B2B](06-studio-b2b.md) | Demo empresa | Cadastrar produto e testar API |
| 07 | [Widget](07-widget.md) | Parceiro | Incorporar `<VesteFit />` |
| 08 | [Banco e seed](08-banco-e-seed.md) | Dados | Popular e resetar o ambiente |
| 09 | [Como usar](09-como-usar.md) | Operação | Subir local ou Docker |
| 10 | [Pipelines e testes](10-pipelines-e-testes.md) | QA | Rodar exemplos e regressão |
| 11 | [Limitações e próximos passos](11-limitacoes-e-proximos-passos.md) | Banca | Deixar claro o recorte do MVP |
| 12 | [Provador visual 3D](12-provador-3d.md) | Demo / banca | Avatar rotacionável e roteiro |

Leitura mínima para a apresentação: 01 → 03 → 09 → 07 → 12.
