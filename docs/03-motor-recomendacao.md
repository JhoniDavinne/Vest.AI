# 03 — Motor de recomendação

Implementação: `apps/api/app/engine/`.

O motor é determinístico: mesmas entradas produzem a mesma saída. Não há chamada a modelo generativo.

## Fórmula oficial do MVP

```text
score = 0.40 × measurements
      + 0.20 × modeling
      + 0.15 × elasticity
      + 0.15 × visual_proportion
      + 0.10 × preference
```

Cada componente sai normalizado em 0–1. O score final é multiplicado por 10 e limitado a 0–10.

Sem foto utilizável, o peso de 15% das proporções é **redistribuído** proporcionalmente entre os demais.

## Componentes

### Medidas (40%)

Compara a folga real (medida da peça − medida do corpo) com a folga de projeto da categoria/modelagem. O desvio entra numa curva gaussiana cuja largura é a tolerância da região (peito, cintura, quadril, ombro, comprimento).

Ficar mais justo do que o desenhado pesa um pouco mais do que sobrar (`tight_side_factor = 0.8`).

### Modelagem (20%)

Slim, regular, relaxed e oversized absorvem faixas diferentes de desvio (3,5 a 10 cm). O componente mede quanto do erro cabe nessa faixa.

### Elasticidade (15%)

Usa o percentual de elasticidade cadastrado na peça. Tecido mais elástico tolera ajuste mais justo.

### Proporções visuais (15%, opcional)

A foto não classifica aparência nem faz reconhecimento facial. Extrai relações aproximadas (ombro/quadril, cintura/quadril, tronco/pernas) para ajustar ênfase regional. Sem consentimento ou sem qualidade, o componente é omitido.

### Preferência (10%)

Justo, regular ou solto desloca a folga desejada (−3 cm, 0, +4 cm).

## Escala de caimento

| Faixa | Interpretação | Mensagem |
|---|---|---|
| 8,5–10 | Alta compatibilidade | A peça tende a apresentar bom ajuste nas medidas informadas. |
| 7,0–8,4 | Boa compatibilidade | Boa opção; pode haver pequena diferença em uma região específica. |
| 5,0–6,9 | Compatibilidade moderada | O tamanho pode servir, mas recomendamos observar algumas regiões. |
| 0–4,9 | Baixa compatibilidade | Outro tamanho ou modelagem tende a oferecer ajuste mais próximo da preferência informada. |

## Confiança

| Nível | Quando |
|---|---|
| Alta | Medidas completas + análise visual utilizável |
| Média | Medidas completas, sem foto |
| Baixa | Medidas incompletas ou cobertura técnica insuficiente |

A confiança também considera a margem entre o 1º e o 2º tamanho e a cobertura da ficha técnica.

## Regiões

Cada região recebe um status:

- **Compatível**
- **Atenção**
- **Folga recomendada**
- **Não avaliado** (quando a medida da pessoa ou da peça falta)

Categorias usam regiões diferentes: calça avalia cintura, quadril e comprimento; camiseta inclui peito e ombro.

## Comparação entre tamanhos

O motor avalia **todos** os SKUs da peça e devolve a curva (S/M/L/XL ou numérica). O tamanho recomendado é o de maior score; empate resolve pelo menor desvio médio.

Selecionar outro SKU muda o `fit_score` do tamanho avaliado, mas o `recommended_size` permanece o melhor.

## Parâmetros

Todos os valores em `engine/config.py` são **heurísticos do MVP**. Não devem ser apresentados como cientificamente validados. Podem ser sobrescritos por JSON em `VESTE_ENGINE_CONFIG`.

## Como explicar na banca

1. Mostrar a fórmula.
2. Rodar o perfil demo na camiseta → M ≈ 8,7.
3. Trocar para L e apontar a mudança do score.
4. Abrir “Como calculamos” e o JSON da API.
5. Repetir o mesmo request pelo widget.
