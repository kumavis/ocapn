#!/usr/bin/env python3
"""Rebuild chapter Markdown from a local *Robust Composition* PDF (not kept in this repo)."""

from __future__ import annotations

import argparse
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader

SOURCE_LINE = (
    "Source: Mark S. Miller, *Robust Composition* "
    "(Johns Hopkins PhD thesis, 2006), PDF pp. {p0}–{p1}."
)


def dehyphenate(s: str) -> str:
    return re.sub(r"(\w)-\n(\w)", r"\1\2", s)


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return (s[:70] or "chapter").rstrip("-")


def page_text(reader: PdfReader, idx0: int) -> str:
    t = reader.pages[idx0].extract_text(extraction_mode="plain") or ""
    return dehyphenate(t).rstrip()


def chapter_heading_from_page_text(text: str) -> tuple[int, str] | None:
    m = re.match(r"\s*Chapter\s+(\d+)\s*\n\s*([^\n]+)", text, re.I)
    if not m:
        return None
    num = int(m.group(1))
    title = m.group(2).strip()
    rest = text[m.end() :]
    m2 = re.match(r"\s*\n([^\n]+)", rest)
    if m2:
        line2 = m2.group(1).strip()
        if (
            re.fullmatch(r"[A-Z][a-zA-Z'-]{1,24}", line2)
            and len(title) < 70
            and not title.endswith((":", ".", ";"))
        ):
            title = f"{title} {line2}"
    return num, title


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract chapter .md files from markm's thesis PDF into this directory."
    )
    parser.add_argument(
        "pdf",
        type=Path,
        help="Path to the Robust Composition PDF (e.g. a local download)",
    )
    args = parser.parse_args()

    thesis_dir = Path(__file__).resolve().parent
    pdf_path = args.pdf.expanduser().resolve()
    if not pdf_path.is_file():
        raise SystemExit(f"Not a file: {pdf_path}")

    reader = PdfReader(str(pdf_path))
    n = len(reader.pages)

    chapter_starts: list[tuple[int, int, str]] = []
    for i in range(n):
        t = reader.pages[i].extract_text() or ""
        parsed = chapter_heading_from_page_text(t)
        if parsed:
            num, title = parsed
            chapter_starts.append((i + 1, num, title))

    biblio_page: int | None = None
    for i in range(n):
        t = reader.pages[i].extract_text() or ""
        if re.match(r"\s*Bibliography\s*\n", t):
            biblio_page = i + 1
            break

    if not chapter_starts or biblio_page is None:
        raise SystemExit("Could not find chapters or bibliography in that PDF")

    for pattern in ("00-*.md", "chapter-*.md", "99-*.md"):
        for p in thesis_dir.glob(pattern):
            p.unlink()

    repo_root = thesis_dir.parent.parent.parent

    def write_md(name: str, title: str, p0: int, p1: int, body_pages: range) -> None:
        src = SOURCE_LINE.format(p0=p0, p1=p1)
        parts = [f"# {title}\n", "", src, "", "---", ""]
        for pi in body_pages:
            parts.append(page_text(reader, pi - 1))
            parts.append("")
        path = thesis_dir / name
        path.write_text("\n".join(parts).rstrip() + "\n", encoding="utf-8")
        print(path.relative_to(repo_root))

    first_chapter_pdf_page = chapter_starts[0][0]
    if first_chapter_pdf_page > 1:
        write_md(
            "00-front-matter.md",
            "Front matter",
            1,
            first_chapter_pdf_page - 1,
            range(1, first_chapter_pdf_page),
        )

    for j, (p0, num, title_line) in enumerate(chapter_starts):
        if j + 1 < len(chapter_starts):
            p1 = chapter_starts[j + 1][0] - 1
        else:
            p1 = biblio_page - 1
        slug = slugify(title_line)
        write_md(
            f"chapter-{num:02d}-{slug}.md",
            f"Chapter {num} — {title_line}",
            p0,
            p1,
            range(p0, p1 + 1),
        )

    write_md(
        "99-bibliography.md",
        "Bibliography",
        biblio_page,
        n,
        range(biblio_page, n + 1),
    )


if __name__ == "__main__":
    main()
