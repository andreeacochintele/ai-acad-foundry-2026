"""The local agent — the persona runs in *your* process, against any provider.

This is the honest minimum of what an "agent" is when you strip the marketing:
a persona (instructions + rules), optional retrieved context, and a model call.
No platform required — it works with OpenAI, Anthropic, LM Studio or Foundry,
and it is what runs when AGENT_MODE=local.

Compare with foundry_agent.py, where the same persona is hosted by Azure and the
loop runs on Microsoft's side.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings
from ..llm import get_llm
from .persona import Persona


@dataclass
class AgentReply:
    text: str
    mode: str                       # "local" | "foundry"
    persona: str
    system_prompt: str              # exactly what was sent as the system message
    prompt_sent: str                # exactly what was sent as the user message
    provider: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


def build_user_prompt(question: str, chunks: list[dict], history: list[dict] | None = None,
                      attached_document: str | None = None) -> str:
    """Question alone, question + retrieved passages, and/or prior turns.

    The backend keeps no session state (see app/sessions.py's docstring) — a
    multi-turn conversation only works because the frontend resends recent
    history each call, and it lands here as plain transcript text ahead of the
    new question, rather than as a real multi-message array. That keeps every
    LLM provider branch in app/llm.py untouched: one system + one user string,
    same as a single-turn call, just with more said in the user string.

    `attached_document` (see AskRequest) is kept in its own labelled block,
    separate from `chunks` — it wasn't retrieved by similarity search, so it
    has no score, and folding it into CONTEXT would misrepresent it as one
    more ranked passage instead of the whole file the user actually attached.
    """
    if not chunks and not history and not attached_document:
        return question
    parts = []
    if history:
        transcript = "\n".join(
            f"{'User' if h['role'] == 'user' else 'Assistant'}: {h['text']}" for h in history
        )
        parts.append(f"PRIOR CONVERSATION — for context, oldest first:\n{transcript}")
    if attached_document:
        parts.append(f"ATTACHED DOCUMENT — provided by the user for this conversation only, "
                     f"not part of the knowledge base:\n{attached_document}")
    if chunks:
        context = "\n\n".join(
            f"[{i + 1}] (score {c['score']}) {c['text']}" for i, c in enumerate(chunks)
        )
        parts.append(f"CONTEXT — retrieved passages, most similar first:\n{context}")
    parts.append(f"QUESTION:\n{question}")
    return "\n\n".join(parts)


def run(
    persona: Persona,
    question: str,
    chunks: list[dict] | None = None,
    temperature: float | None = None,
    history: list[dict] | None = None,
    attached_document: str | None = None,
) -> AgentReply:
    chunks = chunks or []
    system = persona.system_prompt(grounded=bool(chunks) or bool(attached_document))
    user = build_user_prompt(question, chunks, history, attached_document)

    # precedence: explicit request value > persona file > .env default
    temp = temperature if temperature is not None else (
        persona.temperature if persona.temperature is not None else settings.llm_temperature
    )
    max_tokens = persona.max_tokens or settings.llm_max_tokens

    # Reasoning models (the gpt-5 family) spend part of the completion budget thinking
    # before they write. A persona can cap that so short, stylistic answers are not
    # starved of visible output tokens.
    extras = {"reasoning_effort": persona.reasoning_effort} if persona.reasoning_effort else {}

    llm = get_llm()
    result = llm.chat(system=system, user=user, temperature=temp,
                      max_tokens=max_tokens, extras=extras)

    return AgentReply(
        text=result.text,
        mode="local",
        persona=persona.name,
        system_prompt=system,
        prompt_sent=user,
        provider=result.provider,
        model=result.model,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
    )
