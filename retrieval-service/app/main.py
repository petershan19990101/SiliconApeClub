import hashlib
import json
import math
import random
import uuid
from typing import Any, Dict, List, Optional

import httpx
import psycopg
from psycopg.rows import dict_row
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models import RetrievalRequest, RetrievalResponse, RetrievalResult

app = FastAPI(title="Silicon Ape Club Retrieval Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/retrieval/health")
def health() -> Dict[str, str]:
    return {"status": "UP"}


@app.post("/api/retrieval/search", response_model=RetrievalResponse)
def search(request: RetrievalRequest) -> RetrievalResponse:
    return _search(request, include_debug=False)


@app.post("/api/retrieval/debug", response_model=RetrievalResponse)
def debug(request: RetrievalRequest) -> RetrievalResponse:
    return _search(request, include_debug=True)


@app.post("/api/retrieval/sync/pending")
def sync_pending(limit: int = Query(default=10, ge=1, le=100)) -> Dict[str, Any]:
    with psycopg.connect(settings.postgres_dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM ks_sync_job
                WHERE status = 'pending'
                ORDER BY created_at ASC, id ASC
                LIMIT %s
                """,
                (limit,),
            )
            job_ids = [row[0] for row in cursor.fetchall()]
    results = [sync_job_by_id(job_id) for job_id in job_ids]
    return {"processed": len(results), "results": results}


@app.post("/api/retrieval/sync/jobs/{job_id}")
def sync_job(job_id: int) -> Dict[str, Any]:
    return sync_job_by_id(job_id)


def _search(request: RetrievalRequest, include_debug: bool) -> RetrievalResponse:
    trace_id = uuid.uuid4().hex
    query_embedding_result = embed_text_with_metadata(request.query)
    query_embedding = query_embedding_result["values"]
    candidates = load_candidates(request, query_embedding, request.policy.topK * 3)
    keyword_ranked = score_keywords(request.query, candidates)
    reranked = rerank(request.query, keyword_ranked, request.policy.rerankTopN)
    authorized: List[Dict[str, Any]] = []
    permission_checks: List[Dict[str, Any]] = []
    for item in reranked:
        permission = check_permission(item["id"], request)
        permission_checks.append({"chunkId": item["id"], **permission})
        if permission.get("allowed"):
            item["permissionMatchedBy"] = permission.get("permissionMatchedBy", "policy")
            authorized.append(item)
    results: List[RetrievalResult] = []
    for item in authorized[: request.policy.rerankTopN]:
        result = RetrievalResult(
            chunkId=str(item["id"]),
            content=item["chunk_text"],
            sourceTitle=item.get("source_title") or item.get("title") or "未知来源",
            wikiPageId=str(item["wiki_page_id"]) if item.get("wiki_page_id") is not None else None,
            wikiPageVersion=item.get("wiki_page_version"),
            knowledgeStatus=item["knowledge_status"],
            score=float(item.get("score", 0.0)),
            rerankScore=float(item.get("rerank_score", 0.0)),
            permissionMatchedBy=item.get("permissionMatchedBy", "policy"),
            whySelected=why_selected(item),
        )
        results.append(result)
        if request.policy.requireCitation:
            record_citation(trace_id, request, result)
    debug_payload = None
    if include_debug:
        debug_payload = {
            "candidateCount": len(candidates),
            "rerankedCount": len(reranked),
            "permissionChecks": permission_checks,
            "queryEmbeddingProvider": query_embedding_result["provider"],
            "queryEmbeddingModel": query_embedding_result["model"],
            "queryEmbeddingFallbackUsed": query_embedding_result["fallbackUsed"],
        }
    return RetrievalResponse(results=results, traceId=trace_id, debug=debug_payload)


def load_candidates(request: RetrievalRequest, query_embedding: List[float], limit: int) -> List[Dict[str, Any]]:
    vector = "[" + ",".join(f"{value:.6f}" for value in query_embedding) + "]"
    filters = ["c.knowledge_status = 'active'"]
    params: List[Any] = [vector]
    if request.actor.departmentId:
        filters.append("(c.department_tags IS NULL OR c.department_tags = '' OR c.department_tags LIKE %s)")
        params.append(f"%{request.actor.departmentId}%")
    if request.actor.positionCode:
        filters.append("(c.position_tags IS NULL OR c.position_tags = '' OR c.position_tags LIKE %s)")
        params.append(f"%{request.actor.positionCode}%")
    params.append(limit)
    sql = f"""
        SELECT c.id, c.chunk_text, c.chunk_summary, c.wiki_page_id, c.wiki_page_version,
               c.knowledge_status, c.metadata_json, c.department_tags, c.position_tags,
               COALESCE(p.title, d.name) AS title, 1 - (c.embedding <=> %s::vector) AS score
        FROM ks_chunk c
        LEFT JOIN ks_wiki_page p ON p.id = c.wiki_page_id
        LEFT JOIN ds_document d ON c.source_type = 'document' AND d.id = c.source_id
        WHERE {' AND '.join(filters)}
        ORDER BY c.embedding <=> %s::vector
        LIMIT %s
    """
    # vector is used twice, once for score and once for ORDER BY
    db_params = [params[0]] + params[1:-1] + [params[0], params[-1]]
    with psycopg.connect(settings.postgres_dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, db_params)
            columns = [column.name for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]


def sync_job_by_id(job_id: int) -> Dict[str, Any]:
    try:
        with psycopg.connect(settings.postgres_dsn) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM ks_sync_job WHERE id = %s FOR UPDATE", (job_id,))
                job = row_to_dict(cursor)
                if not job:
                    raise HTTPException(status_code=404, detail="Sync job not found")
                if job["status"] in ("completed", "success"):
                    return {"jobId": job_id, "status": "completed", "chunkCount": 0, "skipped": True}
                cursor.execute(
                    """
                    UPDATE ks_sync_job
                    SET status = 'running',
                        attempt_count = attempt_count + 1,
                        started_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP,
                        error_message = NULL
                    WHERE id = %s
                    """,
                    (job_id,),
                )
                if job.get("source_type") == "wiki_page":
                    result = sync_wiki_page(cursor, job)
                elif job.get("source_type") == "document":
                    result = sync_document(cursor, job)
                else:
                    raise ValueError(f"Unsupported sync source type: {job.get('source_type')}")
                cursor.execute(
                    """
                    UPDATE ks_sync_job
                    SET status = 'completed',
                        finished_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (job_id,),
                )
            conn.commit()
            return {"jobId": job_id, "status": "completed", **result}
    except HTTPException:
        raise
    except Exception as exc:
        mark_sync_failed(job_id, str(exc))
        return {"jobId": job_id, "status": "failed", "error": str(exc)}


