# `markm-thesis` — *Robust Composition* by chapter

Searchable Markdown extracted from Mark S. Miller’s PhD thesis, *Robust Composition: Towards a Unified Approach to Access Control and Concurrency Control* (Johns Hopkins University, May 2006). The **PDF is not stored in this repository**; these files are the canonical copy here.

Each `chapter-*.md` file states the **original PDF page numbers** in its `Source:` line so you can line up with an external PDF if you have one.

## Contents

| File | PDF pp. | Topic |
|------|---------|--------|
| `00-front-matter.md` | 1–18 | Title, abstract, TOC, etc. |
| `chapter-01-introduction.md` … `chapter-27-….md` | see each file | Main chapters |
| `99-bibliography.md` | 205–229 | Bibliography |

## Regenerating from a local PDF

Obtain the thesis PDF elsewhere, then:

```bash
python3 -m venv .venv && .venv/bin/pip install pypdf
.venv/bin/python notes/references/markm-thesis/extract.py /path/to/robust-composition.pdf
```

This overwrites all `00-*.md`, `chapter-*.md`, and `99-*.md` in this directory (not `README.md`).

**Canonical citation:** Mark Samuel Miller, *Robust Composition: Towards a Unified Approach to Access Control and Concurrency Control*, Johns Hopkins University, May 2006.
