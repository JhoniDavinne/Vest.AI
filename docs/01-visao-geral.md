# 01 — Visão geral do produto

## Problema

Uma foto bem produzida da roupa não garante que o consumidor compre o tamanho ou a modelagem mais compatível. A decisão hoje mistura tentativa, tabela genérica e devolução.

## Proposta

A VESTE.AI combina:

- dados do usuário (altura, peso, medidas, preferência de caimento);
- dados técnicos da peça (SKU, medidas, modelagem, tecido, elasticidade);
- opcionalmente, proporções estimadas a partir de uma foto autorizada;

para devolver:

- tamanho recomendado;
- score de caimento de 0 a 10;
- nível de confiança;
- diferenças por região;
- justificativa explicável;
- sugestão de ajuste.

## Dois públicos

1. **Consumidor final** — cria perfil, navega no catálogo e analisa o caimento.
2. **Empresa / e-commerce** — cadastra produtos e consome o mesmo motor por API ou widget.

## Mensagem central

A VESTE.AI não diz se uma roupa fica bonita ou feia em uma pessoa. Ela usa dados para estimar como aquela peça tende a vestir e ajudar o consumidor a tomar uma decisão de compra mais informada.

O score nunca é uma nota para o corpo.

## O que a banca deve entender

1. Qual problema é resolvido.
2. Quais dados alimentam a decisão.
3. Como a recomendação é calculada e explicada.
4. Como o MVP acadêmico vira produto integrado a e-commerces.

## Recorte consciente

Não há app nativo, marketplace, pagamentos, rede social, provador 3D nem modelo de ML em larga escala. O foco é provar viabilidade técnica: persistência, motor real, API e widget no mesmo núcleo.
