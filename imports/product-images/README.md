# Importar fotos de produtos

Coloque aqui as imagens e rode:

```bash
python scripts/import_product_images.py
```

## Formato dos arquivos

**Opção A — arquivo com slug no nome:**

```text
camiseta-essential-algodao__1.jpg
camiseta-essential-algodao__2.jpg
camiseta-essential-algodao__3.jpg
```

**Opção B — pasta por produto:**

```text
camiseta-essential-algodao/
  frente.jpg
  costas.jpg
  detalhe.jpg
```

O slug deve corresponder ao produto no catálogo (ex.: `camiseta-essential-algodao`, `calca-jeans-skinny-stretch`).

A primeira imagem de cada grupo vira a **capa** do produto; as demais entram no carrossel.