def sync_wiki_page(cursor: Any, job: Dict[str, Any]) -> Dict[str, Any]:
    if job.get("source_type") != "wiki_page":
        raise ValueError(f"Unsupported sync source type: {job.get('source_type')}")
    cursor.execute(
        """
        SELECT id, title, summary, content, current_version, metadata_json, tags_json,
               owner_id, department_id, acl_policy_id, status
        FROM ks_wiki_page
        WHERE id = %s AND deleted = 0
        """,
        (job["source_id"],),
    )
    page = row_to_dict(cursor)
    if not page:
        raise ValueError(f"Wiki page {job['source_id']} not found")
    if page.get("status") != "active":
        raise ValueError(f"Wiki page {job['source_id']} is not active")

    source_version = int(job.get("source_version") or page.get("current_version") or 1)
    chunks = build_chunks(page)
    cursor.execute(
        """
        UPDATE ks_chunk
        SET knowledge_status = 'deprecated', updated_at = CURRENT_TIMESTAMP
        WHERE source_type = 'wiki_page' AND source_id = %s AND source_version = %s
        """,
        (page["id"], source_version),
    )

    tags_payload = parse_json(page.get("tags_json"))
    position_tags = normalize_tag_list(tags_payload.get("positions") if isinstance(tags_payload, dict) else "")
    department_tags = str(page["department_id"]) if page.get("department_id") is not None else ""
    embedding_profile = get_ai_profile("rag_embedding")
    embedding_model = embedding_profile.get("model_name") or settings.dashscope_embedding_model
    embedding_version = embedding_version_for_profile(embedding_profile)
    index_version = int(job["id"])
    inserted_ids: List[int] = []
    for index, chunk_text in enumerate(chunks, start=1):
        embedding_result = embed_text_with_metadata(chunk_text, embedding_profile)
        embedding = vector_literal(embedding_result["values"])
        embedding_model = embedding_result["model"]
        embedding_version = embedding_result["version"]
        metadata = {
            "sourceTitle": page.get("title"),
            "chunkOrdinal": index,
            "syncJobId": job["id"],
            "embeddingRealCall": embedding_result["realCall"],
            "embeddingFallbackUsed": embedding_result["fallbackUsed"],
            "embeddingFallbackReason": embedding_result.get("fallbackReason"),
        }
        cursor.execute(
            """
            INSERT INTO ks_chunk(source_type, source_id, source_version, wiki_page_id, wiki_page_version,
                content_hash, chunk_text, chunk_summary, metadata_json, acl_policy_id, acl_version,
                security_level, position_tags, department_tags, project_tags, knowledge_status,
                embedding_model, embedding_version, embedding, index_version)
            VALUES ('wiki_page', %s, %s, %s, %s, %s, %s, %s, %s, %s, 1,
                'internal', %s, %s, '', 'active', %s, %s, %s::vector, %s)
            RETURNING id
            """,
            (
                page["id"],
                source_version,
                page["id"],
                source_version,
                sha256(chunk_text),
                chunk_text,
                summarize_chunk(chunk_text),
                json.dumps(metadata, ensure_ascii=False),
                page.get("acl_policy_id"),
                position_tags,
                department_tags,
                embedding_model,
                embedding_version,
                embedding,
                index_version,
            ),
        )
        inserted_ids.append(cursor.fetchone()[0])

    content_hash = sha256("\n\n".join(chunks))
    cursor.execute(
        """
        INSERT INTO ks_index_record(source_type, source_id, source_version, wiki_page_id, wiki_page_version,
            content_hash, chunk_strategy_version, chunk_count, embedding_model, embedding_version,
            index_version, index_status, indexed_at)
        VALUES ('wiki_page', %s, %s, %s, %s, %s, 'paragraph-v1', %s, %s, %s, %s, 'completed', CURRENT_TIMESTAMP)
        """,
        (
            page["id"],
            source_version,
            page["id"],
            source_version,
            content_hash,
            len(chunks),
            embedding_model,
            embedding_version,
            index_version,
        ),
    )
    cursor.execute(
        """
        UPDATE ks_wiki_page
        SET sync_status = 'indexed', updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """,
        (page["id"],),
    )
    return {"sourceType": "wiki_page", "sourceId": page["id"], "chunkCount": len(inserted_ids), "chunkIds": inserted_ids}


