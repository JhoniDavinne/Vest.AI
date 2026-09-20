# apps/tryon — CatVTON local (Virtual Try-On)

Serviço **isolado** de virtual try-on baseado no [CatVTON](https://github.com/Zheng-Chong/CatVTON) oficial, rodando localmente em GPU NVIDIA. Não faz parte do ambiente Python da API VESTE.AI (`apps/api`, Python ≥ 3.11) e não conhece usuários, análises nem o motor de recomendação.

> **Licença do CatVTON (código, pesos e demo): CC BY-NC-SA 4.0 — uso não comercial.**
> Este serviço herda essa restrição. Uso acadêmico (TCC) apenas.

## Origem do código vendorizado

| Item | Valor |
|---|---|
| Repositório | `https://github.com/Zheng-Chong/CatVTON.git` (fonte oficial) |
| Branch padrão | `edited` |
| Commit pinado | `7818397f25613beedb3d861a34769f607cfcf3b1` (2025-12-16) |
| Local | `apps/tryon/vendor/CatVTON` (clone; **gitignored**) |
| Reproduzir | `scripts/fetch_catvton.ps1` |
| Checkpoints | `zhengchong/CatVTON` (HF, público) + `booksforcharlie/stable-diffusion-inpainting` + `stabilityai/sd-vae-ft-mse` — baixados pelo mecanismo oficial (`huggingface_hub`), cache **fora** do repositório |

## Requisitos

- Windows 11 · NVIDIA RTX 50 (testado: RTX 5070 12 GB, driver 616.64)
- Python **3.12** (instalado via Python Install Manager: `pymanager install 3.12`)
- ~6 GB de disco para checkpoints (`%LOCALAPPDATA%\veste-ai\tryon\models`)

## Instalação

```powershell
cd apps/tryon
.\scripts\fetch_catvton.ps1                       # clona/pina vendor/CatVTON
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Validação obrigatória de CUDA (o serviço **recusa** rodar em CPU):

```powershell
.\.venv\Scripts\python.exe -c "import torch; print(torch.__version__); print(torch.version.cuda); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'NO CUDA')"
```

Esperado: `2.7.1+cu128 · 12.8 · True · NVIDIA GeForce RTX 5070`.

## Primeira geração com o CatVTON original (sem HTTP)

```powershell
.\.venv\Scripts\python.exe scripts/run_original_once.py --repeat 2
```

Gera `output/result_original_*.png` a partir dos exemplos públicos do repositório oficial e grava `output/run_original_report.json` (tempo, pico de VRAM).

## Serviço

```powershell
copy .env.example .env   # opcional; defaults já apontam para %LOCALAPPDATA%\veste-ai\tryon
.\.venv\Scripts\python.exe -m uvicorn service.main:app --host 127.0.0.1 --port 8100
```

O modelo é carregado **uma vez** no startup (`CatVTONRuntime.load()`) e permanece em GPU. Sem CUDA o processo aborta na inicialização.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | `status`, `device`, `cudaAvailable`, `gpu`, `torchVersion`, `cudaVersion`, `precision`, `modelLoaded`, `busy`, VRAM |
| POST | `/try-on` | multipart `person`, `garment`, `cloth_type` (`upper`/`lower`/`overall`), opcionais `steps`, `guidance_scale`, `seed` → `{ status, resultId, resultUrl, processingTimeMs, ... }` |
| GET | `/results/{resultId}` | PNG do resultado (expira em `TRYON_RESULT_TTL_SECONDS`) |
| DELETE | `/results/{resultId}` | remove o resultado |

Erros controlados (`{ code, message }`): `empty_file` 400 · `invalid_image` 400 · `image_too_small/large` 400 · `file_too_large` 413 · `unsupported_media_type/extension/format` 415 · `preprocessing_error` 422 · `busy` 429 (+`Retry-After`) · `model_not_loaded` / `cuda_unavailable` / `cuda_out_of_memory` 503 · `inference_error` 500.

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q          # unitários (sem GPU; runtime stub)
.\.venv\Scripts\python.exe scripts/test_tryon.py       # integração contra o serviço em execução
```

## Privacidade

- A foto da pessoa é processada em memória; não é gravada em disco pelo serviço. O DensePose oficial grava um PNG temporário em `TRYON_TEMP_PATH/densepose_/tmp` e o remove; o runtime varre restos após cada inferência.
- Logs são técnicos (tempos, dimensões, VRAM, códigos de erro) — nunca bytes, base64, nomes originais ou caminhos com dados pessoais.
- Nomes de arquivo enviados nunca são usados como caminho; resultados usam `uuid4` e expiram (TTL).

## Variáveis (`.env.example`)

`TRYON_DEVICE=cuda` · `TRYON_PRECISION=bf16` · `TRYON_MODEL_PATH` · `TRYON_OUTPUT_PATH` · `TRYON_TEMP_PATH` · `TRYON_MAX_CONCURRENT_JOBS=1` · `TRYON_QUEUE_WAIT_SECONDS=0` · `TRYON_MAX_UPLOAD_MB=8` · `TRYON_RESULT_TTL_SECONDS=900` · `TRYON_WIDTH/HEIGHT/NUM_INFERENCE_STEPS/GUIDANCE_SCALE/SEED`.

Detalhes, medições e desvios do `requirements.txt` oficial: `docs/implementation/ETAPA_05_CATVTON_LOCAL.md`.
