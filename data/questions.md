# Question set — Libra Bank Mortgages

15 questions, in three groups, designed against the corpus in `data/`. For
each: the expected answer, which document(s) contain it, and — once tested
through `/ask` — what the assistant actually said.

**How to test each one:** `POST /ask` with `use_rag: true`, record the
`answer`, whether it matches the expected answer, and whether it cited the
right document(s) in `retrieved`.

---

## Group A — Simple retrieval (one chunk, one document)

### A1. What is the minimum down payment for a first home under the Standard Mortgage?
- **Expected:** 15 percent.
- **Source:** `02-eligibility-criteria.md`
- **Actual result:** ✅ Correct — answered "15%", citing [1][3]. Note: the canonical sentence in `02-eligibility-criteria.md` itself did NOT make the top-4 retrieved chunks; the answer was confirmed via two documents that mention the same figure in passing instead.

### A2. What is the early repayment fee during the fixed-rate period, under the current fee schedule?
- **Expected:** 1 percent, no threshold (applies from the first euro).
- **Source:** `05-early-repayment-fees-2026.md`
- **Actual result:** ✅ Correct — 1%, cited [2][3]. Notable: the 2025 document actually scored HIGHER (0.7925 vs 0.7493) than the 2026 one, but the model read the "superseded" note in the 2025 text and correctly preferred 2026 anyway.

### A3. How many days of grace period are there before late payment penalties start?
- **Expected:** 5 days (days 1–5, no penalty).
- **Source:** `13-late-payment-penalties.md`
- **Actual result:** ✅ Correct — 5 days, plus correctly added the 0.05%/day detail unprompted.

### A4. What is the daily late payment penalty rate, once it applies?
- **Expected:** 0.05 percent of the overdue installment amount, per day.
- **Source:** `13-late-payment-penalties.md`
- **Actual result:** ✅ Correct — 0.05%/day, from day 6 onward.

### A5. By what age must a Libra Bank mortgage be fully repaid?
- **Expected:** Before the borrower turns 70.
- **Source:** `02-eligibility-criteria.md`
- **Actual result:** ✅ Correct — age 70, plus correctly mentioned the minimum age (21) unprompted.

### A6. What starting fixed rate applies at an LTV of 60% or below, over a 5-year fixed period?
- **Expected:** 6.20 percent.
- **Source:** `08-loan-to-value-rate-table.md`
- **Actual result:** ✅ Correct — 6.20%, read directly from the Markdown table, which survived chunking intact in this case.

### A7. When refinancing, what percentage of the new loan can be used to consolidate other debts?
- **Expected:** Up to 30 percent.
- **Source:** `09-refinancing-existing-mortgage.md`
- **Actual result:** ✅ Correct — 30%, plus the 40% DTI condition.

---

## Group B — Multi-step (needs combining documents, or a calculation)

### B1. As a first-time buyer, what's my minimum down payment, and what else must I qualify under?
- **Expected:** 10 percent (not the standard 15), provided the property is
  ≤150,000 EUR — plus the applicant must be under 35, and the property must
  be the primary residence for at least 5 years.
- **Why it's hard:** the reduced percentage lives in one document, but it
  only makes sense as an *override* of the general rule in another.
- **Source:** `02-eligibility-criteria.md` (general 15% rule) +
  `15-first-time-buyer-program.md` (10% override + extra conditions)
- **Actual result:** ⚠️ Partial — correctly gave 10% and the first-time-buyer definition, but OMITTED the age (<35) and 5-year residency conditions. `15-first-time-buyer-program.md` has 4 chunks; only 2 were retrieved (the percentage and the definition), not the "Additional conditions" chunk.

### B2. I have a mortgage under the 2025 fee schedule, original loan 100,000 EUR. If I prepay 30,000 EUR during the fixed-rate period, how much is the early repayment fee?
- **Expected:** Under the 2025 schedule, the first 20% of the original loan
  (20,000 EUR) can be prepaid free of charge; the fee (1.5%) applies only to
  the amount above that threshold. So: 30,000 − 20,000 = 10,000 EUR subject
  to the fee → 1.5% × 10,000 = **150 EUR**.
- **Why it's hard:** requires retrieving the right (older) fee schedule
  *and* doing a two-step calculation (threshold, then percentage) — a single
  lookup only gets you the rate, not the answer.
- **Source:** `04-early-repayment-fees-2025.md`
- **Actual result:** ✅ Correct — calculated 150 EUR, and additionally flagged a real ambiguity in the source document ("remaining principal" vs. the prepaid amount) instead of silently guessing.