def sync_document(cursor: Any, job: Dict[str, Any]) -> Dict[str, Any]:
    cursor.execute(
        """
        SELECT id, name, description, latest_parsed_text, current_version, tags_json,
               department_id, parse_status, status
        FROM ds_document
        WHERE id = %s AND deleted = 0
        """,
        (job["source_id"],),
    )
    document = row_to_dict(cursor)
    if not document:
        raise ValueError(f"Document {job['source_id']} not found")
    if document.get("parse_status") != "SUCCESS":
        raise ValueError(f"Document {job['source_id']} has not been parsed successfully")
    if not (document.get("latest_parsed_text") or "").strip():
        raise ValueError(f"Document {job['source_id']} parsed text is empty")

    source_version = int(job.get("source_version") or document.get("current_version") or 1)
    chunks = build_document_chunks(document)
    cursor.execute(
        """
        UPDATE ks_chunk
        SET knowledge_status = 'deprecated', updated_at = CURRENT_TIMESTAMP
        WHERE source_type = 'document' AND source_id = %s AND source_version = %s
        """,
        (document["id"], source_version),
    )

    department_tags = str(document["department_id"]) if document.get("department_id") is not None else ""
    embedding_profile = get_ai_profile("rag_embedding")
    embedding_model = embedding_profile.get("model_name") or settings.dashscope_embedding_model
    embedding_version = embedding_version_for_profile(embedding_profile)
    index_version = int(job["id"])
    inserted_ids: List[int] = []
    for index, chunk_text in enumerate(chunks, start=1):
        metadata = {
            "sourceTitle": document.get("name"),
            "chunkOrdinal": index,
            "syncJobId": job["id"],
            "source": "document",
        }
        embedding_result = embed_text_with_metadata(chunk_text, embedding_profile)
        metadata["embeddingRealCall"] = embedding_result["realCall"]
        metadata["embeddingFallbackUsed"] = embedding_result["fallbackUsed"]
        metadata["embeddingFallbackReason"] = embedding_result.get("fallbackReason")
        embedding_model = embedding_result["model"]
        embedding_version = embedding_result["version"]
        cursor.execute(
            """
            INSERT INTO ks_chunk(source_type, source_id, source_version, wiki_page_id, wiki_page_version,
                content_hash, chunk_text, chunk_summary, metadata_json, acl_policy_id, acl_version,
                security_level, position_tags, department_tags, project_tags, knowledge_status,
                embedding_model, embedding_version, embedding, index_version)
            VALUES ('document', %s, %s, NULL, NULL, %s, %s, %s, %s, 1, 1,
                'internal', '', %s, '', 'active', %s, %s, %s::vector, %s)
            RETURNING id
            """,
            (
                document["id"],
                source_version,
                sha256(chunk_text),
                chunk_text,
                summarize_chunk(chunk_text),
                json.dumps(metadata, ensure_ascii=False),
                department_tags,
                embedding_model,
                embedding_version,
                vector_literal(embedding_result["values"]),
                index_version,
            ),
        )
        inserted_ids.append(cursor.fetchone()[0])

    content_hash = sha256("\n\n".join(chunks))
    cursor.execute(
        """
        INSERT INTO ks_index_record(source_type, source_id, source_version, wiki_page_id, wiki_page_version,
            content_hash, chunk_strategy_version, chunk_count, embedding_model, embedding_version,
            index_version, index_status, indexed_at)
        VALUES ('document', %s, %s, NULL, NULL, %s, 'paragraph-v1', %s, %s, %s, %s, 'completed', CURRENT_TIMESTAMP)
        """,
        (
            document["id"],
            source_version,
            content_hash,
            len(chunks),
            embedding_model,
            embedding_version,
            index_version,
        ),
    )
    cursor.execute(
        """
        UPDATE ds_document
        SET rag_status = 'SUCCESS',
            rag_finished_at = CURRENT_TIMESTAMP,
            status = CASE WHEN status IN ('PUBLISHED', 'REJECTED', 'LOCKED') THEN status ELSE 'RAG_READY' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """,
        (document["id"],),
    )
    return {"sourceType": "document", "sourceId": document["id"], "chunkCount": len(inserted_ids), "chunkIds": inserted_ids}


