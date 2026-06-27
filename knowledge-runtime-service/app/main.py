import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query

from .config import settings
from .db import get_connection
from .models import FeedbackRequest, ReviewRequest, RuntimeContextResponse, WikiProposalRequest

app = FastAPI(title="Knowledge Runtime Service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "UP"}


@app.get("/api/ai-employees/{ai_employee_id}/runtime-context", response_model=RuntimeContextResponse)
def runtime_context(
    ai_employee_id: int,
    taskType: Optional[str] = Query(default=None),
    projectId: Optional[str] = Query(default=None),
) -> RuntimeContextResponse:
    with get_connection() as conn:
        ai = fetch_one(
            conn,
            """
            SELECT id, code, name, description, position_code, department_id, enabled, status
            FROM ds_ai_employee WHERE id = %s
            """,
            (ai_employee_id,),
        )
        if not ai or int(ai.get("enabled") or 0) != 1:
            raise HTTPException(status_code=404, detail="AI employee not found or disabled")

        packages = fetch_all(
            conn,
            """
            SELECT p.id, p.code, p.name, p.description, p.position_code, p.default_scope_json,
                   p.rules_json, p.status
            FROM ks_ai_employee_package ap
            JOIN ks_position_package p ON p.id = ap.package_id
            WHERE ap.ai_employee_id = %s AND ap.enabled = 1 AND p.status IN ('active', 'trial', 'draft')
            ORDER BY p.id
            """,
            (ai_employee_id,),
        )
        primary_package_id = packages[0]["id"] if packages else None
        must_read = load_package_wiki(conn, primary_package_id)
        default_scope = merge_json([item.get("default_scope_json") for item in packages])
        rules = merge_json([item.get("rules_json") for item in packages])
        security_context = {
            "actorType": "AI_EMPLOYEE",
            "actorId": str(ai["id"]),
            "departmentId": ai.get("department_id"),
            "positionCode": ai.get("position_code"),
            "taskType": taskType,
            "projectId": projectId,
        }
        profile_hash = sha256(json.dumps({"ai": ai, "packages": packages, "scope": default_scope, "rules": rules}, default=str))
        session_id = uuid.uuid4().hex
        expires_at = datetime.utcnow() + timedelta(minutes=settings.runtime_session_ttl_minutes)
        execute(
            conn,
            """
            INSERT INTO ks_runtime_session(session_id, ai_employee_id, position_package_id, department_id,
                project_id, task_type, security_context, runtime_profile_hash, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                session_id,
                ai_employee_id,
                primary_package_id,
                ai.get("department_id"),
                projectId,
                taskType,
                json.dumps(security_context, ensure_ascii=False),
                profile_hash,
                expires_at,
            ),
        )
        conn.commit()
        return RuntimeContextResponse(
            sessionId=session_id,
            aiEmployee=normalize(ai),
            packages=[normalize(item) for item in packages],
            mustReadWiki=[normalize(item) for item in must_read],
            defaultRetrievalScope=default_scope,
            permissionBoundary=rules,
            securityContext=security_context,
        )


@app.get("/api/position-packages/{package_id}/runtime-profile")
def runtime_profile(package_id: int) -> Dict[str, Any]:
    with get_connection() as conn:
        package = fetch_one(
            conn,
            "SELECT id, code, name, description, position_code, default_scope_json, rules_json, status FROM ks_position_package WHERE id = %s",
            (package_id,),
        )
        if not package:
            raise HTTPException(status_code=404, detail="Position package not found")
        return {
            "package": normalize(package),
            "mustReadWiki": [normalize(item) for item in load_package_wiki(conn, package_id)],
            "defaultRetrievalScope": parse_json(package.get("default_scope_json")),
            "rules": parse_json(package.get("rules_json")),
        }


@app.get("/api/wiki/pages/{page_id}/ai-readable")
def ai_readable_wiki(page_id: int) -> Dict[str, Any]:
    with get_connection() as conn:
        page = fetch_one(
            conn,
            """
            SELECT id, title, page_type, summary, content, metadata_json, tags_json, current_version,
                   status, sync_status, health_status, heat_score, owner_id, department_id, acl_policy_id
            FROM ks_wiki_page WHERE id = %s AND deleted = 0
            """,
            (page_id,),
        )
        if not page:
            raise HTTPException(status_code=404, detail="Wiki page not found")
        result = normalize(page)
        result["metadata"] = parse_json(page.get("metadata_json"))
        result["tags"] = parse_json(page.get("tags_json"))
        result["aiSummary"] = page.get("summary") or summarize(page.get("content") or "")
        return result


@app.post("/api/knowledge/feedback")
def create_feedback(request: FeedbackRequest) -> Dict[str, Any]:
    feedback_id = uuid.uuid4().hex
    with get_connection() as conn:
        execute(
            conn,
            """
            INSERT INTO ks_feedback(feedback_id, actor_type, actor_id, feedback_type, target_type,
                target_id, severity, content, metadata_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                feedback_id,
                request.actorType,
                request.actorId,
                request.feedbackType,
                request.targetType,
                request.targetId,
                request.severity,
                request.content,
                json.dumps(request.metadata, ensure_ascii=False),
            ),
        )
        conn.commit()
    return {"feedbackId": feedback_id, "status": "open"}


@app.post("/api/wiki/proposals")
def create_proposal(request: WikiProposalRequest) -> Dict[str, Any]:
    proposal_id = uuid.uuid4().hex
    with get_connection() as conn:
        execute(
            conn,
            """
            INSERT INTO ks_wiki_proposal(proposal_id, source_task_memory_id, created_by_actor_type,
                created_by_actor_id, suggested_template, title, draft_content, evidence_json,
                citation_ids, applicable_positions, risk_level)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                proposal_id,
                request.sourceTaskMemoryId,
                request.createdByActorType,
                request.createdByActorId,
                request.suggestedTemplate,
                request.title,
                request.draftContent,
                json.dumps(request.evidence, ensure_ascii=False),
                ",".join(request.citationIds),
                ",".join(request.applicablePositions),
                request.riskLevel,
            ),
        )
        conn.commit()
    return {"proposalId": proposal_id, "reviewStatus": "pending"}


@app.get("/api/wiki/proposals/{proposal_id}")
def get_proposal(proposal_id: str) -> Dict[str, Any]:
    with get_connection() as conn:
        proposal = fetch_one(conn, "SELECT * FROM ks_wiki_proposal WHERE proposal_id = %s", (proposal_id,))
        if not proposal:
            raise HTTPException(status_code=404, detail="Wiki proposal not found")
        return normalize(proposal)


@app.post("/api/wiki/proposals/{proposal_id}/approve")
def approve_proposal(proposal_id: str, request: ReviewRequest) -> Dict[str, Any]:
    with get_connection() as conn:
        proposal = fetch_one(conn, "SELECT * FROM ks_wiki_proposal WHERE proposal_id = %s", (proposal_id,))
        if not proposal:
            raise HTTPException(status_code=404, detail="Wiki proposal not found")
        if proposal.get("review_status") == "approved":
            return normalize(proposal)
        page_id = fetch_value(
            conn,
            """
            INSERT INTO ks_wiki_page(title, page_type, summary, content, metadata_json, tags_json,
                owner_id, department_id, acl_policy_id, created_by, status, sync_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, 1, %s, 'active', 'indexing')
            RETURNING id
            """,
            (
                proposal["title"],
                proposal.get("suggested_template") or "ai_proposal",
                summarize(proposal.get("draft_content") or ""),
                proposal.get("draft_content") or "",
                proposal.get("evidence_json"),
                json.dumps({"positions": proposal.get("applicable_positions")}, ensure_ascii=False),
                request.reviewerId,
                request.reviewerId,
            ),
        )
        execute(
            conn,
            """
            INSERT INTO ks_wiki_page_version(page_id, version, title, content, metadata_json,
                author_id, author_name, status, summary)
            VALUES (%s, 1, %s, %s, %s, %s, %s, 'published', %s)
            """,
            (
                page_id,
                proposal["title"],
                proposal.get("draft_content") or "",
                proposal.get("evidence_json"),
                request.reviewerId,
                "Knowledge Runtime",
                summarize(proposal.get("draft_content") or ""),
            ),
        )
        execute(
            conn,
            """
            UPDATE ks_wiki_proposal
            SET review_status = 'approved', reviewer_id = %s, review_comment = %s,
                published_page_id = %s, published_page_version = 1, updated_at = CURRENT_TIMESTAMP
            WHERE proposal_id = %s
            """,
            (request.reviewerId, request.reviewComment, page_id, proposal_id),
        )
        sync_job_id = fetch_value(
            conn,
            """
            INSERT INTO ks_sync_job(source_type, source_id, source_version, status, requested_by, requested_by_name)
            VALUES ('wiki_page', %s, 1, 'pending', %s, 'Knowledge Runtime') RETURNING id
            """,
            (page_id, request.reviewerId),
        )
        conn.commit()
        return {"proposalId": proposal_id, "reviewStatus": "approved", "publishedPageId": page_id, "syncJobId": sync_job_id}


@app.post("/api/wiki/proposals/{proposal_id}/reject")
def reject_proposal(proposal_id: str, request: ReviewRequest) -> Dict[str, Any]:
    with get_connection() as conn:
        execute(
            conn,
            """
            UPDATE ks_wiki_proposal
            SET review_status = 'rejected', reviewer_id = %s, review_comment = %s, updated_at = CURRENT_TIMESTAMP
            WHERE proposal_id = %s
            """,
            (request.reviewerId, request.reviewComment, proposal_id),
        )
        conn.commit()
    return {"proposalId": proposal_id, "reviewStatus": "rejected"}


def load_package_wiki(conn: Any, package_id: Optional[int]) -> List[Dict[str, Any]]:
    if not package_id:
        return []
    return fetch_all(
        conn,
        """
        SELECT p.id, p.title, p.page_type, p.summary, p.current_version, p.status, p.sync_status,
               i.required, i.sort_order
        FROM ks_position_package_item i
        JOIN ks_wiki_page p ON p.id = i.item_id AND i.item_type = 'wiki_page'
        WHERE i.package_id = %s AND p.deleted = 0
        ORDER BY i.required DESC, i.sort_order ASC, p.id ASC
        """,
        (package_id,),
    )


def fetch_one(conn: Any, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(conn: Any, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def fetch_value(conn: Any, sql: str, params: tuple = ()) -> Any:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return next(iter(row.values())) if row else None


def execute(conn: Any, sql: str, params: tuple = ()) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)


def parse_json(value: Any) -> Dict[str, Any]:
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    try:
        return json.loads(value)
    except Exception:
        return {}


def merge_json(values: List[Any]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    for value in values:
        merged.update(parse_json(value))
    return merged


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


def summarize(text: str) -> str:
    safe = " ".join((text or "").split())
    return safe[:240]


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
