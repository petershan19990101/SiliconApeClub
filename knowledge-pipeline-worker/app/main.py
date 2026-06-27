import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query

from .config import settings
from .db import get_connection
from .models import DocumentToWikiRequest

app = FastAPI(title="Knowledge Pipeline Worker", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "UP"}


@app.get("/api/pipeline/jobs")
def list_jobs(status: Optional[str] = None, limit: int = Query(default=100, ge=1, le=200)) -> List[Dict[str, Any]]:
    params: List[Any] = []
    where = ""
    if status:
        where = "WHERE status = %s"
        params.append(status)
    params.append(limit)
    with get_connection() as conn:
        return fetch_all(
            conn,
            f"""
            SELECT id, job_type, source_type, source_id, source_version, target_type, target_id,
                   status, attempt_count, error_message, result_json, created_by,
                   started_at, finished_at, created_at, updated_at
            FROM ks_pipeline_job {where}
            ORDER BY created_at DESC
            LIMIT %s
            """,
            tuple(params),
        )


@app.get("/api/pipeline/jobs/{job_id}")
def get_job(job_id: int) -> Dict[str, Any]:
    with get_connection() as conn:
        job = fetch_one(conn, "SELECT * FROM ks_pipeline_job WHERE id = %s", (job_id,))
        if not job:
            raise HTTPException(status_code=404, detail="Pipeline job not found")
        return normalize(job)


@app.post("/api/pipeline/documents/{document_id}/to-wiki")
def document_to_wiki(document_id: int, request: DocumentToWikiRequest) -> Dict[str, Any]:
    with get_connection() as conn:
        document = fetch_one(conn, "SELECT * FROM ds_document WHERE id = %s AND deleted = 0", (document_id,))
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        if document.get("parse_status") != "SUCCESS":
            raise HTTPException(status_code=409, detail="Document has not been parsed successfully")
        if not (document.get("latest_parsed_text") or "").strip():
            raise HTTPException(status_code=409, detail="Document parsed text is empty")

        job_id = create_job(conn, document, request)
        try:
            wiki_page_id = create_wiki_page(conn, document, request)
            sync_job_id = create_sync_job(conn, wiki_page_id, request.actorId)
            # The retrieval service uses a separate database connection, so the
            # sync job must be committed before the cross-process indexing call.
            conn.commit()
            index_result = trigger_index(sync_job_id)
            result = {
                "documentId": document_id,
                "documentVersion": document.get("current_version"),
                "wikiPageId": wiki_page_id,
                "syncJobId": sync_job_id,
                "indexResult": index_result,
            }
            execute(
                conn,
                """
                UPDATE ks_pipeline_job
                SET target_type = 'wiki_page',
                    target_id = %s,
                    status = 'completed',
                    result_json = %s,
                    finished_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (wiki_page_id, json.dumps(result, ensure_ascii=False), job_id),
            )
            mark_document_ready(conn, document_id, request)
            record_document_audit(conn, document, request, wiki_page_id)
            record_trace(conn, request, "knowledge_pipeline_worker.document_to_wiki", "document", str(document_id), "success", result)
            notify(conn, request, "info", "文档已生成 LLM Wiki", f"{document.get('name')} 已由独立 Worker 生成 Wiki 并同步 RAG。", result)
            conn.commit()
            return get_job(job_id)
        except Exception as exc:
            error = str(exc)
            execute(
                conn,
                """
                UPDATE ks_pipeline_job
                SET status = 'failed', error_message = %s, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (error, job_id),
            )
            metadata = {"documentId": document_id, "error": error}
            record_trace(conn, request, "knowledge_pipeline_worker.document_to_wiki", "document", str(document_id), "failed", metadata)
            notify(conn, request, "high", "文档生成 LLM Wiki 失败", error, metadata)
            conn.commit()
            raise HTTPException(status_code=500, detail=error)


def create_job(conn: Any, document: Dict[str, Any], request: DocumentToWikiRequest) -> int:
    return fetch_value(
        conn,
        """
        INSERT INTO ks_pipeline_job(job_type, source_type, source_id, source_version, status,
            attempt_count, created_by, started_at, updated_at)
        VALUES ('document_to_wiki', 'document', %s, %s, 'running', 1, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        """,
        (document["id"], document.get("current_version"), request.actorId),
    )


