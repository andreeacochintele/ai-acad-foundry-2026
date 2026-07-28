# Assignment 3 — Notes

## Part 4 — Ingestion improvements

**Loader script:** `code/backend/scripts/ingest_corpus.py` — walks `data/`,
parses each document's YAML front matter, and POSTs it to `/ingest` with a
stable `source` (the filename stem) and its metadata attached.

**Improvement #1 — Stable chunk IDs** (`app/vectorstore.py`, `upsert()`)

Before: every chunk got a fresh `uuid.uuid4()` on every ingest call, so
re-ingesting the same document duplicated its chunks in the collection.

After: the point id is derived deterministically —
`uuid.uuid5(NAMESPACE_URL, f"{source}:{index}")` — so re-ingesting the same
document overwrites its existing points instead of adding new ones.

*Before/after, measured:*
- Ran `ingest_corpus.py --reset` once → `GET /collection` → `points_count: 56`.
- Ran `ingest_corpus.py` again (no reset, same 16 documents) →
  `GET /collection` → `points_count: 56` — unchanged. Under the old
  `uuid4()` scheme this would have gone to 112.

**Improvement #2 — Real metadata** (`app/schemas.py`, `app/vectorstore.py`,
`app/main.py`)

Before: `/ingest` only stored `text`, `index`, `strategy`, `source`,
`ingested_at` on each chunk's payload — nothing from the document's own
front matter (title, product, effective date, version) survived past
ingestion.

After: `IngestRequest` accepts `title`, `product`, `audience`, `effective`,
`version`; they're stored on every chunk's payload and returned on every
`SearchHit`, so a search result now shows which document and version it
came from, not just raw text.

*Before/after, measured — the 2025 vs. 2026 fee schedule pair:*

Query: `"early repayment fee?"`, `top_k: 3`, after ingesting both documents.

| Rank | Score | Source | `effective` (now visible) |
|---|---|---|---|
| 1 | 0.7097 | `05-early-repayment-fees-2026` | 2026-01-15 (current) |
| 2 | 0.7069 | `04-early-repayment-fees-2025` | 2025-01-10 (superseded) |
| 3 | 0.6521 | `04-early-repayment-fees-2025` | 2025-01-10 (superseded) |

The score gap between the current and the superseded document is **0.0028**
— nearly indistinguishable by similarity alone. Before this improvement,
there was no `effective` field to tell them apart at all; a reviewer (or a
future filtering step) had to read the chunk text itself to know which one
was current. This is the exact scenario Part 5's metadata-filtering
improvement is meant to fix — cosine similarity alone cannot reliably
prefer the current version when both documents are this similar.

---

## Part 5 — Retrieval improvements

**Improvement #1 — Score threshold** (`min_score` on `/search` and `/ask`,
using Qdrant's native `score_threshold` param in `store.search()`)

Before: retrieval always returns the top *k* hits, no matter how unrelated
the query is — a completely off-topic question still gets 3 "closest"
chunks with a near-zero score, which risked being fed to the model as if
they were relevant context.

After: hits below `min_score` are dropped by Qdrant itself, before they ever
reach the application.

*Tested:* query `"what's the best recipe for chocolate cake?"`,
`min_score: 0.3`. Without the threshold this query previously returned 3
weak hits (best score ~0.06). With the threshold: `"hits": []` — an honest
empty result instead of a confident-looking but meaningless top-3.

**Improvement #2 — Metadata filter** (`product` / `effective_after` on
`/search` and `/ask`, via `VectorStore.build_filter()` and Qdrant's native
`query_filter`)

Before: the 2025 and 2026 fee schedules competed purely on similarity score
— 0.7097 vs. 0.7069, a gap of 0.0028 — so both routinely landed in the
same top-3, contradicting each other in the retrieved context.

After: `effective_after: "2026-01-01"` restricts retrieval to chunks whose
document's effective date is on or after that date, using a numeric
`effective_int` field (e.g. `2026-01-15` → `20260115`) computed at ingest
time and compared with a Qdrant range filter.

*Tested:* same query, `"early repayment fee?"`, `top_k: 3`,
`effective_after: "2026-01-01"`. All 3 returned hits are now from
`05-early-repayment-fees-2026` only — the 2025 document is excluded
entirely, regardless of its similarity score. This directly fixes the
problem documented in Part 4's before/after comparison.

---

## Part 6 — Question set results

<!-- TODO -->

---

## What's still wrong / next steps

<!-- TODO -->