def mark_sync_failed(job_id: int, error: str) -> None:
    with psycopg.connect(settings.postgres_dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE ks_sync_job
                SET status = 'failed',
                    error_message = %s,
                    finished_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (error[:2000], job_id),
            )
        conn.commit()


def score_keywords(query: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    terms = [term.lower() for term in query.split() if term.strip()]
    for item in candidates:
        text = (item.get("chunk_text") or "").lower()
        title = (item.get("title") or "").lower()
        keyword_hits = sum(1 for term in terms if term in text or term in title)
        item["score"] = float(item.get("score") or 0.0) + keyword_hits * 0.05
    return sorted(candidates, key=lambda item: item.get("score", 0.0), reverse=True)


def get_ai_profile(purpose: str) -> Dict[str, Any]:
    try:
        with psycopg.connect(settings.postgres_dsn) as conn:
            with conn.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    """
                    SELECT id, profile_code, profile_name, provider, purpose, endpoint, api_key, model_name,
                           dimensions, timeout_seconds, enabled, default_profile, fallback_enabled, config_json
                    FROM sys_ai_model_profile
                    WHERE purpose = %s AND enabled = 1
                    ORDER BY default_profile DESC, id ASC
                    LIMIT 1
                    """,
                    (purpose,),
                )
                row = cursor.fetchone()
                if row:
                    return dict(row)
    except Exception:
        pass
    if purpose == "rag_embedding":
        return {
            "profile_code": "env_dashscope_embedding",
            "provider": "openai_compatible",
            "purpose": purpose,
            "endpoint": f"{settings.dashscope_base_url.rstrip('/')}/embeddings",
            "api_key": settings.dashscope_api_key,
            "model_name": settings.dashscope_embedding_model,
            "dimensions": settings.dashscope_embedding_dimensions,
            "timeout_seconds": 20,
            "fallback_enabled": 1,
        }
    if purpose == "rag_rerank":
        return {
            "profile_code": "env_dashscope_rerank",
            "provider": "dashscope_rerank",
            "purpose": purpose,
            "endpoint": settings.dashscope_rerank_endpoint,
            "api_key": settings.dashscope_api_key,
            "model_name": settings.dashscope_rerank_model,
            "timeout_seconds": 20,
            "fallback_enabled": 1,
        }
    return {}


