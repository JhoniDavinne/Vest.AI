# ETAPA 05 — CatVTON local (Virtual Try-On)

**STATUS: ADIADA**

Motivo: implementação e validação local do CatVTON serão realizadas posteriormente para evitar consumo desnecessário de recursos (GPU, VRAM, download de checkpoints de vários GB, instalação de torch/CUDA) durante esta fase.

Nesta etapa **nada foi implementado**: nenhuma dependência instalada, nenhum checkpoint baixado, nenhuma configuração de CUDA, nenhuma inferência executada, nenhum microserviço criado. Este documento registra apenas o plano futuro já definido em `docs/VIRTUAL_FITTING_ARCHITECTURE.md`.

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md` (seção "CatVTON"), `docs/implementation/ETAPA_02_DIGITAL_TWIN_3D.md`, `docs/implementation/ETAPA_03_FIT_INTEGRATION.md`, `docs/implementation/ETAPA_04_UX_PROVADOR.md`.

## Premissas invariáveis

- `RecommendationEngine` (`apps/api/app/engine/**`) permanece a única fonte de tamanho recomendado, `fit_score`, confiança, regiões e justificativas. O try-on **não altera** nenhum desses valores; apenas gera uma imagem ilustrativa do SKU já recomendado/selecionado.
- Sem integração de frontend nesta etapa (nenhuma alteração em `apps/web`, `packages/fit-preview-3d` ou `packages/widget`).

## Plano futuro (já definido)

### Arquitetura

- **Serviço Python isolado** em `apps/tryon/` (diretório ainda não criado), com FastAPI mínimo.
- **Ambiente próprio**: não compartilhar venv, `pyproject`, imagem Docker nem processo com `apps/api`. Motivo: CatVTON exige Python 3.9/3.10 + `torch==2.4.0` + `diffusers` (git) + `transformers 4.46`, incompatível com `apps/api` (`requires-python >= 3.11`; máquina local com Python 3.14).
- **GPU NVIDIA/CUDA** obrigatória (~8 GB VRAM em bf16 a 1024×768, Ampere ou superior). CPU não é caminho suportado (latência de minutos por imagem).
- Preferir a variante **CatVTON-MaskFree** na v1 para evitar Detectron2/DensePose/SCHP.
- Pesos baixados uma única vez para volume local (`HF_HOME`), sem internet em runtime. Licença dos pesos: uso não comercial/acadêmico — adequado ao TCC; documentar e nunca expor via widget/API B2B.

### Endpoints do serviço `apps/tryon`

| Método | Rota | Contrato previsto |
|---|---|---|
| GET | `/health` | `{ status, gpu: bool, device, model_loaded: bool, vram_total_mb, vram_free_mb, max_concurrent_jobs, queue_depth }` |
| POST | `/try-on` | multipart: `person_image` (foto frontal), `garment_image` (imagem flat da peça), campos `sku`, `analysis_id` (opcional), `seed`, `steps`, `guidance`. Resposta: `{ job_id, status, image_base64 \| image_url, expires_at, duration_ms }` (síncrono na v1; assíncrono com `GET /try-on/{job_id}` se a latência exigir) |

### Execução

- **Modelo carregado uma única vez** no startup (singleton do pipeline em bf16, `torch.inference_mode()`); nunca recarregar por requisição.
- **`MAX_CONCURRENT_JOBS=1`**: semáforo/fila em memória; requisições excedentes recebem `429` (ou `202` + `job_id` no modo assíncrono) com `Retry-After`.
- **Tratamento de OOM**: capturar `torch.cuda.OutOfMemoryError` → `torch.cuda.empty_cache()`, resposta `503` com mensagem controlada, contador de OOM no `/health`; após N falhas consecutivas, degradar para `status: "degraded"` e recusar novos jobs até reinício. Redimensionar entradas para o teto (1024×768) antes da inferência.
- Timeout por job (`VESTE_TRYON_TIMEOUT_S`) e limite de tamanho de imagem (reutilizar o teto de 8 MB de `VESTE_MAX_PHOTO_BYTES`).

### Privacidade das imagens

- Processamento **efêmero**: imagens da pessoa mantidas apenas em memória/`tmpfs` durante o job; nunca gravadas em disco persistente nem em banco; resultado com TTL curto (`VESTE_TRYON_RESULT_TTL_S`) e apagado após entrega.
- Sem vínculo persistente entre imagem e `user_id`; logs sem payload de imagem (apenas `job_id`, `sku`, duração, status).
- Consentimento **específico** para try-on (separado do consentimento de análise de proporções em `apps/api/app/services/photo_service.py`), a ser tratado na futura integração com `apps/api`.
- Coerente com a política atual do projeto: a imagem nunca é persistida (`PhotoAnalysis` guarda só proporções).

### Integração futura com `apps/api` (fora desta etapa)

- `apps/api/app/api/v1/routes/tryon.py` + `apps/api/app/services/tryon_service.py` como proxy: valida consentimento, obtém `flat_image_url` do produto (campo ainda inexistente em `Product` — exige migração Alembic futura), encaminha ao serviço, persiste apenas metadados (`TryOnJob`).
- Flags/env: `VESTE_TRYON_ENABLED`, `VESTE_TRYON_URL`, `VESTE_TRYON_TIMEOUT_S`, `VESTE_TRYON_RESULT_TTL_S`; expor `tryon` em `GET /api/v1/health`.
- Docker: `Dockerfile` CUDA próprio e perfil opcional (`--profile gpu`) em `docker/docker-compose.yml`.
- Frontend: seção "Provador com foto (experimental)" em `apps/web/src/components/fit/result-view.tsx` reutilizando o padrão de `apps/web/src/components/consumer/photo-upload.tsx`; nunca no widget.

## Pré-requisitos para retomar a etapa

- GPU NVIDIA com ≥ 8 GB VRAM e driver/CUDA compatível com `torch 2.4`.
- Imagens flat reais das peças (os SVGs em `apps/web/public/products/` não servem como `garment_image`).
- Autenticação mínima de consumidor antes de habilitar em ambiente compartilhado (`GET /users/{id}` hoje é aberto).

## Arquivos criados

- `docs/implementation/ETAPA_05_CATVTON_LOCAL.md`

## Arquivos modificados

- `docs/VIRTUAL_FITTING_ARCHITECTURE.md` (status da etapa)

## Pendências

- Toda a implementação descrita acima (adiada).
- PENDENTE: asset 3D real — herdado das Etapas 2–4.
