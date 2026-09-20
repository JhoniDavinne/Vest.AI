# 11 — Limitações do MVP e próximos passos

## O que este recorte não é

- Aplicativo mobile nativo
- Marketplace ou rede social
- Provador 3D hiper-realista (simulação física de tecido, rosto fiel à foto)
- Modelo de machine learning treinado em escala
- Integração com dezenas de lojas reais
- Pagamentos ou e-commerce completo

O objetivo é provar viabilidade técnica: dados + motor explicável + API + widget.

## Limitações honestas

**Parâmetros heurísticos.** Pesos, tolerâncias e folgas de projeto não foram validados em estudo clínico ou em produção. Existem para tornar o cálculo transparente e reproduzível.

**Visão experimental.** A foto é enriquecimento. Sem ela o sistema continua correto, com confiança menor.

**Métricas simuladas.** O dashboard agrega análises geradas pelo próprio motor em perfis sintéticos. Sempre rotulado como dados de demonstração.

**Privacidade no MVP.** A imagem não é persistida, mas o ambiente acadêmico não substitui um programa formal de conformidade.

**Calibração por marca.** Tabelas reais de cada fabricante ainda não entram no aprendizado.

## Evolução prevista

1. Coletar feedback real de caimento, compra, troca e devolução.
2. Calibrar o score por marca, categoria, modelagem e tecido.
3. Trocar parte das regras por um modelo supervisionado — mantendo a explicação.
4. Levar o widget a um e-commerce parceiro de verdade.
5. Evoluir assets 3D (arte Blender/CC0) e calibrar deformação regional — a v1 já entrega avatar rotacionável estimado com fallback 2D.

## Mensagem para fechar a banca

O valor não é “adivinhar o corpo”. É reduzir incerteza na compra com um motor único, auditável, que já serve aplicação própria, API e componente incorporável.
