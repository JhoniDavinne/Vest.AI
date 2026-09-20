# Docker — VESTE.AI

```powershell
# na raiz do monorepo
npm run docker:up          # postgres + api + web
npm run docker:up:gpu      # + tryon (CatVTON, GPU NVIDIA) — requer NVIDIA Container Toolkit / Docker Desktop WSL2
npm run docker:down        # para (volumes preservados)
npm run docker:down:volumes
```

| Serviço | URL | Observação |
|---|---|---|
| Web | http://localhost:3000 | Next.js standalone |
| API / Swagger | http://localhost:8000/docs | migrations Alembic no startup |
| Postgres | localhost:5432 · `veste`/`veste` · db `veste_ai` | volume `veste_pg` |
| TryOn (profile `gpu`) | http://localhost:8100/health | só diagnóstico; o frontend usa a API |

Arquivos: `docker-compose.yml`, `Dockerfile.api` (+ `api-entrypoint.sh`), `Dockerfile.web`, `Dockerfile.tryon`, `gpu.env`.

Sem o profile `gpu`, o provador com foto aparece desativado e o restante funciona normalmente. Com o profile, a primeira subida do `tryon` baixa ≈6 GB de checkpoints para o volume `veste_hf_cache` (fica `starting` até `modelLoaded=true`).

Portas alternativas: `API_PORT`, `WEB_PORT`, `POSTGRES_PORT`, `TRYON_PORT`, `NEXT_PUBLIC_API_URL` (esta última exige rebuild do web).

Detalhes: `docs/implementation/ETAPA_07_DOCKER_DEPLOYMENT.md`.
