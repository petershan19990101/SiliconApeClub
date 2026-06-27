import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query

from .db import get_connection
from .models import PromoteRequest, TaskMemoryPatch, TaskMemoryRequest

app = FastAPI(title="Task Memory Service", version="0.1.0")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "UP"}


@app.post("/api/task-memories")
def create_task_memory(request: TaskMemoryRequest) -> Dict[str, Any]:
    task_memory_id = uuid.uuid4().hex
    with get_connection() as conn:
        execute(
            conn,
            """
            INSERT INTO ks_task_memory(task_memory_id, ai_employee_id, runtime_session_id, task_id,
                task_goal, input_summary, query_log, retrieved_chunk_ids, cited_chunk_ids,
                output_summary, human_feedback, success_status, metadata_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                task_memory_id,
                request.aiEmployeeId,
                request.runtimeSessionId,
                request.taskId,
                request.taskGoal,
                request.inputSummary,
                json.dumps(request.queryLog, ensure_ascii=False),
                ",".join(request.retrievedChunkIds),
                ",".join(request.citedChunkIds),
                request.outputSummary,
                request.humanFeedback,
                request.successStatus,
                json.dumps(request.metadata, ensure_ascii=False),
            ),
        )
        if request.citedChunkIds:
            cited_chunk_ids = [int(item) for item in request.citedChunkIds if str(item).isdigit()]
            if cited_chunk_ids:
                execute(
                    conn,
                    """
                    UPDATE ks_citation_log
                    SET task_memory_id = %s, runtime_session_id = COALESCE(runtime_session_id, %s)
                    WHERE chunk_id = ANY(%s::bigint[])
                    """,
                    (task_memory_id, request.runtimeSessionId, cited_chunk_ids),
                )
        conn.commit()
    return {"taskMemoryId": task_memory_id, "promoteStatus": "none"}


@app.get("/api/task-memories")
def list_task_memories(
    aiEmployeeId: Optional[int] = Query(default=None),
    promoteStatus: Optional[str] = Query(default=None),
) -> List[Dict[str, Any]]:
    filters: List[str] = []
    params: List[Any] = []
    if aiEmployeeId is not None:
        filters.append("ai_employee_id = %s")
        params.append(aiEmployeeId)
    if promoteStatus:
        filters.append("promote_status = %s")
        params.append(promoteStatus)
    where = "WHERE " + " AND ".join(filters) if filters else ""
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            f"SELECT * FROM ks_task_memory {where} ORDER BY created_at DESC LIMIT 100",
            tuple(params),
        )
        return [normalize(row) for row in rows]


@app.get("/api/task-memories/{task_memory_id}")
def get_task_memory(task_memory_id: str) -> Dict[str, Any]:
    with get_connection() as conn:
        row = fetch_one(conn, "SELECT * FROM ks_task_memory WHERE task_memory_id = %s", (task_memory_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Task memory not found")
        return normalize(row)


@app.put("/api/task-memories/{task_memory_id}")
def update_task_memory(task_memory_id: str, request: TaskMemoryPatch) -> Dict[str, Any]:
    updates: List[str] = []
    params: List[Any] = []
    if request.outputSummary is not None:
        updates.append("output_summary = %s")
        params.append(request.outputSummary)
    if request.humanFeedback is not None:
        updates.append("human_feedback = %s")
        params.append(request.humanFeedback)
    if request.successStatus is not None:
        updates.append("success_status = %s")
        params.append(request.successStatus)
    if request.promoteStatus is not None:
        updates.append("promote_status = %s")
        params.append(request.promoteStatus)
    if request.metadata is not None:
        updates.append("metadata_json = %s")
        params.append(json.dumps(request.metadata, ensure_ascii=False))
    if not updates:
        return get_task_memory(task_memory_id)
    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(task_memory_id)
    with get_connection() as conn:
        execute(conn, f"UPDATE ks_task_memory SET {', '.join(updates)} WHERE task_memory_id = %s", tuple(params))
        conn.commit()
    return get_task_memory(task_memory_id)


@app.post("/api/task-memories/{task_memory_id}/promote-to-wiki")
def promote_to_wiki(task_memory_id: str, request: PromoteRequest) -> Dict[str, Any]:
    with get_connection() as conn:
        memory = fetch_one(conn, "SELECT * FROM ks_task_memory WHERE task_memory_id = %s", (task_memory_id,))
        if not memory:
            raise HTTPException(status_code=404, detail="Task memory not found")
        proposal_id = uuid.uuid4().hex
        title = request.title or f"任务沉淀：{(memory.get('task_goal') or '')[:80]}"
        draft_content = build_draft(memory)
        actor_id = request.createdByActorId or str(memory.get("ai_employee_id"))
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
                task_memory_id,
                request.createdByActorType,
                actor_id,
                request.suggestedTemplate,
                title,
                draft_content,
                json.dumps({"taskMemoryId": task_memory_id, "queryLog": memory.get("query_log")}, ensure_ascii=False),
                memory.get("cited_chunk_ids"),
                ",".join(request.applicablePositions),
                request.riskLevel,
            ),
        )
        execute(
            conn,
            "UPDATE ks_task_memory SET promote_status = 'promoted', updated_at = CURRENT_TIMESTAMP WHERE task_memory_id = %s",
            (task_memory_id,),
        )
        conn.commit()
    return {"taskMemoryId": task_memory_id, "proposalId": proposal_id, "reviewStatus": "pending"}


def build_draft(memory: Dict[str, Any]) -> str:
    sections = [
        "# " + str(memory.get("task_goal") or "任务知识沉淀"),
        "## 任务输入摘要\n" + str(memory.get("input_summary") or "暂无"),
        "## 输出摘要\n" + str(memory.get("output_summary") or "暂无"),
        "## 引用 Chunk\n" + str(memory.get("cited_chunk_ids") or "暂无"),
        "## 人类反馈\n" + str(memory.get("human_feedback") or "暂无"),
    ]
    return "\n\n".join(sections)


def fetch_one(conn: Any, sql: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(conn: Any, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


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
