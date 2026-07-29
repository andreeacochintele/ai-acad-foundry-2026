"""Qdrant wrapper — collection lifecycle, upsert, similarity search.

The collection is created lazily with the dimension of the first embedding that
arrives. If a later embedding model produces a different dimension, we refuse
loudly: vectors from different models live in different spaces and comparing
them is meaningless — reset the collection and re-ingest instead.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from qdrant_client import QdrantClient, models

from .config import settings


class DimensionMismatch(Exception):
    def __init__(self, existing: int, incoming: int) -> None:
        self.existing = existing
        self.incoming = incoming
        super().__init__(
            f"Collection stores {existing}-dimensional vectors but the current embedding "
            f"model produces {incoming} dimensions. Vectors from different embedding models "
            f"are not comparable — DELETE /collection and re-ingest."
        )


class VectorStore:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.qdrant_url, timeout=10)
        self.collection = settings.qdrant_collection

    # --- lifecycle -----------------------------------------------------------
    def ensure_collection(self, dim: int) -> None:
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE),
            )
            return
        existing = self._vector_size()
        if existing != dim:
            raise DimensionMismatch(existing, dim)

    def reset(self) -> bool:
        if self.client.collection_exists(self.collection):
            self.client.delete_collection(self.collection)
            return True
        return False

    # --- data ----------------------------------------------------------------
    def upsert(self, chunks: list[str], vectors: list[list[float]], strategy: str,
               source: str | None, metadata: dict | None = None) -> list[str]:
        """Store chunks with a STABLE id derived from source + chunk index.

        Improvement #1 (Assignment 3, Part 4): previously every chunk got a
        fresh uuid4() on every call, so re-ingesting the same document just
        piled up duplicates in the collection — you'd see the same fact
        returned two or three times in /search, each copy competing for the
        same top_k slots. Deriving the id deterministically from
        "<source>:<index>" means Qdrant's upsert *overwrites* the existing
        point at that id instead of creating a new one, so re-ingesting a
        document replaces it cleanly.

        Known limitation: if a re-ingested document produces FEWER chunks
        than the previous version (e.g. because you edited it shorter), the
        leftover chunks from the old, longer version stay orphaned in the
        collection under their old ids. For this assignment that's an
        acceptable rough edge — the fix would be tracking chunk counts per
        source and deleting anything beyond the new count, which is a good
        next step but out of scope here.
        """
        source_label = source or "adhoc"
        ids = [
            str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_label}:{i}"))
            for i in range(len(chunks))
        ]
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        meta = metadata or {}
        # Part 5 needs to filter/compare "effective" dates, but Qdrant range
        # filters need a number, not a "YYYY-MM-DD" string. Store a parallel
        # integer form (e.g. "2026-01-15" -> 20260115) alongside the original
        # string, so the human-readable date still displays in search results
        # while the filter has something orderable to compare against.
        effective_int = None
        eff = meta.get("effective")
        if eff and len(eff) == 10 and eff[4] == "-" and eff[7] == "-":
            try:
                effective_int = int(eff.replace("-", ""))
            except ValueError:
                effective_int = None
        self.client.upsert(
            collection_name=self.collection,
            points=[
                models.PointStruct(
                    id=pid,
                    vector=vec,
                    payload={
                        "text": text,
                        "index": i,
                        "strategy": strategy,
                        "source": source_label,
                        "ingested_at": now,
                        # Improvement #2: real metadata, not just a source
                        # label. Without this, nothing can be filtered by
                        # product, audience, or which version is current —
                        # the 2025 vs. 2026 fee schedule pair in the corpus
                        # is exactly the case this exists to fix (Part 5).
                        "title": meta.get("title"),
                        "product": meta.get("product"),
                        "audience": meta.get("audience"),
                        "effective": meta.get("effective"),
                        "effective_int": effective_int,
                        "version": meta.get("version"),
                    },
                )
                for i, (pid, text, vec) in enumerate(zip(ids, chunks, vectors))
            ],
        )
        return ids

    def search(self, vector: list[float], top_k: int,
               query_filter: "models.Filter | None" = None,
               score_threshold: float | None = None,
               dedupe: bool = False) -> list[dict]:
        """Part 5, improvement #1 (score threshold), #2 (metadata filter) and
        #5 (dedupe), all combined here. `dedupe=True` fetches a larger
        candidate pool from Qdrant (score-sorted, same as always) and then
        drops any hit that's a near-duplicate of one already selected —
        the classic failure mode being two overlapping chunks from a
        `dynamic`-strategy document that repeat the same sentence at their
        shared boundary, quietly filling 2 of 3 `top_k` slots with the same
        fact instead of surfacing a third, different one.
        """
        fetch_limit = min(top_k * 4, 30) if dedupe else top_k
        hits = self.client.query_points(
            collection_name=self.collection, query=vector, limit=fetch_limit,
            query_filter=query_filter, score_threshold=score_threshold,
            with_payload=True,
        ).points
        results = [
            {
                "id": str(h.id),
                "score": round(float(h.score), 4),
                "text": (h.payload or {}).get("text", ""),
                "index": (h.payload or {}).get("index"),
                "strategy": (h.payload or {}).get("strategy"),
                "source": (h.payload or {}).get("source"),
                "title": (h.payload or {}).get("title"),
                "product": (h.payload or {}).get("product"),
                "effective": (h.payload or {}).get("effective"),
                "version": (h.payload or {}).get("version"),
            }
            for h in hits
        ]
        if dedupe:
            return _dedupe_hits(results, top_k)
        return results[:top_k]

    @staticmethod
    def build_filter(product: str | None = None, effective_after: str | None = None) -> "models.Filter | None":
        """Turn the friendly `product` / `effective_after` request fields into
        a Qdrant filter. Returns None (no filter) if neither is given.

        `effective_after` is a "YYYY-MM-DD" string; it's converted to the same
        integer form stored at ingest time (`effective_int`) so we can express
        "only documents effective on or after this date" as a numeric range —
        exactly the filter that would have picked the 2026 fee schedule over
        the 2025 one on similarity score alone (see NOTES.md for the before/
        after comparison that motivated this).
        """
        conditions = []
        if product:
            conditions.append(models.FieldCondition(key="product", match=models.MatchValue(value=product)))
        if effective_after:
            try:
                threshold = int(effective_after.replace("-", ""))
            except ValueError:
                threshold = None
            if threshold is not None:
                conditions.append(models.FieldCondition(key="effective_int", range=models.Range(gte=threshold)))
        return models.Filter(must=conditions) if conditions else None

    # --- introspection --------------------------------------------------------
    def info(self) -> dict:
        if not self.client.collection_exists(self.collection):
            return {"exists": False, "name": self.collection, "points_count": 0,
                    "vector_dimension": None, "distance": None}
        c = self.client.get_collection(self.collection)
        return {
            "exists": True,
            "name": self.collection,
            "points_count": c.points_count or 0,
            "vector_dimension": self._vector_size(),
            "distance": "cosine",
        }

    def ping(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False

    def _vector_size(self) -> int:
        cfg = self.client.get_collection(self.collection).config.params.vectors
        return cfg.size if hasattr(cfg, "size") else next(iter(cfg.values())).size


# --- deduplication (Part 5, improvement #5) -----------------------------------
#
# The failure mode actually observed in this project (see NOTES.md): the
# `dynamic` strategy's overlap deliberately copies a trailing sentence
# VERBATIM into the next chunk, so it isn't lost at a boundary. That's
# correct behaviour for chunking — but it means two *adjacent* chunks can
# legitimately both surface for the same query, each burning a `top_k` slot
# on largely the same sentence. A generic text-similarity score (e.g.
# whole-chunk Jaccard) turned out to be too blunt to catch this reliably —
# the shared sentence gets diluted by each chunk's other, genuinely
# different content. What actually identifies this case is simpler and more
# precise: a long run of IDENTICAL characters between two chunks, because
# that's literally what the overlap mechanism produces.

def _shares_long_run(a: str, b: str, min_len: int = 50, stride: int = 8) -> bool:
    """True if a `min_len`-character run of `a` appears verbatim in `b`."""
    a_norm = " ".join(a.split())
    b_norm = " ".join(b.split())
    if len(a_norm) < min_len or len(b_norm) < min_len:
        return False
    for i in range(0, len(a_norm) - min_len + 1, stride):
        if a_norm[i : i + min_len] in b_norm:
            return True
    return False


def _dedupe_hits(hits: list[dict], top_k: int, min_shared_run: int = 50) -> list[dict]:
    """Walk hits best-score-first; keep a hit only if it doesn't share a long
    verbatim run of text with something already kept FROM THE SAME SOURCE
    document. That restriction matters: this corpus deliberately has two
    near-duplicate documents (the 2025 and 2026 fee schedules) that share a
    lot of boilerplate phrasing on purpose — comparing across sources would
    wrongly flag them as redundant with each other, when they're actually
    two different, both-legitimate facts. Restricting the check to same-
    source hits targets the real bug this fixes: adjacent chunks from ONE
    document, both carrying the same overlap-copied sentence."""
    selected: list[dict] = []
    for hit in hits:
        duplicate = any(
            kept.get("source") == hit.get("source") and _shares_long_run(hit["text"], kept["text"], min_shared_run)
            for kept in selected
        )
        if duplicate:
            continue
        selected.append(hit)
        if len(selected) >= top_k:
            break
    return selected
