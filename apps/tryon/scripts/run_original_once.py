"""Primeira geracao com o CatVTON ORIGINAL (vendor/CatVTON), sem servico HTTP.

    person.jpg + garment.jpg -> CatVTON (AutoMasker oficial + CatVTONPipeline) -> result.png

Uso (no venv de apps/tryon):
    python scripts/run_original_once.py [--person P] [--garment G] [--cloth-type upper] [--precision bf16]

Regras desta etapa:
  * CUDA obrigatoria: se torch.cuda.is_available() for False, o script PARA (nao cai para CPU).
  * Checkpoints baixados pelo mecanismo oficial (huggingface_hub.snapshot_download / from_pretrained)
    para o cache local definido em MODEL_PATH (gitignored).
  * Imagens de exemplo: as do proprio repositorio oficial (resource/demo/example), nao sensiveis.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1]
VENDOR = APP_ROOT / "vendor" / "CatVTON"
# Padrao FORA do OneDrive: cache HF de varios GB nao deve ser sincronizado e symlinks do cache
# falham em pastas OneDrive sem privilegio (WinError 1314).
LOCAL_DATA = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "veste-ai" / "tryon"
MODEL_PATH = Path(os.environ.get("TRYON_MODEL_PATH", LOCAL_DATA / "models"))
OUTPUT_PATH = Path(os.environ.get("TRYON_OUTPUT_PATH", APP_ROOT / "output"))
TEMP_PATH = Path(os.environ.get("TRYON_TEMP_PATH", LOCAL_DATA / "tmp"))

# Cache HF local (nunca commitado). Precisa ser definido ANTES de importar huggingface_hub.
os.environ.setdefault("HF_HOME", str(MODEL_PATH))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

sys.path.insert(0, str(VENDOR))

import torch  # noqa: E402
from diffusers.image_processor import VaeImageProcessor  # noqa: E402
from huggingface_hub import snapshot_download  # noqa: E402
from PIL import Image  # noqa: E402

from model.cloth_masker import AutoMasker  # noqa: E402
from model.pipeline import CatVTONPipeline  # noqa: E402
from utils import init_weight_dtype, resize_and_crop, resize_and_padding  # noqa: E402

BASE_MODEL = "booksforcharlie/stable-diffusion-inpainting"  # mesmo default do app.py oficial (edited)
ATTN_REPO = "zhengchong/CatVTON"


def parse_args() -> argparse.Namespace:
    examples = VENDOR / "resource" / "demo" / "example"
    # Exemplos publicos do repositorio oficial (person: PNG; condition: JPG).
    default_person = str(examples / "person" / "men" / "model_5.png")
    default_garment = str(sorted((examples / "condition" / "upper").glob("*.jpg"))[0])
    p = argparse.ArgumentParser()
    p.add_argument("--person", default=str(default_person))
    p.add_argument("--garment", default=str(default_garment))
    p.add_argument("--cloth-type", default="upper", choices=["upper", "lower", "overall"])
    p.add_argument("--precision", default="bf16", choices=["no", "fp16", "bf16"])
    p.add_argument("--width", type=int, default=768)
    p.add_argument("--height", type=int, default=1024)
    p.add_argument("--steps", type=int, default=50)
    p.add_argument("--guidance", type=float, default=2.5)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--repeat", type=int, default=1, help="Repete a inferencia N vezes (mede reuso do modelo)")
    return p.parse_args()


def require_cuda() -> None:
    print(f"torch={torch.__version__} cuda={torch.version.cuda} available={torch.cuda.is_available()}")
    if not torch.cuda.is_available():
        print("ERRO: torch.cuda.is_available() == False. Inferencia interrompida (sem fallback para CPU).")
        sys.exit(2)
    name = torch.cuda.get_device_name(0)
    cap = torch.cuda.get_device_capability(0)
    print(f"gpu={name} capability={cap} arch_list={torch.cuda.get_arch_list()}")
    if f"sm_{cap[0]}{cap[1]}" not in torch.cuda.get_arch_list():
        print("ERRO: o build do PyTorch nao possui kernels para esta GPU.")
        sys.exit(3)


def mib(value: int) -> float:
    return round(value / (1024 * 1024), 1)


def main() -> None:
    args = parse_args()
    require_cuda()
    for path in (MODEL_PATH, OUTPUT_PATH, TEMP_PATH):
        path.mkdir(parents=True, exist_ok=True)
    # DensePose oficial escreve em ./densepose_/tmp relativo ao CWD.
    os.chdir(TEMP_PATH)

    weight_dtype = init_weight_dtype(args.precision)
    if args.precision == "bf16" and not torch.cuda.is_bf16_supported():
        print("ERRO: bf16 nao suportado por esta GPU/PyTorch.")
        sys.exit(4)

    t0 = time.perf_counter()
    repo_path = snapshot_download(repo_id=ATTN_REPO)
    t_download = time.perf_counter() - t0
    print(f"checkpoints CatVTON prontos ({t_download:.1f}s)")

    t0 = time.perf_counter()
    pipeline = CatVTONPipeline(
        base_ckpt=BASE_MODEL,
        attn_ckpt=repo_path,
        attn_ckpt_version="mix",
        weight_dtype=weight_dtype,
        use_tf32=True,
        device="cuda",
    )
    automasker = AutoMasker(
        densepose_ckpt=os.path.join(repo_path, "DensePose"),
        schp_ckpt=os.path.join(repo_path, "SCHP"),
        device="cuda",
    )
    mask_processor = VaeImageProcessor(vae_scale_factor=8, do_normalize=False, do_binarize=True, do_convert_grayscale=True)
    t_load = time.perf_counter() - t0
    torch.cuda.synchronize()
    print(f"modelo carregado em {t_load:.1f}s · VRAM alocada apos load: {mib(torch.cuda.memory_allocated())} MiB")

    person = Image.open(args.person).convert("RGB")
    garment = Image.open(args.garment).convert("RGB")
    person = resize_and_crop(person, (args.width, args.height))
    garment = resize_and_padding(garment, (args.width, args.height))

    report: list[dict] = []
    for run in range(args.repeat):
        torch.cuda.reset_peak_memory_stats()
        generator = torch.Generator(device="cuda").manual_seed(args.seed)
        t0 = time.perf_counter()
        mask = automasker(person, args.cloth_type)["mask"]
        mask = mask_processor.blur(mask, blur_factor=9)
        t_mask = time.perf_counter() - t0

        t0 = time.perf_counter()
        result = pipeline(
            image=person,
            condition_image=garment,
            mask=mask,
            num_inference_steps=args.steps,
            guidance_scale=args.guidance,
            height=args.height,
            width=args.width,
            generator=generator,
        )[0]
        torch.cuda.synchronize()
        t_infer = time.perf_counter() - t0

        out = OUTPUT_PATH / f"result_original_{run + 1}.png"
        result.save(out)
        mask.save(OUTPUT_PATH / f"mask_original_{run + 1}.png")
        entry = {
            "run": run + 1,
            "resolution": f"{args.width}x{args.height}",
            "precision": args.precision,
            "steps": args.steps,
            "mask_seconds": round(t_mask, 2),
            "inference_seconds": round(t_infer, 2),
            "peak_vram_allocated_mib": mib(torch.cuda.max_memory_allocated()),
            "peak_vram_reserved_mib": mib(torch.cuda.max_memory_reserved()),
            "output": str(out),
        }
        report.append(entry)
        print(json.dumps(entry, ensure_ascii=False))

    (OUTPUT_PATH / "run_original_report.json").write_text(
        json.dumps({"load_seconds": round(t_load, 1), "runs": report}, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print("OK")


if __name__ == "__main__":
    main()
