"""Gera PDFs a partir dos Markdown em docs/.

Uso (raiz do monorepo):

    pip install fpdf2
    python scripts/build_docs_pdf.py

Saída: docs/pdf/<arquivo>.pdf e docs/pdf/VESTE_AI_Documentacao_Completa.pdf
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    from fpdf import FPDF
except ImportError:
    print("Instale fpdf2:  pip install fpdf2")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = DOCS / "pdf"

WIN_FONTS = Path(r"C:\Windows\Fonts")
LINUX_FONTS = Path("/usr/share/fonts/truetype/dejavu")


def _font_pair() -> tuple[str, str, str | None, str | None]:
    candidates = [
        (WIN_FONTS / "arial.ttf", WIN_FONTS / "arialbd.ttf"),
        (WIN_FONTS / "ARIAL.TTF", WIN_FONTS / "ARIALBD.TTF"),
        (LINUX_FONTS / "DejaVuSans.ttf", LINUX_FONTS / "DejaVuSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if regular.exists():
            return str(regular), str(bold) if bold.exists() else str(regular), None, None
    return "", "", None, None


class Manual(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4")
        self.set_auto_page_break(auto=True, margin=18)
        regular, bold, *_ = _font_pair()
        if regular:
            self.add_font("Body", "", regular)
            self.add_font("Body", "B", bold or regular)
            self.font_name = "Body"
            mono = WIN_FONTS / "consola.ttf"
            if mono.exists():
                self.add_font("Mono", "", str(mono))
                self.mono_name = "Mono"
            else:
                self.mono_name = "Body"
        else:
            self.font_name = "Helvetica"
            self.mono_name = "Courier"
        self.set_title("VESTE.AI — Documentação do MVP")
        self.set_author("VESTE.AI · TCC Engenharia de Dados")

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font(self.font_name, "B", 9)
        self.set_text_color(196, 98, 58)
        self.cell(0, 8, "VESTE.AI", align="L")
        self.set_text_color(111, 107, 102)
        self.set_font(self.font_name, "", 8)
        self.cell(0, 8, "Documentação do MVP", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(233, 229, 223)
        self.line(10, 16, 200, 16)
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font(self.font_name, "", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, f"{self.page_no()}", align="C")

    def _reset_x(self) -> None:
        self.set_x(self.l_margin)

    def h1(self, text: str) -> None:
        self._reset_x()
        self.set_font(self.font_name, "B", 18)
        self.set_text_color(20, 20, 22)
        self.multi_cell(0, 9, text)
        self.ln(2)

    def h2(self, text: str) -> None:
        self.ln(2)
        self._reset_x()
        self.set_font(self.font_name, "B", 13)
        self.set_text_color(20, 20, 22)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def h3(self, text: str) -> None:
        self.ln(1)
        self._reset_x()
        self.set_font(self.font_name, "B", 11)
        self.set_text_color(42, 42, 46)
        self.multi_cell(0, 6, text)

    def paragraph(self, text: str) -> None:
        self._reset_x()
        self.set_font(self.font_name, "", 10)
        self.set_text_color(42, 42, 46)
        self.multi_cell(0, 5.4, _inline(text))
        self.ln(1.2)

    def bullet(self, text: str, ordered: str | None = None) -> None:
        self._reset_x()
        prefix = f"{ordered}. " if ordered else "• "
        self.set_font(self.font_name, "", 10)
        self.set_text_color(42, 42, 46)
        self.multi_cell(0, 5.2, prefix + _inline(text))

    def code(self, text: str) -> None:
        self._reset_x()
        self.set_fill_color(247, 244, 239)
        self.set_text_color(42, 42, 46)
        self.set_font(self.mono_name, "", 8)
        body = _ascii_boxes(text.rstrip()) if text.strip() else " "
        self.multi_cell(0, 4.4, body + "\n", fill=True)
        self.ln(1.5)

    def quote(self, text: str) -> None:
        self._reset_x()
        self.set_text_color(196, 98, 58)
        self.set_font(self.font_name, "", 10)
        self.multi_cell(0, 5.4, _inline(text))
        self.ln(1)

    def table(self, rows: list[list[str]]) -> None:
        if not rows:
            return
        usable = self.epw
        cols = max(len(r) for r in rows)
        widths = [usable / cols] * cols
        for i, row in enumerate(rows):
            self.set_font(self.font_name, "B" if i == 0 else "", 8)
            self.set_fill_color(233, 229, 223) if i == 0 else self.set_fill_color(255, 255, 255)
            self.set_text_color(20, 20, 22)
            height = 6
            x = self.get_x()
            y = self.get_y()
            max_h = height
            for j in range(cols):
                cell = (row[j] if j < len(row) else "") or " "
                # estima altura
                lines = self.multi_cell(widths[j], height, cell, dry_run=True, output="LINES")
                max_h = max(max_h, height * max(1, len(lines)))
            if y + max_h > self.page_break_trigger:
                self.add_page()
                y = self.get_y()
            for j in range(cols):
                cell = (row[j] if j < len(row) else "") or " "
                self.set_xy(x + sum(widths[:j]), y)
                self.multi_cell(widths[j], height, cell, border=1, fill=i == 0)
            self.set_xy(self.l_margin, y + max_h)
        self.ln(2)
        self._reset_x()


def _ascii_boxes(text: str) -> str:
    return (
        text.replace("│", "|")
        .replace("─", "-")
        .replace("├", "+")
        .replace("└", "+")
        .replace("┌", "+")
        .replace("┐", "+")
        .replace("┘", "+")
        .replace("┬", "+")
        .replace("┴", "+")
        .replace("┼", "+")
        .replace("▼", "v")
        .replace("▲", "^")
        .replace("►", ">")
        .replace("←", "<-")
        .replace("→", "->")
        .replace("↓", "v")
        .replace("↑", "^")
        .replace("≈", "~")
        .replace("—", "-")
        .replace("–", "-")
        .replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
    )


def _inline(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return _ascii_boxes(text)


def _split_table_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def render_markdown(pdf: Manual, markdown: str) -> None:
    lines = markdown.replace("\r\n", "\n").split("\n")
    i = 0
    in_code = False
    code_buf: list[str] = []
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            if in_code:
                pdf.code("\n".join(code_buf))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        if not line.strip():
            i += 1
            continue
        if line.startswith("# "):
            pdf.h1(line[2:].strip())
        elif line.startswith("## "):
            pdf.h2(line[3:].strip())
        elif line.startswith("### "):
            pdf.h3(line[4:].strip())
        elif line.startswith("> "):
            pdf.quote(line[2:].strip())
        elif line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*-+", lines[i + 1]):
            rows = [_split_table_row(line)]
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(_split_table_row(lines[i]))
                i += 1
            pdf.table(rows)
            continue
        elif re.match(r"^\d+\.\s", line):
            num, rest = line.split(".", 1)
            pdf.bullet(rest.strip(), ordered=num)
        elif re.match(r"^\s*[-*]\s", line):
            pdf.bullet(re.sub(r"^\s*[-*]\s+", "", line))
        elif line.strip() == "---":
            pdf.ln(1)
        else:
            pdf.paragraph(line.strip())
        i += 1


def build_one(path: Path, dest: Path) -> None:
    pdf = Manual()
    pdf.add_page()
    render_markdown(pdf, path.read_text(encoding="utf-8"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(dest))


def main() -> int:
    files = sorted(DOCS.glob("*.md"))
    if not files:
        print("Nenhum Markdown em docs/")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)

    combined = Manual()
    combined.add_page()
    combined.h1("VESTE.AI")
    combined.paragraph("Documentação completa do MVP — plataforma de recomendação de tamanho e estimativa de caimento.")
    combined.paragraph("TCC Engenharia de Dados · FIAP · 2026 · Allan · Jhony · Aécio")

    for path in files:
        dest = OUT / f"{path.stem}.pdf"
        build_one(path, dest)
        print(f"ok  {dest.relative_to(ROOT)}")
        combined.add_page()
        render_markdown(combined, path.read_text(encoding="utf-8"))

    volume = OUT / "VESTE_AI_Documentacao_Completa.pdf"
    combined.output(str(volume))
    print(f"ok  {volume.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
