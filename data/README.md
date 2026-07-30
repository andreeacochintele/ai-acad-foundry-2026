# Corpus — Moch Bank Mortgages (fictional)

This is a fabricated knowledge base about a fictional retail bank's mortgage
products. Every fact, number, date, and policy here is invented for this
assignment — it does not describe any real bank, and no real customer data
is used anywhere in it.

**Domain:** mortgages and home loans (eligibility, rates, fees, process,
insurance, hardship, and a first-time buyer program).

**Documents:** 25, each with a YAML header (`title`, `product`, `audience`,
`effective`, `version`).

## Document list

| File | What it covers |
|---|---|
| `01-mortgage-overview.md` | The three mortgage products and how they relate |
| `02-eligibility-criteria.md` | Age, down payment (15%), income, employment, credit history |
| `03-interest-rate-structure.md` | Fixed period, variable period, rate caps |
| `04-early-repayment-fees-2025.md` | Superseded fee schedule (1.5%, with a threshold) |
| `05-early-repayment-fees-2026.md` | Current fee schedule (1%, no threshold) |
| `06-application-process-steps.md` | The 9-step application process |
| `07-required-documents-checklist.md` | Documents needed, by applicant type |
| `08-loan-to-value-rate-table.md` | LTV tiers and starting rates (table) |
| `09-refinancing-existing-mortgage.md` | Refinancing rules and consolidation |
| `10-mortgage-insurance-requirements.md` | Mandatory and optional insurance |
| `11-eligible-property-types.md` | What can and cannot be financed |
| `12-co-borrower-guarantor-rules.md` | Co-borrower vs. guarantor rules |
| `13-late-payment-penalties.md` | Grace period, daily penalty, acceleration |
| `14-hardship-restructuring.md` | Payment holiday, term extension, rate reduction |
| `15-first-time-buyer-program.md` | Reduced down payment (10%), age/residency rules |
| `16-glossary-mortgage-terms.md` | IRCC, LTV, amortization, acceleration, etc. |
| `17-closing-costs-and-fees.md` | Origination fee, appraisal fee, Land Registry fee, notary fee |
| `18-mortgage-top-up.md` | Borrowing more against an existing mortgage, same collateral |
| `19-mortgage-portability.md` | Carrying a mortgage's rate and term to a new property |
| `20-green-mortgage-discount.md` | Rate discount for energy-efficient (EPC A/B) properties |
| `21-buy-to-let-mortgage.md` | Rental-property rules: rate premium, rental income in DSTI |
| `22-non-resident-borrower-eligibility.md` | Higher down payment, currency haircut, extra documents |
| `23-complaints-and-escalation.md` | Response timelines, CSALB escalation, what's out of scope |
| `24-new-build-staged-drawdown.md` | Buying from a developer under construction, tranche funding |
| `25-rate-type-switch-mid-term.md` | One-time fixed↔variable switch, separate from rate lock |

## Which document covers which breaking case

| Case | Document(s) | How it breaks naive retrieval |
|---|---|---|
| **A precise number** | `13-late-payment-penalties.md` | The daily penalty is exactly "0.05 percent per day, from day 6" — an answer that rounds or approximates this is wrong |
| **Two documents that must be combined** | `02-eligibility-criteria.md` + `15-first-time-buyer-program.md` | The general down payment (15%) lives in one file; the First-Time Buyer override (10%, plus an age and price cap) lives in another. Answering "what's my down payment as a first-time buyer" correctly requires both |
| **Near-duplicates that differ** | `04-early-repayment-fees-2025.md` vs `05-early-repayment-fees-2026.md` | Same topic, same structure, different numbers (1.5% with a threshold vs. 1% with none) — retrieval must not blend them or return the wrong year |
| **A long procedure with steps** | `06-application-process-steps.md` | Nine sequential, numbered steps; naive chunking is likely to cut the list mid-sequence and separate a step from its number |
| **A table** | `08-loan-to-value-rate-table.md` | A Markdown table with 4 rows and 4 columns; plain-text chunking can flatten it into unreadable rows |
| **Contradiction across versions** | `04-early-repayment-fees-2025.md` vs `05-early-repayment-fees-2026.md` | The same pair also serves this case: the fee genuinely changed on 2026-01-15, and the 2025 document says so explicitly ("superseded") — the assistant must prefer the current version by date, not just by similarity score |
| **Something deliberately absent** | *(no document)* | Student loans are never mentioned anywhere in this corpus, on purpose. Moch Bank (fictional) does not offer them, and the assistant must say so rather than inventing a rate |

All 7 cases are covered (the assignment requires at least 5).

## A note on the 2025/2026 fee schedule pair

This is the one place in the corpus designed to actively mislead a naive
pipeline: both documents are about the same topic, phrased similarly, and
without metadata filtering, a query like *"what is the early repayment fee"*
can return either one depending on which happens to score marginally higher
semantically — even though only one is actually in effect today. This is the
motivating example for the metadata-filtering improvement in Part 5
(filter or prefer by `effective` date).
