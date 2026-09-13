# 05 — Experiência do consumidor

Rotas Next.js em `apps/web/src/app`.

## Landing `/`

Duas portas: **Sou consumidor** e **Sou empresa**.

Mensagem comercial:

> A VESTE.AI usa dados para estimar como uma peça tende a vestir e ajudar você a escolher um tamanho com mais segurança.

Não há linguagem que avalie o corpo como bonito, feio, ideal ou inadequado.

## Cadastro `/consumidor/perfil`

Campos persistidos:

- nome
- altura, peso
- peito/tórax, cintura, quadril, ombro
- preferência: Justo / Regular / Solto
- consentimento explícito para análise da foto

O usuário pode seguir sem foto.

## Upload `/consumidor/foto`

- arrastar e soltar
- selecionar arquivo
- preview
- instruções de enquadramento
- aviso: “Imagem utilizada apenas como enriquecimento da estimativa.”
- botão **Continuar sem foto**

A aplicação nunca classifica aparência. Se a visão falhar, o fluxo segue só com medidas e a confiança cai.

## Catálogo `/catalogo`

Oito a dez produtos seed (camiseta, camisa, calça, vestido, jaqueta, polo, moletom, shorts). Visual de e-commerce, não de tabela administrativa. Cada card leva ao detalhe.

## Produto `/catalogo/[slug]`

Mostra imagem, marca fictícia, modelagem, tecido, elasticidade, composição, tabela técnica por tamanho e o botão **Analisar caimento**.

## Resultado `/analise/[id]`

Tela principal da banca:

- tamanho recomendado
- score 0–10
- confiança
- explicação
- regiões (peito, cintura, quadril, ombros, comprimento)
- comparação S / M / L / XL (ou grade numérica)
- bloco **Como calculamos?**

Trocar o tamanho reconsulta a API com outro SKU. O score muda de verdade.

## Como calculamos `/como-calculamos`

Página permanente com pesos, escala, confiança e parâmetros públicos do motor (`GET /api/v1/engine/config`).

## Como usar na demo

1. Landing → consumidor.
2. Preencha o perfil demo (180 / 102 / 88 / 100 / 45) ou aceite os valores sugeridos.
3. Pule a foto para ganhar tempo — ou envie uma imagem para mostrar confiança alta.
4. Abra a Camiseta Essential.
5. Analise e compare M com L.
