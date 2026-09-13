# Docker — VESTE.AI

```bash
# na raiz do monorepo
npm run docker:up
```

Sobe PostgreSQL 16, a API FastAPI e o Next.js.

| Serviço | URL |
|---|---|
| Web | http://localhost:3000 |
| API / Swagger | http://localhost:8000/docs |
| Postgres | localhost:5432 · user/pass `veste` · db `veste_ai` |

```bash
npm run docker:down
```

Arquivos: `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.web`.
