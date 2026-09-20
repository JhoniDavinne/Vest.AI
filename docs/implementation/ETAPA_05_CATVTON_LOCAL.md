# ETAPA 05 — CatVTON local (GPU NVIDIA)

Fontes: `docs/VIRTUAL_FITTING_ARCHITECTURE.md`, `docs/implementation/ETAPA_02..04`.
Branch: `feature/virtual-fitting`. Data da execução: 2026-09-20.

## Objetivo e escopo

Fazer o CatVTON **oficial** gerar imagens localmente em GPU (RTX 5070) e expor um serviço HTTP local isolado (`apps/tryon`), sem integrar ao frontend nem à API VESTE.AI (`apps/api` e `RecommendationEngine` intocados). Sem cloud, sem Docker GPU, sem persistência em PostgreSQL.

## Status final

**ETAPA 5 CONCLUÍDA.** Todos os critérios obrigatórios atendidos:

| Critério | Resultado |
|---|---|
| 1. CUDA ativa | PASS — `torch.cuda.is_available() == True`, CUDA 12.8 |
| 2. RTX 5070 detectada pelo PyTorch | PASS — `NVIDIA GeForce RTX 5070`, compute capability (12,0), `sm_120` no `arch_list` |
| 3. Modelo CatVTON carrega | PASS — 7,3 s com cache quente (244,7 s na primeira vez, incluindo download) |
| 4. person + garment → imagem | PASS — `output/result_original_1.png` (768×1024, bf16, 50 passos) |
| 5. `/health` | PASS |
| 6. `/try-on` | PASS — 2 gerações reais via HTTP |
| 7. 2ª inferência reutiliza o modelo | PASS — `modelLoaded` permanece `true`; 36,8 s → 36,3 s (sem reload) |

## 1. Fonte oficial consultada

Repositório: `https://github.com/Zheng-Chong/CatVTON` (autor Zheng Chong; ICLR 2025). Arquivos analisados: `README.md`, `INSTALL.md`, `requirements.txt`, `app.py`, `inference.py`, `utils.py`, `model/pipeline.py`, `model/cloth_masker.py`, `model/DensePose/__init__.py`, `LICENSE`, listagem de `model/` e raiz.

| Item | Registro |
|---|---|
| Branch padrão | **`edited`** (o `main` parou em 2024-08-13; o `edited` tem CatVTON-FLUX, MaskFree e correções de requirements) |
| Commit utilizado | `7818397f25613beedb3d861a34769f607cfcf3b1` — "Merge pull request #132 … Fix huggingface_hub and peft version constraints" (2025-12-16) |
| Python recomendado | 3.9.0 (`conda create -n catvton python==3.9.0`) |
| PyTorch oficial | `torch==2.4.0`, `torchvision==0.19.0` (branch `edited`; o `main` antigo pinava 2.1.2) |
| CUDA | não pinada no requirements; INSTALL.md pede alinhar o build do PyTorch à CUDA do sistema |
| Precisão | `--mixed_precision` ∈ `no|fp16|bf16`; app.py default **bf16**; README: "bf16 a 1024×768 requer ~8 GB de VRAM" |
| Download de checkpoints | `huggingface_hub.snapshot_download("zhengchong/CatVTON")` (atenção treinada `mix-48k-1024`, `DensePose/`, `SCHP/`) + `diffusers.from_pretrained("booksforcharlie/stable-diffusion-inpainting")` (cópia do runwayml removido) + `stabilityai/sd-vae-ft-mse` |
| VRAM | < 8 GB a 1024×768 em bf16 (documentado) |
| Máscara automática | oficial: `AutoMasker` = DensePose (R_50_FPN_s1x) + SCHP (ATR + LIP); `detectron2` e `densepose` **vendorizados** no repo desde 2024-08-13 ("localize DensePose & SCHP") — sem compilar `_C` (import lazy só em deform conv) |
| **Licença** | **CC BY-NC-SA 4.0 — uso não comercial** (código, checkpoints e demo). HF `zhengchong/CatVTON`: `license: cc-by-nc-sa-4.0`, não-gated |

