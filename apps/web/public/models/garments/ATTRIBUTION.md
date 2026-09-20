# Camiseta 3D — origem e licença

Arquivo: `tshirt_basic.glb`

- Origem: geometria **original** gerada por `scripts/generate_tshirt_glb.py` (projeto VESTE.AI / TCC FIAP).
- Não é um cubo placeholder: torso + mangas em T-pose, unidades métricas, eixo Y para cima, mangas no eixo Z (mesmo do `avatar_base.glb`).
- Licença: **CC0 1.0 Universal**. Texto em `LICENSE`.
- Motivo: não foi encontrado um GLB isolado de camiseta básica com download direto, licença CC0/equivalente verificável e redistribuição clara para o repositório acadêmico (packs Quaternius/Kenney ou exigem zip enorme/itch, ou a licença não estava explícita no arquivo isolado).
- Runtime: `/models/garments/tshirt_basic.glb`. Sem API, sem autenticação.

Regenerar:

```powershell
python scripts/generate_tshirt_glb.py
```

Substituir por um GLB de terceiro: coloque o arquivo neste diretório com o mesmo nome, `placeholder: false` no `manifest.json`, e documente origem/licença aqui.
