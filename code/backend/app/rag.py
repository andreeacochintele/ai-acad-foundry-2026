"""Prompt assembly — the heart of the 'augmented' in RAG, kept fully visible.

The /ask endpoint returns the exact prompt produced here, so the difference
between a plain question and an augmented one is inspectable in Postman.
"""
from __future__ import annotations

SYSTEM_PROMPT = (
    "You are Libra Assist, the internal AI assistant of a retail bank. "
    "Answer precisely and professionally, in English."
)

SYSTEM_PROMPT_RAG = SYSTEM_PROMPT + (
    " Ground every answer in the CONTEXT passages provided. If the context does not "
    "contain the information needed, say so explicitly instead of guessing. "
    "Reference passages as [1], [2], … when you use them."
)


def build_augmented_prompt(question: str, chunks: list[dict]) -> str:
    """Question + retrieved passages -> the final user prompt sent to the model."""
    context = "\n\n".join(
        f"[{i + 1}] (score {c['score']}) {c['text']}" for i, c in enumerate(chunks)
    )
    return (
        "CONTEXT — retrieved passages, most similar first:\n"
        f"{context}\n\n"
        "QUESTION:\n"
        f"{question}"
    )


# --- query rewriting (Part 5, improvement #4) ---------------------------------
#
# "it got blocked again??" is a poor embedding input — it's short on the
# actual nouns a similarity search needs to latch onto, and full of the kind
# of informal phrasing real customers type but no bank document ever uses.
# One cheap, low-temperature chat call turns it into something a vector
# search has a real chance at, before it ever touches the embedding model.
# This never touches the ANSWER — only what gets embedded for retrieval;
# the model still sees and answers the user's original wording.

QUERY_REWRITE_SYSTEM = (
    "You rewrite a customer's question into a short, clear search query for a "
    "document retrieval system. Keep every specific detail (numbers, product "
    "names, dates) exactly as given. Strip greetings, filler words and personal "
    "framing. Reply with ONLY the rewritten query on a single line — no quotes, "
    "no explanation, no preamble."
)


def rewrite_query(question: str) -> str:
    """Rewrite `question` into a cleaner search query using the configured
    chat model. Falls back to the original question if the model call fails
    or returns nothing usable — a rewrite step should never be the reason
    retrieval breaks."""
    from .llm import get_llm

    try:
        llm = get_llm()
        result = llm.chat(
            system=QUERY_REWRITE_SYSTEM,
            user=question,
            temperature=0.0,
            max_tokens=60,
        )
        rewritten = (result.text or "").strip().strip('"').strip()
        return rewritten or question
    except Exception:
        return question
