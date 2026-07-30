"""Corpus loader — walks `data/`, reads each Markdown document, and POSTs it
to /ingest with a sensible `source` and its front-matter metadata attached.

This exists because doing this by hand, one curl per document, is the point
at which Assignment 3 (Part 4) tells you to write a loader instead. Run it
after the backend is up and Qdrant is reachable:

    uv run python scripts/ingest_corpus.py
    uv run python scripts/ingest_corpus.py --data-dir ../../data --strategy dynamic
    uv run python scripts/ingest_corpus.py --reset   # wipe the collection first

Each file must start with a YAML front matter block:

    ---
    title: Card blocking and unblocking
    product: cards
    audience: retail
    effective: 2026-01-15
    version: 3
    ---

    The body text follows here...

The `source` sent to /ingest is the filename stem (e.g. "05-early-repayment-
fees-2026"), so re-running this script re-ingests every document under a
stable source label — combined with the stable-chunk-id improvement in
vectorstore.py, that means re-running this loader replaces each document's
chunks instead of duplicating them.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests

FRONT_MATTER_DELIM = "---"


def parse_front_matter(raw: str) -> tuple[dict, str]:
    """Split a tiny, deliberately simple YAML front matter block from the body.

    This is NOT a general YAML parser — it only handles the flat
    `key: value` shape used in this corpus, on purpose: pulling in a real
    YAML library for four fields would be more dependency than the task
    needs. If a document's front matter gets more complex than this, that is
    the signal to switch to PyYAML.
    """
    lines = raw.splitlines()
    if not lines or lines[0].strip() != FRONT_MATTER_DELIM:
        return {}, raw

    meta: dict[str, str] = {}
    body_start = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == FRONT_MATTER_DELIM:
            body_start = i + 1
            break
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()

    if body_start is None:
        # Opened a front matter block but never closed it — treat the whole
        # file as body text rather than silently dropping content.
        return {}, raw

    body = "\n".join(lines[body_start:]).strip()
    return meta, body


def load_documents(data_dir: Path) -> list[tuple[str, dict, str]]:
    """Return (source, metadata, body) for every .md file directly in data_dir."""
    docs = []
    for path in sorted(data_dir.glob("*.md")):
        if path.name.lower() in ("readme.md", "questions.md"):
            continue  # documentation/eval material about the corpus, not part of it
        raw = path.read_text(encoding="utf-8")
        meta, body = parse_front_matter(raw)
        if not body.strip():
            print(f"  skip {path.name}: no body text after front matter", file=sys.stderr)
            continue
        source = path.stem  # e.g. "05-early-repayment-fees-2026"
        docs.append((source, meta, body))
    return docs


def ingest_one(base_url: str, source: str, meta: dict, body: str, strategy: str) -> dict:
    payload = {
        "text": body,
        "strategy": strategy,
        "source": source,
        "title": meta.get("title"),
        "product": meta.get("product"),
        "audience": meta.get("audience"),
        "effective": meta.get("effective"),
        "version": int(meta["version"]) if meta.get("version", "").isdigit() else None,
    }
    resp = requests.post(f"{base_url}/ingest", json=payload, timeout=60)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", default="../../data", help="Path to the data/ folder (default: ../../data, i.e. repo root's data/ from code/backend/scripts/)")
    parser.add_argument("--base-url", default="http://localhost:7799", help="Backend URL")
    parser.add_argument("--strategy", default="dynamic", choices=["static", "sentence", "dynamic", "semantic"])
    parser.add_argument("--reset", action="store_true", help="DELETE /collection before ingesting")
    args = parser.parse_args()

    data_dir = Path(args.data_dir).resolve()
    if not data_dir.is_dir():
        print(f"error: {data_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.reset:
        print("resetting collection...")
        r = requests.delete(f"{args.base_url}/collection", timeout=30)
        r.raise_for_status()
        print(f"  {r.json()}")

    docs = load_documents(data_dir)
    if not docs:
        print(f"error: no .md documents found in {data_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"found {len(docs)} documents in {data_dir}\n")
    total_chunks = 0
    for source, meta, body in docs:
        result = ingest_one(args.base_url, source, meta, body, args.strategy)
        total_chunks += result["count"]
        title = meta.get("title", source)
        print(f"  [{result['count']:>2} chunks] {source:<40} {title}")

    print(f"\ndone — {len(docs)} documents, {total_chunks} chunks ingested with strategy '{args.strategy}'")


if __name__ == "__main__":
    main()
