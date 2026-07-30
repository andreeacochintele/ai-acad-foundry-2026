# Changelog

## `project` vs. `main`, at a glance

The two branches have diverged rather than one simply being ahead of the other:
`main` was fast-forwarded to `upstream/main` (the course repo) and carries
instructor-side additions `project` never had; `project` carries this repo's own
assignment work that hasn't been merged back into `main`. `git diff --stat main..project`
groups into:

- **Assignment 3 RAG pipeline improvements** (not from this session — already on
  `project` before it): `app/chunking.py`, `app/vectorstore.py`, `app/rag.py`,
  `app/schemas.py`, `app/main.py` gained stable/deterministic chunk IDs (re-ingesting a
  document overwrites its points instead of duplicating them), real per-chunk metadata
  (title/product/effective date/version), a retrieval score threshold, and a metadata
  filter for querying by product or effective date. Written up in detail in `NOTES.md`.
- **A 16-document mortgage corpus** under `data/` (`01-mortgage-overview.md` through
  `16-glossary-mortgage-terms.md`, plus `data/questions.md` and `data/README.md`) — the
  content the Chat persona is actually grounded on.
- **A second, standalone frontend** under `code/frontend_and/` — a single-file
  HTML/JS "Case Console (v2)" with no build step, a distinct paper/ink-stamp visual
  identity, and its own README. A separate deliverable from the React console in
  `code/frontend/`, not touched this session.
- **This session's Chat console work** — speech-to-text, session persistence, the
  settings panel, and related fixes — detailed below.
- **Present on `main` but not on `project`**: `.claude/skills/evaluate-projects/`
  (an instructor-side grading skill), `docs/assignments/project.md`, and
  `resources/forms/README.md`. These aren't things that got deleted from `project` —
  `project` branched before `main` pulled them in from upstream, so they simply never
  existed on this line of history.

## Console, calculator, corpus, and access control (this session)

Uncommitted — everything below is new working-tree state on top of `68ad027`.

### Mortgage calculator

- New **Calculator** screen (`views/Calculator.jsx`), a second customer-facing
  tool alongside Chat. Pure client-side arithmetic (standard amortization
  formula), no backend round-trip.
- Every number it uses is pulled straight from the corpus so it can never
  disagree with what the Chat assistant says: the loan-to-value rate tiers
  (`data/08-loan-to-value-rate-table.md`), the 40% affordability limit
  (`data/02-eligibility-criteria.md`), the First-Time Buyer program's
  150,000 EUR cap (`data/15-first-time-buyer-program.md`), and the green
  mortgage discount (`data/20-green-mortgage-discount.md`).
- Currency toggle (EUR/RON) — amounts are kept in EUR internally as the
  canonical unit (the corpus itself is EUR-denominated) and converted for
  display/input at a fixed reference rate, not a live feed.

### Corpus expanded to 25 documents

- Nine new documents (`data/17-*` through `data/25-*`): closing costs and
  fees, mortgage top-up, portability, the green mortgage discount, buy-to-let
  rules, non-resident borrower eligibility, complaints and escalation,
  new-build staged drawdown, and a mid-term fixed/variable rate switch.
- Chosen to stay within the assignment's own "12–25 documents" range
  (Assignment 3, Part 3) while covering real gaps in the mortgage domain, and
  written to be internally consistent with the existing 16 (same bank,
  currency, DSTI limit, rate structure) rather than introducing new numbers
  that could contradict them.
- `data/README.md`'s document table updated to match; re-ingested via
  `scripts/ingest_corpus.py` (94 chunks total, confirmed idempotent).

### Multi-turn conversation memory

- The backend is still stateless by design (`/ask` keeps no session — see the
  backend README) but it now accepts a `history` field: prior turns, oldest
  first, sent by the frontend on every call and folded into the prompt as a
  transcript ahead of the new question (`local_agent.build_user_prompt`,
  reused by `foundry_agent.py`). Only `question` itself is embedded for RAG
  retrieval, so history doesn't dilute the retrieval query.
