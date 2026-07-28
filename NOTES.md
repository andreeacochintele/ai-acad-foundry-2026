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

Full question set with expected answers and source documents lives in
`data/questions.md`. All 15 were run through `POST /ask`,
`use_rag: true`, agent `default`. Summary of what actually happened:

**Group A (simple retrieval) — 7/7 correct.** Every single-fact question
was answered correctly and cited the right document. One retrieval quirk
worth noting: on A1, the *canonical* sentence stating "15 percent down
payment" (in `02-eligibility-criteria.md`) did not make the top-4 retrieved
chunks — the correct number was confirmed via two documents that *mention*
the same figure in passing (`15-first-time-buyer-program.md`,
`08-loan-to-value-rate-table.md`). The answer was right, but not by hitting
the most obvious source — a reminder that a correct answer doesn't always
mean retrieval found the "best" chunk.

**Group B (multi-step) — 4/5 fully correct, 1 partial.**
- B1 (first-time buyer down payment) was **partial**: correctly gave 10%
  and the first-time-buyer definition, but *omitted* the age (<35) and
  5-year residency conditions from `15-first-time-buyer-program.md` — that
  document has 4 chunks and only 2 were retrieved; the "Additional
  conditions" chunk didn't make the top-4 for this phrasing.
- B2 (repayment fee calculation) was correct (150 EUR) and did something
  better than expected: it flagged a genuine ambiguity I introduced by
  accident in the 2025 fee document ("remaining principal" vs. the
  prepaid amount) instead of silently picking one interpretation.
- B3 (age + term calculation) was correct, and actually caught a mistake
  in my own expected answer — I'd only accounted for the age-70 rule, but
  the model also combined the mortgage overview's stated 5-year minimum
  term, correctly concluding the applicant doesn't qualify for a Standard
  Mortgage at all (not just "no 5-year option"), which is a stronger and
  more correct conclusion than the question was designed to test for.
- B4 (co-borrower divorce) was fully correct, retrieval found the exact
  right chunk despite the question never using the corpus's own wording.
- B5 (late payment + avoidance) was fully correct, correctly combining the
  penalties document with the hardship-restructuring document even though
  the "could I have avoided this" half of the question doesn't share
  obvious keywords with either source.

**Group C (must refuse) — 3/3 correct refusals**, but one design note:
- C1 (student loans) and C2 (EURIBOR vs. IRCC) both refused correctly. C2
  is the most important result in the whole set: EURIBOR is a real,
  plausible-sounding benchmark, and the model did **not** assume it must be
  offered just because it sounds legitimate — it explicitly said the
  corpus only ever mentions IRCC.
- C3 (property outside Romania) refused correctly, but not for the reason
  I designed the question around. I'd assumed this was "genuinely absent"
  information; in fact `01-mortgage-overview.md` explicitly restricts
  properties to "within Romania", so this is a *grounded* refusal from an
  explicit statement, not a refusal from missing information. Worth noting
  as a corpus-design lesson: what I intended as an "absence" case turned
  out to be an explicit exclusion — both are legitimate refuse-correctly
  cases, but they exercise different behaviour (silence vs. an explicit
  contradiction), and it's worth keeping both kinds in a question set on
  purpose next time rather than by accident.

**Honest overall score: 14/15 fully correct, 1 partial (B1).** The one
partial failure and the two "response was better than the question"
results (B2, B3) both point at the same root cause discussed in Part 4/5:
retrieval quality, not the model's reasoning, is the main lever left to
pull — the model consistently reasoned well with whatever it was given;
what it was given was occasionally incomplete.

| # | Group | Correct? | Refused correctly? | Notes |
|---|---|---|---|---|
| A1 | Simple | ✅ | — | Right answer, but not via the most direct source chunk |
| A2 | Simple | ✅ | — | Correctly preferred 2026 over 2025 despite 2025 scoring higher |
| A3 | Simple | ✅ | — | |
| A4 | Simple | ✅ | — | |
| A5 | Simple | ✅ | — | |
| A6 | Simple | ✅ | — | Correctly read the Markdown table |
| A7 | Simple | ✅ | — | |
| B1 | Multi-step | ⚠️ partial | — | Missed the age/residency conditions (2 of 4 chunks retrieved) |
| B2 | Multi-step | ✅ | — | Flagged a real corpus ambiguity instead of guessing |
| B3 | Multi-step | ✅ | — | Caught an omission in my own expected answer |
| B4 | Multi-step | ✅ | — | |
| B5 | Multi-step | ✅ | — | Combined two documents correctly |
| C1 | Must refuse | — | ✅ | |
| C2 | Must refuse | — | ✅ | Did not assume EURIBOR despite it sounding plausible |
| C3 | Must refuse | — | ✅ | Grounded in an explicit statement, not an absence |

---

## What's still wrong / next steps

<!-- TODO -->