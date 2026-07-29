"""Request/response models — rich on purpose: the responses ARE the lesson."""
from __future__ import annotations

from typing import Literal, Optional  # noqa: F401  (Literal used by AskRequest)

from pydantic import BaseModel, Field

Strategy = Literal["static", "dynamic", "sentence", "semantic"]


# --- chunking -----------------------------------------------------------------
class ChunkRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{
        "text": "Libra Bank blocks a card after three failed PIN attempts. "
                "A blocked card can be unblocked in the branch after identity verification. "
                "Mortgage early repayment is free of charge in the variable-rate period.",
        "strategy": "dynamic",
        "chunk_size": 120,
        "chunk_overlap": 30,
    }]}}

    text: str = Field(..., description="Raw text to split", min_length=1)
    strategy: Optional[Strategy] = Field(None, description="Defaults to CHUNK_STRATEGY from .env")
    chunk_size: Optional[int] = Field(None, ge=50, description="Target size, characters (≥ 50)")
    chunk_overlap: Optional[int] = Field(None, ge=0, description="Overlap, characters")
    sentences_per_chunk: Optional[int] = Field(None, ge=1, description="'sentence' strategy only")
    semantic_threshold: Optional[float] = Field(None, gt=0, le=1, description="'semantic' strategy only — 0 < t ≤ 1")


class ChunkInfo(BaseModel):
    index: int
    text: str
    chars: int
    approx_tokens: int = Field(description="chars / 4 — a rough but honest estimate")


class ChunkResponse(BaseModel):
    strategy: Strategy
    params_used: dict
    count: int
    chunks: list[ChunkInfo]


# --- ingestion ----------------------------------------------------------------
class IngestRequest(ChunkRequest):
    model_config = {"json_schema_extra": {"examples": [{
        "text": "Libra Bank blocks a card after three failed PIN attempts. "
                "A blocked card can be unblocked in the branch after identity verification. "
                "Mortgage early repayment is free of charge in the variable-rate period.",
        "strategy": "dynamic",
        "source": "retail-faq",
    }]}}

    source: Optional[str] = Field(None, description="Label stored with every chunk (e.g. 'cards-faq')")

    # Improvement #2 (Assignment 3, Part 4): real metadata, mirroring the YAML
    # front matter on each corpus document. Stored on every chunk so it can
    # later be used to filter search results (Part 5) — e.g. preferring the
    # 2026 fee schedule over the 2025 one by `effective` date, instead of
    # letting a marginally-higher similarity score pick the wrong version.
    title: Optional[str] = Field(None, description="Document title, from its front matter")
    product: Optional[str] = Field(None, description="Product line, e.g. 'mortgages'")
    audience: Optional[str] = Field(None, description="Intended audience, e.g. 'retail'")
    effective: Optional[str] = Field(None, description="Effective date (YYYY-MM-DD) from front matter")
    version: Optional[int] = Field(None, description="Document version number from front matter")


class IngestResponse(BaseModel):
    strategy: Strategy
    count: int
    vector_dimension: int
    embedding_preview: list[float] = Field(description="First 8 dimensions of chunk #0 — meaning as numbers")
    embedding_model: dict
    point_ids: list[str]
    chunks: list[ChunkInfo]


# --- retrieval ----------------------------------------------------------------
class SearchRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{
        "query": "my card got frozen, what do I do?",
        "top_k": 3,
    }]}}

    query: str = Field(..., min_length=1)
    top_k: Optional[int] = Field(None, ge=1, le=50)

    # Part 5 improvements
    min_score: Optional[float] = Field(
        None, ge=0, le=1,
        description="Drop hits below this cosine similarity. Retrieval always "
                    "returns *something* — this is what turns a weak match "
                    "into an honest 'nothing relevant found' instead of a "
                    "confident wrong answer.",
    )
    product: Optional[str] = Field(None, description="Restrict to chunks with this 'product' metadata, e.g. 'mortgages'")
    effective_after: Optional[str] = Field(
        None, description="YYYY-MM-DD — only return chunks whose document is effective on or after this date "
                          "(picks the current version over a superseded one, e.g. the 2026 fee schedule over the 2025 one)",
    )
    dedupe: Optional[bool] = Field(
        False, description="Drop near-duplicate hits (e.g. two overlapping chunks repeating the same "
                           "sentence) instead of letting them fill up top_k with redundant text.",
    )
    rewrite_query: Optional[bool] = Field(
        False, description="Run the raw query through a cheap LLM rewrite before embedding — "
                           "turns something like 'it got blocked again??' into a clearer search query.",
    )


class SearchHit(BaseModel):
    score: float = Field(description="Cosine similarity — 1.0 is identical direction")
    text: str
    index: Optional[int] = None
    strategy: Optional[str] = None
    source: Optional[str] = None
    id: str
    # Improvement #2: surfaced so a reviewer (or the frontend) can see WHICH
    # document and version grounded an answer, not just its raw text.
    title: Optional[str] = None
    product: Optional[str] = None
    effective: Optional[str] = None
    version: Optional[int] = None


class SearchResponse(BaseModel):
    query: str
    top_k: int
    embedding_model: dict
    query_embedding_preview: list[float]
    hits: list[SearchHit]
    rewritten_query: Optional[str] = Field(None, description="What the query became before embedding, if rewrite_query was true")