def embedding_version_for_profile(profile: Dict[str, Any]) -> str:
    if not profile.get("api_key"):
        return "fallback-local-hash-v1"
    return f"{profile.get('provider') or 'provider'}:{profile.get('profile_code') or profile.get('model_name')}"


def embed_text(text: str) -> List[float]:
    return embed_text_with_metadata(text)["values"]


def embed_text_with_metadata(text: str, profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    active_profile = profile or get_ai_profile("rag_embedding")
    dimensions = int(active_profile.get("dimensions") or settings.dashscope_embedding_dimensions)
    api_key = active_profile.get("api_key") or ""
    endpoint = active_profile.get("endpoint") or f"{settings.dashscope_base_url.rstrip('/')}/embeddings"
    model = active_profile.get("model_name") or settings.dashscope_embedding_model
    provider = active_profile.get("provider") or "local-hash"
    if api_key:
        try:
            with httpx.Client(timeout=int(active_profile.get("timeout_seconds") or 20)) as client:
                response = client.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": model,
                        "input": text,
                        "dimensions": dimensions,
                    },
                )
                response.raise_for_status()
                data = response.json()
                embedding = data["data"][0]["embedding"]
                if len(embedding) == dimensions:
                    return {
                        "values": [float(value) for value in embedding],
                        "provider": provider,
                        "model": model,
                        "version": embedding_version_for_profile(active_profile),
                        "realCall": True,
                        "fallbackUsed": False,
                    }
        except Exception as exc:
            if not truthy(active_profile.get("fallback_enabled", 1)):
                raise
            return {
                "values": local_embedding(text, dimensions),
                "provider": "local-hash",
                "model": model,
                "version": "fallback-local-hash-v1",
                "realCall": False,
                "fallbackUsed": True,
                "fallbackReason": str(exc),
            }
    return {
        "values": local_embedding(text, dimensions),
        "provider": "local-hash",
        "model": model,
        "version": "fallback-local-hash-v1",
        "realCall": False,
        "fallbackUsed": True,
        "fallbackReason": "api_key_not_configured",
    }


