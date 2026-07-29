# Libra Assist — Case Console (v2)

A single-file HTML/JS chat frontend for the RAG Teaching API. This is the
second pass on the Assignment 3, Part 7 frontend — same job (a
conversational Libra Assist, not an API explorer), a more deliberate visual
identity, and a few features worth having beyond the assignment's minimum.

## How to run it

No build step, no npm:

1. Start the backend (`docker compose up qdrant -d`, `az login`,
   `uv run uvicorn app.main:app --reload --port 7799` from `code/backend`
   — or `docker compose up --build` for the all-Docker route).
2. Open `libra-assist-chat-v2.html` directly in a browser. It talks to
   `http://localhost:7799` by default — change the "Backend URL" field in
   the sidebar if yours runs elsewhere.

It's a static file; CORS is wide open on the backend
(`allow_origins=["*"]`), so `file://` works fine.

## The design, briefly

The subject is a loan officer's case file, not a generic chat app — every
grounded answer is a claim that needs a paper trail. So the signature
element is a literal ink-stamp on each answer, rotated slightly like a real
stamp on a physical document:

- **"Grounded & cited"** (green) — RAG found relevant, cited passages.
- **"Not found"** (rust) — RAG ran, but nothing cleared the score threshold.
  The answer is flagged unverified, not hidden or silently trusted.
- **"Ungrounded by choice"** (grey) — RAG was off; the model answered from
  its own knowledge and the console says so plainly.

Type: a serif (Source Serif 4) for the brand and persona names, carrying the
"official document" feel; a plain sans (Inter) for body text; a mono
(JetBrains Mono) for anything measured — scores, dates, token counts.
Answers are laid out as memo slips on a paper background, not chat bubbles.

## What's new versus the first version

- **Compare mode** — ask one question, get answers from two personas side
  by side, each independently stamped. This is the fastest way to show a
  reviewer "same facts, different voice" live, instead of asking twice and
  scrolling back to compare.
- **Bibliography tab** — every document actually cited across the whole
  conversation collects in a running list in the sidebar, with a citation
  count. It answers "what has this conversation actually been grounded in,
  so far" without re-reading every message.
- **Export as Markdown** — downloads the visible conversation (questions,
  answers, cited sources) as a `.md` file via a plain browser download; no
  browser storage involved, just a `Blob` and a click.
- **Example prompt chips** — the empty state offers four ready-made
  questions from the actual mortgage corpus, so a reviewer can start
  immediately instead of guessing what to ask.
- Everything from the first version is still here: persona switch, RAG
  toggle, `top_k` / `min_score` / `effective_after` controls, token usage,
  the exact prompt sent, and the ingestion panel.

## Known limitation, unchanged

`/ask` is stateless. This console fakes multi-turn conversation by
prepending the last few exchanges into the `question` field sent to `/ask`
— a frontend trick, not real server-side memory. Refreshing the page starts
a new case. No `localStorage` or `sessionStorage` is used anywhere in this
file, on purpose — everything lives in memory for the session only.