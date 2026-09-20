# Avatar 3D — origem e licença

Arquivo: `avatar_base.glb`

- Origem: [Male Base Mesh](https://orange-juice-games.itch.io/male-base-mesh) (orange-juice-games), repositório GitHub [BoQsc/Godot-3D-Male-Base-Mesh](https://github.com/BoQsc/Godot-3D-Male-Base-Mesh) (`Original/male_base_mesh.glb`).
- Tipo: mesh humano adulto em T-pose, low-poly, UV, armature Rigify (`metarig`: `spine.*`, `shoulder.L/R`, `pelvis.*`).
- Licença: **CC0 1.0 Universal** (domínio público). Texto integral em `LICENSE`.
- Uso: TCC / demonstração não comercial e comercial — CC0 permite ambos.
- Runtime: arquivo estático em `/models/avatar/avatar_base.glb`. Sem serviço externo, sem autenticação.

Para atualizar o asset:

```powershell
.\scripts\fetch_avatar_glb.ps1
```

Substituir por outro GLB humano: coloque o arquivo neste diretório com o mesmo nome, `placeholder: false` no `manifest.json`, e documente a licença aqui.