Dependências oficiais (`edited`): accelerate 0.31.0 · diffusers (git HEAD) · matplotlib 3.9.1 · numpy 1.26.4 · opencv_python 4.10.0.84 · pillow 10.3.0 · PyYAML 6.0.1 · scipy 1.13.1 · setuptools 51.0.0 · scikit-image 0.24.0 · tqdm 4.66.4 · transformers 4.46.3 · fvcore · cloudpickle 3.0.0 · omegaconf 2.3.0 · pycocotools 2.0.8 · av 12.3.0 · gradio 4.41.0 · peft ≥ 0.17.0 · huggingface_hub ≥ 0.34,<2.0.

## 2. Estrutura criada

```text
apps/tryon/
├── README.md                    instalação, execução, endpoints, privacidade
├── requirements.txt             pins oficiais + desvios documentados + FastAPI
├── .env.example                 variáveis TRYON_*
├── service/
│   ├── main.py                  FastAPI: /health, /try-on, /results/{id}
│   ├── settings.py              pydantic-settings (prefixo TRYON_)
│   ├── catvton_runtime.py       CatVTONRuntime (load único, slots, OOM, cleanup)
│   ├── images.py                validação/normalização de uploads
│   ├── results.py               ResultStore (uuid + TTL)
│   └── schemas.py               HealthResponse, TryOnResponse, ErrorResponse
├── scripts/
│   ├── fetch_catvton.ps1        clone/pin do vendor
│   ├── run_original_once.py     geração com o CatVTON original (sem HTTP)
│   └── test_tryon.py            integração contra o serviço
├── tests/test_service_unit.py   14 testes sem GPU (runtime stub)
├── vendor/CatVTON/              clone oficial pinado  (gitignored)
└── output/                      resultados dos scripts (gitignored)
```

`.gitignore` (raiz): `apps/tryon/.venv`, `apps/tryon/vendor/CatVTON`, `apps/tryon/models`, `apps/tryon/output`, `apps/tryon/tmp`, `apps/tryon/densepose_`. Checkpoints e cache HF ficam em `%LOCALAPPDATA%\veste-ai\tryon\models` (fora do repo e do OneDrive). Nenhum checkpoint commitado.

## 3. Ambiente

| Item | Valor |
|---|---|
| SO | Windows 11 (build 10.0.26200) |
| GPU | NVIDIA GeForce RTX 5070, 12 227 MiB, WDDM |
| Driver NVIDIA | 616.64 · `nvidia-smi` reporta CUDA UMD 13.4 |
| Python (CatVTON) | **3.12.10** — instalado com `pymanager install 3.12` (Python Install Manager já presente); a máquina só tinha 3.14 (sem wheels para numpy 1.26/transformers 4.46). venv em `apps/tryon/.venv` |
| Python (API VESTE.AI) | 3.14 em `apps/api/.venv` — **intocado** |
| PyTorch | `2.7.1+cu128` · torchvision `0.22.1+cu128` |
| CUDA (torch) | 12.8 · `arch_list` inclui `sm_120` |
| bf16 | suportado (`torch.cuda.is_bf16_supported() == True`; matmul bf16 OK) |

### Compatibilidade RTX 50 (Blackwell, sm_120)

`torch==2.4.0` (pin oficial) não possui kernels para `sm_120` → falharia com "no kernel image is available". Escolhida a **primeira série estável com suporte a Blackwell** (2.7.x) em build CUDA 12.8, mantendo o resto do requirements oficial. Verificação feita antes de qualquer inferência (`run_original_once.py::require_cuda` e `CatVTONRuntime.require_cuda`): se `sm_XY` da GPU não estiver em `torch.cuda.get_arch_list()`, o processo para com erro explícito.

## 4. Desvios em relação ao `requirements.txt` oficial

