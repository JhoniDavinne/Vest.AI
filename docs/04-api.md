# 04 — API REST v1

Base: `http://localhost:8000`

Prefixo: `/api/v1`

Documentação interativa: `http://localhost:8000/docs`

Especificação: `http://localhost:8000/api/v1/openapi.json`

## Autenticação B2B

Endpoints de empresa e cadastro de produto aceitam:

```http
X-API-Key: veste_demo_key_loja_parceira
```

A recomendação funciona sem chave (canal web). Com chave, a análise é atribuída à empresa e ao canal (`api` ou `widget`).

## Endpoints

### Saúde

```http
GET /api/v1/health
```

Retorna status da API, tipo de banco, modo de visão e contagens.

### Consumidor

```http
POST   /api/v1/users
GET    /api/v1/users/{user_id}
PATCH  /api/v1/users/{user_id}
PUT    /api/v1/users/{user_id}/measurements
POST   /api/v1/users/{user_id}/photo
```

O upload de foto exige `consent=true`. A imagem é processada em memória e descartada; só proporções aproximadas são persistidas.

### Catálogo

```http
GET  /api/v1/products
GET  /api/v1/products/{id}
GET  /api/v1/products/{id}/sizes
POST /api/v1/products
```

`{id}` aceita UUID ou slug.

### Motor

```http
POST /api/v1/recommendations
GET  /api/v1/recommendations/{analysis_id}
POST /api/v1/feedback
GET  /api/v1/engine/config
```

### Empresa e métricas

```http
GET /api/v1/companies/me
GET /api/v1/companies/{company_id}
GET /api/v1/companies/{company_id}/dashboard
GET /api/v1/metrics/dashboard
```

## Request de recomendação

Campos aceitos:

- `sku` **ou** `product_id` (+ `size` opcional)
- `customer` **ou** `user_id`
- `fit_preference`: `tight` | `regular` | `loose`
- `photo_analysis_id`, `use_photo`
- `channel`: `web` | `api` | `widget`
- `persist` (padrão verdadeiro)

Exemplo oficial da demonstração:

```json
{
  "sku": "CAMISETA-001-M",
  "customer": {
    "height": 180,
    "chest": 102,
    "waist": 88,
    "hip": 100,
    "shoulder": 45
  },
  "fit_preference": "regular"
}
```

## Response

```json
{
  "recommended_size": "M",
  "fit_score": 8.7,
  "confidence": "medium",
  "regional_analysis": {
    "chest": "good",
    "waist": "good",
    "hip": "attention",
    "shoulder": "good"
  },
  "explanation": "A modelagem apresenta boa compatibilidade com as medidas informadas.",
  "recommendation": "O tamanho M apresenta o melhor equilíbrio entre as regiões analisadas.",
  "comparison": [
    { "size": "S", "fit_score": 6.8, "recommended": false },
    { "size": "M", "fit_score": 8.7, "recommended": true },
    { "size": "L", "fit_score": 7.9, "recommended": false },
    { "size": "XL", "fit_score": 6.9, "recommended": false }
  ]
}
```

A resposta real inclui ainda `analysis_id`, componentes, pesos, detalhes regionais, mensagens de escala e notas.

## cURL

```bash
curl -X POST http://localhost:8000/api/v1/recommendations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: veste_demo_key_loja_parceira" \
  -d "{\"sku\":\"CAMISETA-001-M\",\"customer\":{\"height\":180,\"chest\":102,\"waist\":88,\"hip\":100,\"shoulder\":45},\"fit_preference\":\"regular\"}"
```

## Como usar no Studio

Abra `/empresa/api`, edite o JSON e clique em **Enviar request**. A tela mostra HTTP status, tempo, visualização e o JSON real do backend.

## Contratos TypeScript

Os tipos em `packages/contracts/src/index.ts` espelham os schemas Pydantic. Web e widget compartilham o mesmo contrato.
