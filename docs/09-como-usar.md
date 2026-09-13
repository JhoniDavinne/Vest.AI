# 09 — Como usar (operação)

## Opção A — Local rápido (recomendada para a banca)

1. Instale Node 20+ e Python 3.11+.
2. No diretório `veste-ai`:

```bash
npm install
```

3. Em outro terminal, API:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --port 8000
```

4. Front-end:

```bash
npm run dev:web
```

5. Abra `http://localhost:3000` e `http://localhost:8000/docs`.

Sem PostgreSQL a API cria SQLite e popula o seed sozinha.

## Opção B — Docker

```bash
npm run docker:up
```

Serviços:

| Serviço | Porta |
|---|---|
| Web | 3000 |
| API | 8000 |
| Postgres | 5432 |

Encerrar e apagar o volume:

```bash
npm run docker:down
```

## Variáveis

Copie `.env.example`. As da API usam prefixo `VESTE_`.

| Variável | Função |
|---|---|
| `VESTE_DATABASE_URL` | Conexão SQLAlchemy |
| `VESTE_AUTO_SEED` | Seed se o banco estiver vazio |
| `VESTE_DEMO_API_KEY` | Chave da empresa demo |
| `NEXT_PUBLIC_API_URL` | URL da API no navegador |
| `API_URL` | URL da API no servidor Next (Docker: `http://api:8000`) |

## Perfil da demonstração

Use estes números para reproduzir o slide da banca:

| Campo | Valor |
|---|---|
| Altura | 180 cm |
| Peso | 78 kg |
| Peito | 102 cm |
| Cintura | 88 cm |
| Quadril | 100 cm |
| Ombro | 45 cm |
| Preferência | Regular |
| Produto | Camiseta Essential Algodão |
| SKU | CAMISETA-001-M |

Resultado esperado sem foto: tamanho **M**, score na faixa 8,5–9,0, confiança **média**.

## Checklist de 5 minutos

1. Landing
2. Consumidor + medidas
3. Foto opcional
4. Catálogo → camiseta
5. Resultado M
6. Comparar L
7. Como calculamos
8. Studio → API
9. Loja parceira + widget
10. Métricas (dados simulados)

## Problemas comuns

**Front sem produtos.** A API não está no ar. Confira a porta 8000.

**Studio vazio.** Mesma causa, ou chave demo diferente da do seed.

**Foto falhou.** Esperado se a visão não estiver instalada. Siga sem foto.

**Porta 3000 ocupada.** `npx next dev -p 3001` e ajuste CORS em `VESTE_CORS_ORIGINS`.