| Pacote | Oficial | Usado | Motivo |
|---|---|---|---|
| torch / torchvision | 2.4.0 / 0.19.0 | **2.7.1+cu128 / 0.22.1+cu128** | suporte a sm_120 (RTX 5070) |
| accelerate | 0.31.0 | **0.33.0** | `peft>=0.17` (pin oficial) importa `accelerate.utils.memory.clear_device_cache`, inexistente em 0.31 → os pins oficiais são mutuamente incompatíveis; 0.33.0 é a menor versão que resolve (testadas 0.33.0 → OK) |
| peft | ≥ 0.17.0 | **0.17.0** (pin exato) | reprodutibilidade |
| diffusers | `git+…diffusers.git` (HEAD) | **0.32.2** | HEAD não é reproduzível; release estável contemporânea ao commit |
| opencv | `opencv_python` 4.10.0.84 | `opencv-python-headless` 4.10.0.84 | mesma versão, sem dependências de GUI |
| gradio, setuptools==51 | presentes | **não instalados** | não usados pelo serviço; setuptools 51 é incompatível com Python 3.12 |
| av | 12.3.0 | 12.3.0 | mantido — o `detectron2` vendorizado importa `av` no import |
| Adicionados | — | fastapi 0.141, uvicorn 0.53, python-multipart, pydantic-settings, httpx, pytest | serviço e testes |

Nenhuma alteração foi feita no código vendorizado do CatVTON.

## 5. Instalação executada

```powershell
pymanager install 3.12
git clone https://github.com/Zheng-Chong/CatVTON.git apps/tryon/vendor/CatVTON && git checkout 7818397f…
py -3.12 -m venv apps/tryon/.venv
apps/tryon/.venv/Scripts/python -m pip install -r apps/tryon/requirements.txt   # torch cu128 ≈ 3,3 GB
```

Checkpoints baixados automaticamente na primeira execução (mecanismo oficial): `models--zhengchong--CatVTON` (rev `2969fcf8…`), `models--booksforcharlie--stable-diffusion-inpainting`, `models--stabilityai--sd-vae-ft-mse` — **6,0 GB** em `%LOCALAPPDATA%\veste-ai\tryon\models\hub`.

## 6. Validação de GPU (antes da inferência)

```text
nvidia-smi: NVIDIA-SMI 616.64 · CUDA UMD 13.4 · RTX 5070 · 12227 MiB
python --version: Python 3.12.10
torch 2.7.1+cu128 · torch.version.cuda 12.8 · cuda.is_available True · NVIDIA GeForce RTX 5070
capability (12, 0) · arch_list [... 'sm_100', 'sm_120'] · bf16 True
```

## 7. Primeira geração — CatVTON original (`scripts/run_original_once.py`)

Entradas (exemplos públicos do repositório oficial): `resource/demo/example/person/men/model_5.png` + `resource/demo/example/condition/upper/21514384_52353349_1000.jpg`, `cloth_type=upper`. Pipeline idêntico ao `app.py` oficial: `resize_and_crop`/`resize_and_padding` → `AutoMasker` → `VaeImageProcessor.blur(9)` → `CatVTONPipeline(attn "mix")` → SafetyChecker.

| Métrica | Run 1 | Run 2 |
|---|---|---|
| Resolução | 768×1024 | 768×1024 |
| Precisão | bf16 | bf16 |
| Passos / CFG / seed | 50 / 2.5 / 42 | 50 / 2.5 / 42 |
| Máscara (DensePose+SCHP) | 1,07 s | 0,46 s |
| Inferência (difusão + VAE + safety) | **35,66 s** | **35,52 s** |
| Pico VRAM alocada / reservada | **5 003 MiB / 7 128 MiB** | 5 003 / 7 128 MiB |
| VRAM após load | 3 162 MiB | — |
| Carga do modelo | 244,7 s (1ª vez, com download) · 7,3 s (cache quente) | — |