# --- generation ---------------------------------------------------------------
class AskRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{
        "question": "What fee does Libra Bank charge for early mortgage repayment?",
        "use_rag": True,
        "top_k": 3,
        "agent": "lyrical",
    }]}}

    question: str = Field(..., min_length=1)
    use_rag: bool = Field(True, description="false = plain LLM; true = retrieve then augment")
    top_k: Optional[int] = Field(None, ge=1, le=50)
    temperature: Optional[float] = Field(None, ge=0, le=2)
    agent: Optional[str] = Field(
        None,
        description="Persona name from app/agents/personas/ — try 'default', 'lyrical', "
                    "'compliance', 'teller'. Falls back to AGENT_PERSONA in .env.",
    )
    agent_mode: Optional[Literal["local", "foundry"]] = Field(
        None, description="local = the loop runs here; foundry = the hosted Agent Service"
    )

    # Part 5 improvements — same meaning as in SearchRequest, applied when use_rag=true
    min_score: Optional[float] = Field(None, ge=0, le=1, description="Drop retrieved chunks below this similarity")
    product: Optional[str] = Field(None, description="Restrict retrieval to this product line, e.g. 'mortgages'")
    effective_after: Optional[str] = Field(None, description="YYYY-MM-DD — only retrieve documents effective on or after this date")
    dedupe: Optional[bool] = Field(False, description="Drop near-duplicate retrieved chunks")
    rewrite_query: Optional[bool] = Field(False, description="Rewrite the question into a cleaner search query before embedding")


class AgentInfo(BaseModel):
    name: str
    display_name: str
    description: str
    mode: str = Field(description="Where this run executed: local or foundry")
    temperature: Optional[float] = None
    style_rules: list[str] = Field(default_factory=list)


class HostedAgent(BaseModel):
    agent_id: str
    name: str
    model: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[int] = None
    instructions_preview: Optional[str] = None


class PersonaSummary(BaseModel):
    name: str
    display_name: str
    description: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    style_rules: list[str] = Field(default_factory=list)
    require_citations: bool = True
    refuse_when_unsupported: bool = True
    reasoning_effort: Optional[str] = None
    tools: list[str] = Field(default_factory=list)
    runs_on: Literal["local", "both", "foundry", "unknown"] = Field(
        "local",
        description="local = JSON file only · both = also hosted in Foundry · "
                    "foundry = hosted only, no local file · unknown = cannot ask Foundry",
    )
    hosted: Optional[HostedAgent] = None


class FoundryAvailability(BaseModel):
    available: bool
    reason: Optional[str] = Field(
        None, description="Why the Agent Service could not be queried, when it could not"
    )


class AgentListResponse(BaseModel):
    active_mode: str
    default_persona: str
    personas_dir: str
    count: int
    personas: list[PersonaSummary]
    foundry: FoundryAvailability
    hosted_only: list[PersonaSummary] = Field(
        default_factory=list,
        description="Agents that exist in Foundry with no local persona file — "
                    "created in the portal, or from a file since deleted",
    )


class AzureDeployment(BaseModel):
    name: str
    model: Optional[str] = None
    version: Optional[str] = None
    sku: Optional[str] = None
    capacity: Optional[int] = None
    state: Optional[str] = None


class AzureDeployments(BaseModel):
    available: bool
    reason: Optional[str] = None
    items: list[AzureDeployment] = Field(default_factory=list)


class AzureStatus(BaseModel):
    configured: bool
    auth: str = Field(description="identity (Entra) or key")
    auth_note: Optional[str] = None
    resource: Optional[str] = None
    resource_group: Optional[str] = None
    project: Optional[str] = None
    location: Optional[str] = None
    subscription_id: Optional[str] = None
    inference_endpoint: Optional[str] = None
    project_endpoint: Optional[str] = None
    openai_endpoint: Optional[str] = None
    chat_deployment: Optional[str] = None
    embedding_deployment: Optional[str] = None
    foundry_url: Optional[str] = None
    portal_url: Optional[str] = None
    deployments: AzureDeployments


class Usage(BaseModel):
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


class AskResponse(BaseModel):
    answer: str
    augmented: bool
    provider: str
    model: str
    agent: Optional[AgentInfo] = Field(None, description="Which persona shaped this answer")
    system_prompt: str = Field(description="The system message actually sent")
    prompt_sent: str = Field(description="The exact user prompt sent to the model — compare with/without RAG")
    retrieved: list[SearchHit] = Field(default_factory=list)
    usage: Optional[Usage] = None
    rewritten_query: Optional[str] = Field(None, description="What the question became before embedding, if rewrite_query was true")


# --- tools / services ---------------------------------------------------------
class ScrapeRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{
        "url": "https://learn.microsoft.com/azure/ai-foundry/what-is-azure-ai-foundry",
    }]}}

    url: str = Field(..., description="Page to fetch and strip to text")
    max_chars: Optional[int] = Field(None, ge=200, le=200000)


class ScrapeResponse(BaseModel):
    url: str
    status_code: int
    title: Optional[str] = None
    text: str
    chars: int
    approx_tokens: int
    warnings: list[str] = Field(description="Everything the naive approach could not handle")
    stats: dict


class SpeakRequest(BaseModel):
    model_config = {"json_schema_extra": {"examples": [{
        "text": "Your card was blocked after three failed PIN attempts.",
    }]}}

    text: str = Field(..., min_length=1, max_length=3000)
    voice: Optional[str] = Field(None, description="Neural voice name; defaults to AZURE_SPEECH_VOICE")


class TranscribeResponse(BaseModel):
    status: Optional[str] = None
    text: str
    confidence: Optional[float] = None
    duration_seconds: Optional[float] = None
    language: Optional[str] = None


# --- ops ----------------------------------------------------------------------
class CollectionInfo(BaseModel):
    exists: bool
    name: str
    points_count: int
    vector_dimension: Optional[int] = None
    distance: Optional[str] = None


class Health(BaseModel):
    status: str
    qdrant: str
    qdrant_url: str
    llm: dict
    embeddings: dict
    agents: dict = Field(default_factory=dict)
    speech: dict = Field(default_factory=dict)