- `Chat.jsx` builds this from `activeConv.messages` (capped to the last 10),
  mapping bot replies to `assistant` turns and skipping failed (`err`)
  messages. Verified with a live follow-up question ("what about the second
  option?") that only makes sense given the prior turn.

### Login gate — user vs. admin

- New **Login** screen (`views/Login.jsx`): a name and a role, nothing
  verified server-side — this is a UI convenience switch for the teaching
  console, not real authentication.
- `admin` sees the full console and can still flip between "console" and
  "client" view (the mode switch below); `user` is locked to the client view
  (Chat + Calculator only, no Settings) with no way to switch out of it.
- Session (name + role) persists in `localStorage`; a logout button clears it
  and returns to the login screen.

### Console / client view switch

- A "Console"/"Client" toggle in the topbar (admin-only) hides Settings and
  every internal pipeline screen (Knowledge, Retrieval, Agents, Tools,
  Status), leaving only Chat and the Calculator — what a customer, not a
  developer, should see.

### Full English + Romanian UI (i18n)

- New `src/i18n.jsx`: a small hand-rolled dictionary + `LanguageProvider`/
  `useLanguage()` (no external i18n library), covering every screen's chrome
  — labels, buttons, tooltips, error messages. A language toggle (EN/RO) sits
  in the topbar; the choice persists in `localStorage`.
- Deliberately scoped to UI chrome only: the Chat assistant's own answers are
  untouched by this toggle — the personas already reply in whichever language
  the question was asked in (see "Answering in the asker's language" below).

### Cosmetic: theme, logo, layout

- **Accent color picker** — a topbar dropdown (red/blue/teal/purple/green/
  gold) recomputes `--accent`, `--accent-soft` and `--grad-accent` at runtime;
  no longer hard-coded to red.
- **Logo** — settled on a plain sparkle mark (`BrandMark` in `components.jsx`)
  after several iterations (a monogram "L" cut into it, a script "L" traced by
  hand, "L" set in a webfont) landed on none of them working better than the
  star alone. Declined to copy a real company's logo from a reference image
  the user shared, to avoid resembling an actual bank's trademark too closely.
- **Responsive header** — the topbar wraps instead of truncating the brand
  name when badges crowd it, and the nav menu auto-collapses under ~900px
  (the hamburger still opens it manually at any width).
- Chat message text sized down to 12px.

## Chat console additions (previous session)

Committed as `Add speech-to-text and session persistence to the Chat console`
(`68ad027`) on the `project` branch.

## Speech-to-text (mic button)

- New mic button in the Chat composer: click to record, click again (it turns square
  and pulses red) to stop.
- Recording uses the browser's `MediaRecorder`, but before uploading, the clip is
  decoded with the Web Audio API and re-rendered to a 16 kHz mono WAV
  (`toMono16kWav` in `Chat.jsx`). This works around a Chromium bug where
  `MediaRecorder`'s webm/opus output carries an unresolved ("unknown") duration in its
  container header — Azure's speech endpoint trusted that header over the actual
  audio and truncated recognition to well under a second regardless of how long you
  spoke.
- A mic-language selector (`RO mic` / `EN mic`, in Settings) sets the language passed
  to Azure Speech.
- Backend: `app/services/speech.py::_stt_content_type` now passes through a codec that
  already names itself (e.g. `audio/webm;codecs=opus`) unchanged, instead of always
  forcing the `codecs=audio/pcm; samplerate=16000` suffix meant only for raw WAV.
- Recognized text is appended to the question box for review — nothing is sent
  automatically.

## Chat sessions (persistence)

- New `app/sessions.py`: one JSON file per conversation in `app/data/sessions/`, plus
  five endpoints wired into `main.py`: `GET /sessions`, `GET /sessions/{id}`,
  `POST /sessions`, `DELETE /sessions/{id}`, `GET /sessions/{id}/export` (Markdown).
- The Chat view saves a conversation on its first message (not on creation — an empty
  "+ New conversation" is never written to disk, so history doesn't fill up with
  indistinguishable blank entries).
- Every conversation is also mirrored into the browser's `localStorage`, synchronously,
  with no network round-trip — a message survives a refresh or a flaky backend even
  before (or if) the save to disk lands.
- On load, the console reconciles the two: anything with real content that never made
  it to the backend gets resent automatically instead of silently vanishing once the
  backend list becomes the source of truth.
- Export (Markdown and now also JSON) is built client-side from the conversation
  already in memory, so it works even for a conversation the backend hasn't (yet)
  persisted.
- `.gitignore`: added `code/backend/app/data/` (runtime session files, not source).

## Settings panel

- Agent choice, where it runs (local/Foundry), use-RAG, fact-check, mic language,
  top-K, and temperature — previously spread across the chat toolbar — are now behind
  a single gear-icon "Settings" button that opens a panel and closes on an outside
  click.
- Temperature is now an actual editable override sent to `/ask` (it used to be a
  read-only badge); it resets to the newly selected persona's own default whenever you
  switch agents.
- Suggested starter questions appear as clickable chips on an empty conversation.

## Answering in the asker's language

- `default.json`, `teller.json`, `lyrical.json`, and the new
  `andreea-cochintele-credit-specialist.json` persona each gained a style rule telling
  the model to reply in whatever language the question was asked in, instead of
  `default.json`'s previous hard-coded "answer in English."
- New persona: `andreea-cochintele-credit-specialist.json`, a consultative
  mortgage/credit advisor. It is now the Chat view's default agent, with `foundry` as
  the default run mode (falls back to `local` automatically if Foundry isn't reachable
  or the persona isn't deployed there).

## Full English UI

- All remaining Romanian UI strings in `App.jsx`, `Chat.jsx`, and one voice label in
  `Tools.jsx` were translated to English (history group labels, tooltips, button text,
  error messages, the Markdown export's fallback title in `sessions.py`).

## Bug fixes made along the way

- `Chat.jsx`: `recorder.stream = stream` threw (`MediaRecorder.stream` is a
  getter-only accessor) and silently aborted every recording attempt before it started.
  Removed — `.stream` is already exposed natively.
- `Chat.jsx`: the Send button passed React's click event into `send(overrideText)` as
  if it were the message text, throwing on `.trim()` and doing nothing — only Enter
  worked. Fixed to `onClick={() => send()}`.
- `Chat.jsx`: deleting a conversation that was never saved (no first message yet) hit
  a 404 and surfaced a scary error banner for a harmless case. `api.js` now attaches
  `status` to thrown errors so this can be told apart from a real failure and ignored.
- Added `recorder.onerror` and a try/catch around `.stop()`, so a failed recording
  reports an actual error instead of leaving the mic button stuck.

## Documentation

- `code/backend/README.md`: new "Chat sessions" section; expanded `/tools/transcribe`
  notes covering codec passthrough and the client-side WAV re-encode.
- `code/frontend/README.md`: new "Chat settings panel", "Conversation history", and
  rewritten "Speaking a question" sections.