Resultado inspecionado visualmente (`output/contact_sheet_original.png`): cardigã aplicado corretamente sobre o torso, rosto/mãos/calça preservados, máscara coerente com `upper`. **PASS.**

## 8. Serviço local (`service/`)

### Carregamento do modelo
`CatVTONRuntime.load()` executa uma vez no `lifespan` do FastAPI (em threadpool): `snapshot_download` → `CatVTONPipeline` → `AutoMasker` → `VaeImageProcessor`; define `HF_HOME`, `sys.path` (vendor) e `chdir(TRYON_TEMP_PATH)` (o DensePose oficial grava temporários em `./densepose_/tmp`). Requisições reutilizam o objeto; **nenhum checkpoint é recarregado por request**. Sem CUDA, `require_cuda()` lança `cuda_unavailable` e o processo **aborta** (salvo `TRYON_ALLOW_START_WITHOUT_GPU=true`, usado só em testes unitários).

### Endpoints
- `GET /health` → `{status, device, cudaAvailable, gpu, torchVersion, cudaVersion, precision, modelLoaded, busy, maxConcurrentJobs, resolution, vramAllocatedMiB, vramReservedMiB, lastError, license}`. Sem caminhos.
- `POST /try-on` (multipart `person`, `garment`, `cloth_type`, opcionais `steps` 10–100, `guidance_scale` 0–7.5, `seed`) → `{status:"completed", resultId, resultUrl, processingTimeMs, maskTimeMs, width, height, precision, clothType, steps, guidanceScale, seed, peakVramMiB, expiresAt, disclaimer}`.
- `GET /results/{resultId}` → PNG (`Cache-Control: private, no-store`); `DELETE /results/{resultId}` → 204.

### Validação de imagens (`images.py`)
MIME ∈ {jpeg, png, webp}; extensão ∈ {.jpg, .jpeg, .png, .webp}; formato real (Pillow `verify` + reopen) ∈ {JPEG, PNG, WEBP}; vazio → 400; > `TRYON_MAX_UPLOAD_MB` (8) → 413 (leitura limitada a `max+1` bytes); menor lado < 256 ou maior lado > 4096 → 400; EXIF normalizado (`exif_transpose`), conversão RGB. Nome original nunca vira caminho.

### Concorrência
`threading.BoundedSemaphore(TRYON_MAX_CONCURRENT_JOBS=1)`; `TRYON_QUEUE_WAIT_SECONDS=0` → segunda requisição simultânea recebe **429 `busy`** com `Retry-After: 5` (configurável para fila curta). Inferência roda em threadpool para não bloquear o event loop.

### OOM e erros
`torch.cuda.OutOfMemoryError` capturado separadamente na máscara e na difusão → `gc.collect()` + `torch.cuda.empty_cache()` → **503 `cuda_out_of_memory`**; slot liberado em `finally`; serviço permanece vivo. Demais: `model_not_loaded`/`cuda_unavailable` 503, `preprocessing_error` 422, `inference_error` 500, erros de imagem 400/413/415. Logs técnicos apenas (tipo do erro, tempos, VRAM).

### Privacidade
Foto da pessoa só em memória; temporários do DensePose removidos após cada inferência (`_cleanup_temp`) — verificado vazio ao fim dos testes; resultados com `uuid4` + TTL 900 s (sweep por requisição); nenhum log de bytes/base64/nomes.

## 9. Testes executados