def create_wiki_page(conn: Any, document: Dict[str, Any], request: DocumentToWikiRequest) -> int:
    title = request.title or document.get("name") or f"Silicon Ape Club Document {document['id']}"
    content = build_wiki_content(document, title)
    summary = request.summary or summarize(document.get("latest_parsed_text") or "")
    metadata = {
        "sourceType": "admin_document",
        "sourceDocumentId": document["id"],
        "sourceDocumentVersion": document.get("current_version"),
        "sourceFileName": document.get("latest_source_file"),
        "parseEngine": document.get("parse_engine"),
        "pipeline": "knowledge-pipeline-worker",
    }
    tags = request.tags if request.tags is not None else parse_json_list(document.get("tags_json"))
    if not tags:
        tags = ["silicon-ape-club", "pipeline"]
    status = "active" if request.publish else "draft"
    sync_status = "indexing" if request.publish else "not_indexed"
    wiki_page_id = fetch_value(
        conn,
        """
        INSERT INTO ks_wiki_page(title, page_type, summary, content, metadata_json, tags_json,
            owner_id, department_id, acl_policy_id, created_by, status, sync_status)
        VALUES (%s, 'document', %s, %s, %s, %s, %s, %s, 1, %s, %s, %s)
        RETURNING id
        """,
        (
            title,
            summary,
            content,
            json.dumps(metadata, ensure_ascii=False),
            json.dumps(tags, ensure_ascii=False),
            request.actorId,
            document.get("department_id"),
            request.actorId,
            status,
            sync_status,
        ),
    )
    execute(
        conn,
        """
        INSERT INTO ks_wiki_page_version(page_id, version, title, content, metadata_json,
            author_id, author_name, status, summary)
        VALUES (%s, 1, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            wiki_page_id,
            title,
            content,
            json.dumps(metadata, ensure_ascii=False),
            request.actorId,
            request.actorName,
            "published" if request.publish else "draft",
            summary,
        ),
    )
    return wiki_page_id


def create_sync_job(conn: Any, wiki_page_id: int, actor_id: int) -> int:
    return fetch_value(
        conn,
        """
        INSERT INTO ks_sync_job(source_type, source_id, source_version, status, requested_by, requested_by_name)
        VALUES ('wiki_page', %s, 1, 'pending', %s, 'Knowledge Pipeline Worker')
        RETURNING id
        """,
        (wiki_page_id, actor_id),
    )


def trigger_index(sync_job_id: int) -> Dict[str, Any]:
    with httpx.Client(timeout=60) as client:
        response = client.post(f"{settings.retrieval_base_url.rstrip('/')}/api/retrieval/sync/jobs/{sync_job_id}")
        response.raise_for_status()
        return response.json()


def mark_document_ready(conn: Any, document_id: int, request: DocumentToWikiRequest) -> None:
    execute(
        conn,
        """
        UPDATE ds_document
        SET status = 'RAG_READY',
            rag_status = 'SUCCESS',
            rag_finished_at = CURRENT_TIMESTAMP,
            rag_attempt_count = COALESCE(rag_attempt_count, 0) + 1,
            rag_last_run_by = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        """,
        (request.actorName, document_id),
    )


def record_document_audit(conn: Any, document: Dict[str, Any], request: DocumentToWikiRequest, wiki_page_id: int) -> None:
    execute(
        conn,
        """
        INSERT INTO ds_document_audit(document_id, version, action, operator_id, operator_name, comment)
        VALUES (%s, %s, 'PIPELINE_TO_WIKI', %s, %s, %s)
        """,
        (
            document["id"],
            document.get("current_version"),
            request.actorId,
            request.actorName,
            f"独立 Knowledge Pipeline Worker 已生成 LLM Wiki 页面 #{wiki_page_id}",
        ),
    )


def record_trace(
    conn: Any,
    request: DocumentToWikiRequest,
    action: str,
    target_type: str,
    target_id: str,
    result_status: str,
    metadata: Dict[str, Any],
) -> None:
    execute(
        conn,
        """
        INSERT INTO ks_audit_trace(trace_id, actor_type, actor_id, action, target_type, target_id, result_status, metadata_json)
        VALUES (%s, 'USER', %s, %s, %s, %s, %s, %s)
        """,
        (
            uuid.uuid4().hex,
            str(request.actorId),
            action,
            target_type,
            target_id,
            result_status,
            json.dumps(metadata, ensure_ascii=False),
        ),
    )


def notify(conn: Any, request: DocumentToWikiRequest, severity: str, title: str, content: str, metadata: Dict[str, Any]) -> None:
    execute(
        conn,
        """
        INSERT INTO ks_notification(recipient_type, recipient_id, severity, title, content, metadata_json)
        VALUES ('USER', %s, %s, %s, %s, %s)
        """,
        (str(request.actorId), severity, title, content, json.dumps(metadata, ensure_ascii=False)),
    )


def build_wiki_content(document: Dict[str, Any], title: str) -> str:
    return (
        f"# {title}\n\n"
        f"> 来源：硅基猿猴俱乐部管理台文档 #{document['id']} / v{document.get('current_version')} / "
        f"{document.get('latest_source_file') or '未命名源文件'}\n\n"
        f"{document.get('latest_parsed_text') or ''}"
    )


def summarize(text: str) -> str:
    safe = " ".join((text or "").split())
    return safe[:240]


def parse_json_list(value: Any) -> List[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except Exception:
        return []
    return []


def fetch_one(conn: Any, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(conn: Any, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [normalize(row) for row in cur.fetchall()]


def fetch_value(conn: Any, sql: str, params: tuple = ()) -> Any:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return next(iter(row.values())) if row else None


def execute(conn: Any, sql: str, params: tuple = ()) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)


def normalize(row: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in row.items():
        camel = to_camel(key)
        if isinstance(value, datetime):
            result[camel] = value.isoformat()
        else:
            result[camel] = value
    return result


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])