### B3. I'm 66 years old. Can I get a 5-year mortgage? If not, what's the longest term I could get?
- **Expected:** No — a 5-year term would end at age 71, past the age-70
  repayment limit. The longest term available is 4 years (70 − 66).
- **Why it's hard:** the age rule and the requested term must be combined
  arithmetically; there's no document that states "4 years" directly.
- **Source:** `02-eligibility-criteria.md` (the age-70 rule)
- **Actual result:** ✅ Correct, and better than the expected answer above — the model also pulled in the 5-year minimum term from `01-mortgage-overview.md` and correctly concluded the applicant doesn't qualify for a Standard Mortgage at all, not just "no 5-year option". My expected answer only accounted for the age rule.

### B4. I got divorced and have a joint mortgage with my ex-spouse as co-borrower. Is she automatically removed from the loan? What do I need to do?
- **Expected:** No automatic removal. A formal removal request is required,
  and the bank re-runs full eligibility on the remaining borrower alone; if
  they don't qualify at the current balance on their own, the removal is
  declined. Generally accompanied by a property title transfer.
- **Source:** `12-co-borrower-guarantor-rules.md`
- **Actual result:** ✅ Correct and complete — no automatic removal, title transfer requirement, and re-run eligibility check all mentioned.

### B5. If I miss a mortgage payment by 10 days, what happens — and could I have avoided this before it happened?
- **Expected:** Days 6–10 fall in the "0.05% per day" late penalty tier
  (grace period covers only days 1–5). It hasn't yet reached day 31
  (credit bureau reporting) or day 91 (acceleration). It could have been
  avoided by requesting a payment holiday, term extension, or temporary
  rate reduction *before* the payment became overdue.
- **Why it's hard:** needs both the penalty schedule and the hardship
  options document — the second document's relevance ("could I have avoided
  this") isn't obvious from the question's surface wording alone.
- **Source:** `13-late-payment-penalties.md` + `14-hardship-restructuring.md`
- **Actual result:** ✅ Correct and complete — combined both documents correctly on the first retrieval, including the specific payment holiday option as the avoidance answer.

---

## Group C — Must refuse (genuinely not in the corpus)

### C1. What is the interest rate on your student loans?
- **Expected:** A refusal — Libra Bank (fictional) does not offer student
  loans; this is nowhere in the corpus, on purpose.
- **Source:** none (deliberately absent)
- **Actual result:** ✅ Correctly refused. Note: retrieved chunks scored ~0.40–0.46 (mortgage rate info, semantically nearby but off-topic) — much higher than a fully unrelated query like "chocolate cake" (~0.06), but the model still read the content and refused rather than being misled by the merely-plausible-looking context.

### C2. Do your mortgages offer a rate based on EURIBOR instead of IRCC?
- **Expected:** A refusal, or at least "not specified" — the corpus only
  ever describes IRCC-indexed variable rates; EURIBOR is never mentioned as
  an option.
- **Source:** none (only IRCC appears, in `03-interest-rate-structure.md`
  and `16-glossary-mortgage-terms.md` — the assistant must not assume
  EURIBOR is offered just because it's a real, plausible-sounding term)
- **Actual result:** ✅ Correctly refused — explicitly said "No", cited the IRCC-based mechanism, and stated the retrieved passages contain no reference to EURIBOR. This is the single most important result in the whole set.

### C3. Can I get a Libra Bank mortgage for a vacation home outside Romania?
- **Expected:** A refusal, or "not specified" — the corpus describes
  eligible property types (apartments, houses, land with a permit, mixed-use
  units) but never states a country restriction one way or the other, and
  never mentions financing property abroad.
- **Source:** none
- **Actual result:** ✅ Correctly refused, but for a DIFFERENT reason than designed: `01-mortgage-overview.md` explicitly says loans are "within Romania", so this was a grounded refusal from an explicit statement, not from an absence of information as I'd intended. Corpus-design lesson: I meant to test "silence", but accidentally tested "explicit exclusion" instead — both are valid but exercise different behaviour.

---

## Summary (fill in after testing all 15)

| # | Group | Correct? | Refused correctly? | Notes |
|---|---|---|---|---|
| A1–A7 | Simple | 7/7 ✅ | — | All correct; A1 and A2 show retrieval isn't always via the "best" chunk |
| B1–B5 | Multi-step | 4/5 ✅, 1 ⚠️ | — | B1 partial (missed 2 of 4 chunks from one doc); B2/B3 exceeded expectations |
| C1–C3 | Must refuse | — | 3/3 ✅ | C2 (EURIBOR) is the most important test in the set |