| Teste | Comando | Resultado |
|---|---|---|
| Import + detecção CUDA | `python -c "import torch; …"` | PASS (seção 6) |
| Carregamento do modelo | `run_original_once.py` / startup do serviço | PASS (244,7 s frio · 7,3 s quente) |
| Inferência original (2×) | `run_original_once.py --repeat 2` | PASS (35,7 s / 35,5 s) |
| Unitários sem GPU (validação, 400/413/415/422, 503 model_not_loaded/cuda_unavailable, OOM controlado, concorrência 200+429, TTL, path traversal em resultId, DELETE 204) | `pytest tests -q` | **14 passed** |
| `/health` | `scripts/test_tryon.py` | PASS |
| `/try-on` #1 | idem | PASS — 36,7 s, `peakVramMiB` 5003,4, PNG 768×1024 válido |
| `/try-on` #2 sem reload | idem | PASS — 36,3 s; `modelLoaded` continua `true` |
| Arquivo vazio / imagem inválida / MIME não suportado / resultId inválido | idem | PASS — 400 `empty_file`, 400 `invalid_image`, 415, 404 |
| Concorrência (2 requisições, `MAX_CONCURRENT_JOBS=1`) | idem | PASS — `[200, 429]` |
| Limpeza de temporários DensePose | inspeção de `TRYON_TEMP_PATH` | PASS (vazio) |

Relatórios: `apps/tryon/output/run_original_report.json`, `apps/tryon/output/service_test_report.json`.

## 10. Erros encontrados e correções

| Erro | Causa | Correção |
|---|---|---|
| `ModuleNotFoundError: av` | `detectron2` vendorizado importa `av` | reincluído `av==12.3.0` (pin oficial) |
| `ImportError: clear_device_cache` (peft ↔ accelerate) | pins oficiais incompatíveis entre si | `accelerate==0.33.0` (menor versão compatível), `peft==0.17.0` |
| `OSError [WinError 1314]` ao criar symlink no cache HF | cache dentro do OneDrive sem privilégio de symlink | cache movido para `%LOCALAPPDATA%\veste-ai\tryon\models` (também evita sincronizar 6 GB) |
| `RuntimeError: Response content longer than Content-Length` em `DELETE /results` | `JSONResponse(204, content=None)` serializa `null` | `Response(status_code=204)` |
| Aviso diffusers "does not appear to have … safetensors. Defaulting to unsafe serialization" | a cópia `booksforcharlie/stable-diffusion-inpainting` publica pesos `.bin` (pickle) — comportamento do default oficial | registrado como risco (ver limitações); nenhum ajuste |

## 11. Comandos

```powershell
# serviço
cd apps/tryon
.\.venv\Scripts\python.exe -m uvicorn service.main:app --host 127.0.0.1 --port 8100
# geração original
.\.venv\Scripts\python.exe scripts/run_original_once.py --repeat 2
# testes
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe scripts/test_tryon.py
```

## 12. Limitações

- **Licença CC BY-NC-SA 4.0**: uso não comercial; inviável em produção B2B sem outro modelo/licença.
- Tempo por imagem ≈ **36 s** (768×1024, bf16, 50 passos, CFG 2.5 → 2 forwards/passo em latente concatenado 2048×768). Acima do esperado para a GPU; suspeitos: WDDM/GPU compartilhada com o desktop (≈1,4 GB e ~7 % de uso por outros processos durante os testes), ausência de `torch.compile`/xformers. Não otimizado nesta etapa (fora do escopo).
- Base model via cópia comunitária (`booksforcharlie/...`) com pesos `.bin` (pickle) — o original `runwayml` foi removido do HF. Mesmo default do `app.py` oficial.
- Sem fila persistente: `MAX_CONCURRENT_JOBS=1` e `busy` imediato.
- Ambiente validado apenas em Windows 11 + RTX 5070; Python 3.12 (não o 3.9 oficial).
- Temporários do DensePose passam pelo disco (comportamento do código oficial); mitigado por limpeza imediata e diretório local não sincronizado.

## 13. Pendências (próxima etapa: Integração VESTE.AI ↔ CatVTON)

- Rota/serviço na API VESTE.AI (`routes/tryon.py`, `tryon_service.py`, `TryOnJob` só com metadados), consentimento VTO explícito, `Product.flat_image_url`.
- Seção no `result-view.tsx` ("Provador com foto — experimental"), fora do widget.
- Autenticação mínima de consumidor antes de expor em ambiente compartilhado.
- Docker GPU (perfil opcional) e investigação do tempo de inferência.