def local_embedding(text: str, dimensions: int) -> List[float]:
    seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:16], 16)
    random.seed(seed)
    values = [(random.random() - 0.5) / 10 for _ in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return [value / norm for value in values]


def vector_literal(values: List[float]) -> str:
    return "[" + ",".join(f"{value:.6f}" for value in values) + "]"


def build_chunks(page: Dict[str, Any], max_chars: int = 1200) -> List[str]:
    content = "\n\n".join(
        value.strip()
        for value in [page.get("title") or "", page.get("summary") or "", page.get("content") or ""]
        if value and value.strip()
    )
    paragraphs = [item.strip() for item in content.replace("\r\n", "\n").split("\n\n") if item.strip()]
    chunks: List[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(paragraph[index : index + max_chars] for index in range(0, len(paragraph), max_chars))
            continue
        candidate = paragraph if not current else current + "\n\n" + paragraph
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = paragraph
    if current:
        chunks.append(current)
    return chunks or [page.get("title") or f"wiki_page:{page.get('id')}"]


def build_document_chunks(document: Dict[str, Any], max_chars: int = 1200) -> List[str]:
    content = "\n\n".join(
        value.strip()
        for value in [
            document.get("name") or "",
            document.get("description") or "",
            document.get("latest_parsed_text") or "",
        ]
        if value and value.strip()
    )
    paragraphs = [item.strip() for item in content.replace("\r\n", "\n").split("\n\n") if item.strip()]
    chunks: List[str] = []
    current = ""
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(paragraph[index : index + max_chars] for index in range(0, len(paragraph), max_chars))
            continue
        candidate = paragraph if not current else current + "\n\n" + paragraph
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = paragraph
    if current:
        chunks.append(current)
    return chunks or [document.get("name") or f"document:{document.get('id')}"]


def summarize_chunk(text: str) -> str:
    safe = " ".join((text or "").split())
    return safe[:240]


def rerank(query: str, candidates: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    profile = get_ai_profile("rag_rerank")
    api_key = profile.get("api_key") or ""
    if api_key and candidates:
        try:
            documents = [item["chunk_text"] for item in candidates[:limit]]
            with httpx.Client(timeout=int(profile.get("timeout_seconds") or 20)) as client:
                response = client.post(
                    profile.get("endpoint") or settings.dashscope_rerank_endpoint,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": profile.get("model_name") or settings.dashscope_rerank_model, "query": query, "documents": documents, "top_n": limit},
                )
                response.raise_for_status()
                data = response.json()
                ranked: List[Dict[str, Any]] = []
                for result in data.get("results", []):
                    index = result.get("index")
                    if index is not None and index < len(candidates):
                        item = dict(candidates[index])
                        item["rerank_score"] = float(result.get("relevance_score", item.get("score", 0.0)))
                        ranked.append(item)
                if ranked:
                    return ranked
        except Exception:
            if not truthy(profile.get("fallback_enabled", 1)):
                raise
    ranked = candidates[:limit]
    for index, item in enumerate(ranked):
        item["rerank_score"] = float(item.get("score", 0.0)) - index * 0.001
    return ranked


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).lower() not in {"", "0", "false", "none"}


def check_permission(chunk_id: Any, request: RetrievalRequest) -> Dict[str, Any]:
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(
                f"{settings.siliconapeclub_server_base_url.rstrip('/')}/api/internal/knowledge/chunks/{chunk_id}/permission-check",
                headers={"X-Service-Token": settings.service_token},
                json={
                    "actorType": request.actor.type,
                    "actorId": request.actor.id,
                    "departmentId": request.actor.departmentId,
                    "positionCode": request.actor.positionCode,
                    "action": "use_in_rag",
                },
            )
            response.raise_for_status()
            return response.json().get("data") or {"allowed": False}
    except Exception:
        return {"allowed": False, "permissionMatchedBy": "permission_error"}


def record_citation(trace_id: str, request: RetrievalRequest, result: RetrievalResult) -> None:
    try:
        with httpx.Client(timeout=5) as client:
            client.post(
                f"{settings.siliconapeclub_server_base_url.rstrip('/')}/api/internal/knowledge/citations",
                headers={"X-Service-Token": settings.service_token},
                json={
                    "traceId": trace_id,
                    "actorType": request.actor.type,
                    "actorId": request.actor.id,
                    "queryText": request.query,
                    "chunkId": result.chunkId,
                    "wikiPageId": result.wikiPageId,
                    "wikiPageVersion": result.wikiPageVersion,
                    "score": result.score,
                    "rerankScore": result.rerankScore,
                    "permissionMatchedBy": result.permissionMatchedBy,
                    "taskType": request.task.type,
                },
            )
    except Exception:
        pass


def row_to_dict(cursor: Any) -> Dict[str, Any]:
    row = cursor.fetchone()
    if not row:
        return {}
    columns = [column.name for column in cursor.description]
    return dict(zip(columns, row))


def parse_json(value: Any) -> Any:
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except Exception:
        return {}


def normalize_tag_list(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return ",".join(str(item) for item in value if str(item).strip())
    return str(value)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def why_selected(item: Dict[str, Any]) -> str:
    return (
        f"语义分 {float(item.get('score', 0.0)):.3f}，"
        f"重排分 {float(item.get('rerank_score', 0.0)):.3f}，"
        f"权限命中 {item.get('permissionMatchedBy', 'policy')}。"
    )
