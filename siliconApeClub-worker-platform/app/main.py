import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_connection
from .models import (
    DemandGroupCreate,
    EmployeeActionRequest,
    HandoffRequest,
    LoginRequest,
    MessageBlock,
    MessageCreate,
    ReviewRequest,
    SessionCreate,
    TaskCreate,
    WikiCandidateCreate,
)

app = FastAPI(title="Silicon Ape Club Worker Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3010",
        "http://127.0.0.1:3010",
        "http://localhost:3011",
        "http://127.0.0.1:3011",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_principal(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    return _require_principal(authorization)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "UP",
        "service": "siliconApeClub-worker-platform",
        "browserBoundary": "client_loads_worker_front_and_calls_worker_platform_api_only",
        "internalServices": {
            "knowledgeRuntime": settings.knowledge_runtime_base_url,
            "taskMemory": settings.task_memory_base_url,
            "retrieval": settings.retrieval_base_url,
            "adminServer": settings.admin_server_base_url,
        },
    }


@app.post("/api/worker-platform/auth/login")
def login(request: LoginRequest) -> Dict[str, Any]:
    with get_connection() as conn:
        principal = fetch_one(conn, "SELECT * FROM wp_principal WHERE principal_code = %s AND enabled = 1", (request.username,))
        if not principal or principal.get("password_hash") != hash_password(request.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        token = issue_token(principal["id"], principal["principal_type"])
        return {"token": token, "principal": public_principal(principal)}


@app.get("/api/worker-platform/auth/me")
def me(principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    return {"principal": public_principal(principal)}


@app.post("/api/worker-platform/auth/logout")
def logout() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/worker-platform/bootstrap")
def bootstrap(principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        frontdesk = get_frontdesk_employee(conn)
        return {
            "principal": public_principal(principal),
            "frontdeskEmployee": normalize(frontdesk),
            "serviceBoundary": {
                "clientEntry": "/api/worker-platform/**",
                "internalOnly": ["knowledge-runtime-service", "task-memory-service", "retrieval-service", "siliconApeClub-server"],
            },
            "blockTypes": ["markdown", "html", "form", "artifact", "task_status", "org_route", "employee_card", "handoff"],
            "canViewOrg": can_view_org(principal),
        }


@app.get("/api/worker-platform/demand-groups")
def list_demand_groups(principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    where, params = visibility_filter_for_groups(principal)
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            f"""
            SELECT g.*,
                   p.display_name AS owner_name,
                   intake.name AS intake_employee_name,
                   assigned.name AS assigned_employee_name,
                   (SELECT COUNT(*) FROM wp_conversation_session s WHERE s.demand_group_id = g.id) AS session_count,
                   (SELECT COUNT(*) FROM wp_task_run t WHERE t.demand_group_id = g.id) AS task_count
            FROM wp_demand_group g
            JOIN wp_principal p ON p.id = g.owner_principal_id
            LEFT JOIN wp_ai_employee intake ON intake.id = g.intake_employee_id
            LEFT JOIN wp_ai_employee assigned ON assigned.id = g.assigned_employee_id
            {where}
            ORDER BY g.updated_at DESC
            """,
            tuple(params),
        )
        return [normalize(row) for row in rows]


@app.post("/api/worker-platform/demand-groups")
def create_demand_group(request: DemandGroupCreate, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        frontdesk = get_frontdesk_employee(conn)
        assigned_employee_id = frontdesk["id"]
        if request.directEmployeeId:
            ensure_employee_action_allowed(conn, principal, request.directEmployeeId, "assign_employee")
            assigned_employee_id = request.directEmployeeId
        group_id = new_id("demand")
        execute(
            conn,
            """
            INSERT INTO wp_demand_group(id, owner_principal_id, title, summary, status, intake_employee_id, assigned_employee_id)
            VALUES (%s, %s, %s, %s, 'open', %s, %s)
            """,
            (group_id, principal["id"], request.title, request.summary, frontdesk["id"], assigned_employee_id),
        )
        mode = "direct_employee" if request.directEmployeeId else "frontdesk"
        session_id = create_session_row(conn, group_id, principal["id"], request.title, mode, assigned_employee_id)
        create_system_opening(conn, group_id, session_id, principal, assigned_employee_id, bool(request.directEmployeeId))
        conn.commit()
        return get_demand_group_payload(conn, group_id, principal)


@app.get("/api/worker-platform/demand-groups/{group_id}")
def get_demand_group(group_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        ensure_group_visible(conn, principal, group_id)
        return get_demand_group_payload(conn, group_id, principal)


@app.get("/api/worker-platform/demand-groups/{group_id}/sessions")
def list_sessions(group_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        ensure_group_visible(conn, principal, group_id)
        rows = fetch_all(
            conn,
            """
            SELECT s.*, e.name AS primary_employee_name,
                   (SELECT COUNT(*) FROM wp_message m WHERE m.session_id = s.id) AS message_count
            FROM wp_conversation_session s
            LEFT JOIN wp_ai_employee e ON e.id = s.primary_employee_id
            WHERE s.demand_group_id = %s
            ORDER BY s.created_at
            """,
            (group_id,),
        )
        return [normalize(row) for row in rows]


@app.post("/api/worker-platform/demand-groups/{group_id}/sessions")
def create_session(
    group_id: str,
    request: SessionCreate,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        ensure_group_visible(conn, principal, group_id)
        primary_employee_id = request.primaryEmployeeId
        if primary_employee_id:
            permission = "consult_employee" if request.mode == "consult" else "assign_employee"
            ensure_employee_action_allowed(conn, principal, primary_employee_id, permission)
        else:
            primary_employee_id = get_frontdesk_employee(conn)["id"]
        session_id = create_session_row(
            conn,
            group_id,
            principal["id"],
            request.title or "新的需求沟通",
            request.mode,
            primary_employee_id,
        )
        create_system_opening(conn, group_id, session_id, principal, primary_employee_id, request.mode != "frontdesk")
        conn.commit()
        return normalize(fetch_one(conn, "SELECT * FROM wp_conversation_session WHERE id = %s", (session_id,)))


@app.get("/api/worker-platform/sessions/{session_id}/messages")
def list_messages(session_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        session = get_visible_session(conn, principal, session_id)
        rows = fetch_all(
            conn,
            "SELECT * FROM wp_message WHERE session_id = %s ORDER BY created_at",
            (session["id"],),
        )
        return [message_payload(row) for row in rows]


@app.post("/api/worker-platform/sessions/{session_id}/messages")
def post_message(
    session_id: str,
    request: MessageCreate,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        session = get_visible_session(conn, principal, session_id)
        group = fetch_one(conn, "SELECT * FROM wp_demand_group WHERE id = %s", (session["demand_group_id"],))
        user_blocks = request.blocks or [MessageBlock(type="markdown", content=request.text or "收到结构化表单")]
        user_message_id = insert_message(
            conn,
            session["demand_group_id"],
            session["id"],
            "principal",
            principal["id"],
            principal["display_name"],
            [block.model_dump() for block in user_blocks],
        )
        text = request.text or summarize_blocks(user_blocks)
        assistant = create_assistant_response(conn, principal, group, session, text)
        execute(
            conn,
            "UPDATE wp_demand_group SET updated_at = CURRENT_TIMESTAMP, status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END WHERE id = %s",
            (session["demand_group_id"],),
        )
        conn.commit()
        return {
            "userMessage": message_payload(fetch_one(conn, "SELECT * FROM wp_message WHERE id = %s", (user_message_id,))),
            "assistantMessage": message_payload(fetch_one(conn, "SELECT * FROM wp_message WHERE id = %s", (assistant["message_id"],))),
            "task": normalize(assistant["task"]) if assistant.get("task") else None,
        }


@app.get("/api/worker-platform/org/tree")
def org_tree(principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        sync_management_projection(conn)
        if not can_view_org(principal):
            units = visible_org_units_for_principal(conn, principal)
            employees = visible_employee_rows_for_principal(conn, principal)
            return {"units": build_tree(units), "employees": [employee_payload(conn, principal, row) for row in employees]}
        units = [normalize(row) for row in fetch_all(conn, "SELECT * FROM wp_org_unit ORDER BY unit_type, name")]
        employees = [normalize(row) for row in fetch_all(conn, "SELECT * FROM wp_ai_employee WHERE enabled = 1 ORDER BY name")]
        return {"units": build_tree(units), "employees": employees}


@app.get("/api/worker-platform/org/employees")
def list_employees(principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        sync_management_projection(conn)
        if not can_view_org(principal):
            return [employee_payload(conn, principal, row) for row in visible_employee_rows_for_principal(conn, principal)]
        rows = fetch_all(
            conn,
            """
            SELECT e.*, u.name AS org_unit_name
            FROM wp_ai_employee e
            LEFT JOIN wp_org_unit u ON u.id = e.org_unit_id
            WHERE e.enabled = 1
            ORDER BY u.name, e.name
            """,
        )
        return [employee_payload(conn, principal, row) for row in rows]


@app.get("/api/worker-platform/org/employees/{employee_id}")
def employee_detail(employee_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        employee = fetch_one(
            conn,
            """
            SELECT e.*, u.name AS org_unit_name
            FROM wp_ai_employee e
            LEFT JOIN wp_org_unit u ON u.id = e.org_unit_id
            WHERE e.id = %s AND e.enabled = 1
            """,
            (employee_id,),
        )
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        if not can_view_org(principal) and not has_employee_permission(conn, principal, employee_id, "consult_employee"):
            raise HTTPException(status_code=403, detail="No permission to view employee")
        payload = employee_payload(conn, principal, employee)
        payload["relations"] = [
            normalize(row)
            for row in fetch_all(
                conn,
                """
                SELECT r.*, source.name AS source_name, target.name AS target_name
                FROM wp_org_relation r
                JOIN wp_ai_employee source ON source.id = r.source_employee_id
                JOIN wp_ai_employee target ON target.id = r.target_employee_id
                WHERE r.source_employee_id = %s OR r.target_employee_id = %s
                ORDER BY r.relation_type
                """,
                (employee_id, employee_id),
            )
        ]
        return payload


@app.get("/api/worker-platform/org/employees/{employee_id}/skills")
def employee_skills(employee_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        employee_detail(employee_id, principal)
        rows = fetch_all(
            conn,
            """
            SELECT s.*, b.binding_scope, b.enabled
            FROM wp_worker_skill s
            JOIN wp_skill_binding b ON b.skill_id = s.id
            WHERE b.employee_id = %s AND b.enabled = 1
            ORDER BY s.skill_type, s.name
            """,
            (employee_id,),
        )
        return [normalize_json(row, ["input_schema", "output_schema", "guardrails", "binding_scope"]) for row in rows]


@app.post("/api/worker-platform/org/employees/{employee_id}/consult")
def consult_employee(
    employee_id: str,
    request: EmployeeActionRequest,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        ensure_employee_action_allowed(conn, principal, employee_id, "consult_employee")
        group_id = request.demandGroupId or create_light_group(conn, principal, request.title or "员工咨询", employee_id)
        ensure_group_visible(conn, principal, group_id)
        session_id = request.sessionId or create_session_row(conn, group_id, principal["id"], request.title or "员工咨询", "consult", employee_id)
        insert_message(
            conn,
            group_id,
            session_id,
            "principal",
            principal["id"],
            principal["display_name"],
            [{"type": "markdown", "content": request.question or request.description or "发起员工咨询"}],
        )
        employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE id = %s", (employee_id,))
        message_id = insert_message(
            conn,
            group_id,
            session_id,
            "ai_employee",
            employee_id,
            employee["name"],
            build_consult_blocks(employee, request.question or request.description or ""),
        )
        conn.commit()
        return {
            "demandGroupId": group_id,
            "sessionId": session_id,
            "assistantMessage": message_payload(fetch_one(conn, "SELECT * FROM wp_message WHERE id = %s", (message_id,))),
        }


@app.post("/api/worker-platform/org/employees/{employee_id}/assign")
def assign_employee(
    employee_id: str,
    request: EmployeeActionRequest,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        ensure_employee_action_allowed(conn, principal, employee_id, "assign_employee")
        group_id = request.demandGroupId or create_light_group(conn, principal, request.title or "员工直派任务", employee_id)
        session_id = request.sessionId
        task = create_task_row(
            conn,
            group_id,
            session_id,
            request.title or "员工直派任务",
            request.description or request.question,
            principal["id"],
            employee_id,
            None,
            status_value="running",
        )
        conn.commit()
        return normalize(task)


@app.get("/api/worker-platform/tasks")
def list_tasks(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    principal: Dict[str, Any] = Depends(require_principal),
) -> List[Dict[str, Any]]:
    where, params = visibility_filter_for_tasks(principal)
    if status_filter:
        where += " AND t.status = %s" if where else "WHERE t.status = %s"
        params.append(status_filter)
    with get_connection() as conn:
        rows = fetch_all(
            conn,
            f"""
            SELECT t.*, g.title AS demand_group_title, e.name AS assigned_employee_name, u.name AS assigned_org_unit_name
            FROM wp_task_run t
            JOIN wp_demand_group g ON g.id = t.demand_group_id
            LEFT JOIN wp_ai_employee e ON e.id = t.assigned_employee_id
            LEFT JOIN wp_org_unit u ON u.id = t.assigned_org_unit_id
            {where}
            ORDER BY t.updated_at DESC
            """,
            tuple(params),
        )
        return [normalize_json(row, ["checkpoint_json"]) for row in rows]


@app.post("/api/worker-platform/tasks")
def create_task(request: TaskCreate, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        ensure_group_visible(conn, principal, request.demandGroupId)
        if request.assignedEmployeeId:
            ensure_employee_action_allowed(conn, principal, request.assignedEmployeeId, "assign_employee")
        task = create_task_row(
            conn,
            request.demandGroupId,
            request.sessionId,
            request.title,
            request.description,
            principal["id"],
            request.assignedEmployeeId,
            request.assignedOrgUnitId,
            status_value="running" if request.assignedEmployeeId else "queued",
        )
        conn.commit()
        return normalize_json(task, ["checkpoint_json"])


@app.get("/api/worker-platform/tasks/{task_id}")
def get_task(task_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        task = get_visible_task(conn, principal, task_id)
        payload = normalize_json(task, ["checkpoint_json"])
        payload["events"] = [
            normalize_json(row, ["payload_json"])
            for row in fetch_all(conn, "SELECT * FROM wp_task_event WHERE task_id = %s ORDER BY created_at", (task_id,))
        ]
        payload["checkpoints"] = [
            normalize_json(row, ["payload_json"])
            for row in fetch_all(conn, "SELECT * FROM wp_task_checkpoint WHERE task_id = %s ORDER BY created_at", (task_id,))
        ]
        payload["collaboration"] = [
            normalize(row)
            for row in fetch_all(conn, "SELECT * FROM wp_collaboration_thread WHERE task_id = %s ORDER BY created_at", (task_id,))
        ]
        return payload


@app.post("/api/worker-platform/tasks/{task_id}/resume")
def resume_task(task_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        task = get_visible_task(conn, principal, task_id)
        if task["status"] in {"completed", "cancelled"}:
            raise HTTPException(status_code=409, detail="Completed or cancelled tasks cannot be resumed")
        checkpoint = {
            "resumedAt": now_iso(),
            "previousStatus": task["status"],
            "resumeActor": principal["id"],
        }
        execute(
            conn,
            "UPDATE wp_task_run SET status = 'running', progress = GREATEST(progress, 10), checkpoint_json = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (json_dumps(checkpoint), task_id),
        )
        insert_event(conn, task_id, "resumed", principal["id"], None, checkpoint)
        insert_checkpoint(conn, task_id, "manual_resume", checkpoint)
        conn.commit()
        return get_task(task_id, principal)


@app.post("/api/worker-platform/tasks/{task_id}/cancel")
def cancel_task(task_id: str, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        get_visible_task(conn, principal, task_id)
        execute(conn, "UPDATE wp_task_run SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = %s", (task_id,))
        insert_event(conn, task_id, "cancelled", principal["id"], None, {"cancelledAt": now_iso()})
        conn.commit()
        return get_task(task_id, principal)


@app.post("/api/worker-platform/tasks/{task_id}/handoff")
def handoff_task(task_id: str, request: HandoffRequest, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    with get_connection() as conn:
        task = get_visible_task(conn, principal, task_id)
        ensure_employee_action_allowed(conn, principal, request.toEmployeeId, "assign_employee")
        thread_id = new_id("collab")
        execute(
            conn,
            """
            INSERT INTO wp_collaboration_thread(id, task_id, from_employee_id, to_employee_id, collaboration_type, status, note)
            VALUES (%s, %s, %s, %s, 'handoff', 'open', %s)
            """,
            (thread_id, task_id, task.get("assigned_employee_id"), request.toEmployeeId, request.note),
        )
        execute(
            conn,
            "UPDATE wp_task_run SET assigned_employee_id = %s, status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (request.toEmployeeId, task_id),
        )
        insert_event(conn, task_id, "handoff", principal["id"], request.toEmployeeId, {"note": request.note})
        conn.commit()
        return get_task(task_id, principal)


@app.post("/api/worker-platform/tasks/{task_id}/review")
def review_task(task_id: str, request: ReviewRequest, principal: Dict[str, Any] = Depends(require_principal)) -> Dict[str, Any]:
    if principal["principal_type"] == "external_customer":
        raise HTTPException(status_code=403, detail="External customers cannot review internal tasks")
    with get_connection() as conn:
        get_visible_task(conn, principal, task_id)
        status_value = "completed" if request.outcome == "approved" else "needs_changes"
        progress = 100 if request.outcome == "approved" else 70
        execute(
            conn,
            "UPDATE wp_task_run SET status = %s, progress = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
            (status_value, progress, task_id),
        )
        insert_event(conn, task_id, "reviewed", principal["id"], None, request.model_dump())
        conn.commit()
        return get_task(task_id, principal)


@app.get("/api/worker-platform/skills")
def list_skills(
    employeeId: Optional[str] = Query(default=None),
    principal: Dict[str, Any] = Depends(require_principal),
) -> List[Dict[str, Any]]:
    if not can_view_org(principal):
        raise HTTPException(status_code=403, detail="External customers cannot list skill registry")
    with get_connection() as conn:
        if employeeId:
            return employee_skills(employeeId, principal)
        rows = fetch_all(conn, "SELECT * FROM wp_worker_skill ORDER BY skill_type, name")
        return [normalize_json(row, ["input_schema", "output_schema", "guardrails"]) for row in rows]


@app.post("/api/worker-platform/wiki-candidates")
def create_wiki_candidate(
    request: WikiCandidateCreate,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        if request.taskId:
            get_visible_task(conn, principal, request.taskId)
        elif request.demandGroupId:
            ensure_group_visible(conn, principal, request.demandGroupId)
        candidate_id = new_id("wiki")
        execute(
            conn,
            """
            INSERT INTO wp_wiki_candidate(id, task_id, demand_group_id, title, draft_content, source_summary, created_by_principal_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending_review')
            """,
            (
                candidate_id,
                request.taskId,
                request.demandGroupId,
                request.title,
                request.draftContent,
                request.sourceSummary,
                principal["id"],
            ),
        )
        if request.taskId:
            insert_event(conn, request.taskId, "wiki_candidate_created", principal["id"], None, {"candidateId": candidate_id})
        conn.commit()
        return normalize(fetch_one(conn, "SELECT * FROM wp_wiki_candidate WHERE id = %s", (candidate_id,)))


@app.get("/")
def index() -> Any:
    return {
        "service": "siliconApeClub-worker-platform",
        "role": "worker runtime api",
        "frontend": "siliconApeClub-worker-front",
        "clientEntry": "http://localhost:3011",
    }


def init_db() -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS wp_principal (
            id TEXT PRIMARY KEY,
            principal_code TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            principal_type TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_customer_profile (
            id TEXT PRIMARY KEY,
            principal_id TEXT UNIQUE NOT NULL REFERENCES wp_principal(id),
            company_name TEXT,
            contact_name TEXT,
            metadata_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_org_unit (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            unit_type TEXT NOT NULL,
            parent_id TEXT,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_ai_employee (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role_title TEXT NOT NULL,
            org_unit_id TEXT REFERENCES wp_org_unit(id),
            position_code TEXT,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            capabilities_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_org_relation (
            id TEXT PRIMARY KEY,
            source_employee_id TEXT NOT NULL REFERENCES wp_ai_employee(id),
            target_employee_id TEXT NOT NULL REFERENCES wp_ai_employee(id),
            relation_type TEXT NOT NULL,
            description TEXT,
            UNIQUE(source_employee_id, target_employee_id, relation_type)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_employee_permission (
            id TEXT PRIMARY KEY,
            principal_id TEXT NOT NULL REFERENCES wp_principal(id),
            employee_id TEXT NOT NULL REFERENCES wp_ai_employee(id),
            permission TEXT NOT NULL,
            UNIQUE(principal_id, employee_id, permission)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_demand_group (
            id TEXT PRIMARY KEY,
            owner_principal_id TEXT NOT NULL REFERENCES wp_principal(id),
            title TEXT NOT NULL,
            summary TEXT,
            status TEXT NOT NULL DEFAULT 'open',
            intake_employee_id TEXT REFERENCES wp_ai_employee(id),
            assigned_employee_id TEXT REFERENCES wp_ai_employee(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_conversation_session (
            id TEXT PRIMARY KEY,
            demand_group_id TEXT NOT NULL REFERENCES wp_demand_group(id),
            title TEXT NOT NULL,
            mode TEXT NOT NULL,
            owner_principal_id TEXT NOT NULL REFERENCES wp_principal(id),
            primary_employee_id TEXT REFERENCES wp_ai_employee(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_message (
            id TEXT PRIMARY KEY,
            demand_group_id TEXT NOT NULL REFERENCES wp_demand_group(id),
            session_id TEXT NOT NULL REFERENCES wp_conversation_session(id),
            sender_type TEXT NOT NULL,
            sender_id TEXT,
            sender_name TEXT NOT NULL,
            blocks_json TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_task_run (
            id TEXT PRIMARY KEY,
            demand_group_id TEXT NOT NULL REFERENCES wp_demand_group(id),
            session_id TEXT REFERENCES wp_conversation_session(id),
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            requested_by_principal_id TEXT REFERENCES wp_principal(id),
            assigned_employee_id TEXT REFERENCES wp_ai_employee(id),
            assigned_org_unit_id TEXT REFERENCES wp_org_unit(id),
            progress INTEGER NOT NULL DEFAULT 0,
            checkpoint_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_task_event (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES wp_task_run(id),
            event_type TEXT NOT NULL,
            actor_principal_id TEXT REFERENCES wp_principal(id),
            actor_employee_id TEXT REFERENCES wp_ai_employee(id),
            payload_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_task_checkpoint (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES wp_task_run(id),
            checkpoint_key TEXT NOT NULL,
            payload_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_collaboration_thread (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES wp_task_run(id),
            from_employee_id TEXT REFERENCES wp_ai_employee(id),
            to_employee_id TEXT REFERENCES wp_ai_employee(id),
            collaboration_type TEXT NOT NULL,
            status TEXT NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_worker_skill (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            skill_type TEXT NOT NULL,
            description TEXT,
            input_schema TEXT,
            output_schema TEXT,
            guardrails TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_skill_binding (
            id TEXT PRIMARY KEY,
            employee_id TEXT NOT NULL REFERENCES wp_ai_employee(id),
            skill_id TEXT NOT NULL REFERENCES wp_worker_skill(id),
            binding_scope TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            UNIQUE(employee_id, skill_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_output_artifact (
            id TEXT PRIMARY KEY,
            demand_group_id TEXT REFERENCES wp_demand_group(id),
            session_id TEXT REFERENCES wp_conversation_session(id),
            task_id TEXT REFERENCES wp_task_run(id),
            artifact_type TEXT NOT NULL,
            title TEXT NOT NULL,
            uri TEXT NOT NULL,
            metadata_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS wp_wiki_candidate (
            id TEXT PRIMARY KEY,
            task_id TEXT REFERENCES wp_task_run(id),
            demand_group_id TEXT REFERENCES wp_demand_group(id),
            title TEXT NOT NULL,
            draft_content TEXT NOT NULL,
            source_summary TEXT,
            created_by_principal_id TEXT REFERENCES wp_principal(id),
            status TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
    ]
    with get_connection() as conn:
        for statement in statements:
            execute(conn, statement)
        seed_data(conn)
        sync_management_projection(conn)
        conn.commit()


def seed_data(conn: Any) -> None:
    seed_principal(conn, "principal-customer-demo", "customer", "外部客户演示账号", "external_customer", "Customer@123")
    seed_principal(conn, "principal-internal-demo", "internal", "公司内部演示账号", "internal_user", "Internal@123")
    seed_principal(conn, "principal-admin-demo", "admin", "硅基猿猴俱乐部管理员", "admin", "Admin@123")
    execute(
        conn,
        """
        INSERT INTO wp_customer_profile(id, principal_id, company_name, contact_name, metadata_json)
        VALUES ('customer-profile-demo', 'principal-customer-demo', '演示客户公司', '客户代表', %s)
        ON CONFLICT (principal_id) DO NOTHING
        """,
        (json_dumps({"source": "seed"}),),
    )
    units = [
        ("org-sac", "sac", "硅基猿猴俱乐部", "company", None, "AI 员工公司主体"),
        ("org-frontdesk", "business-frontdesk", "业务前台", "department", "org-sac", "外部客户接待、需求澄清、组织派发"),
        ("org-knowledge", "knowledge-ops", "知识运营部", "department", "org-sac", "Wiki、岗位知识和知识沉淀运营"),
        ("org-rag", "rag-support", "RAG 支持组", "team", "org-knowledge", "检索、索引、权限与召回质量支持"),
        ("org-delivery", "task-delivery", "任务交付组", "team", "org-sac", "通用任务执行和跨部门交付"),
    ]
    for unit in units:
        execute(
            conn,
            """
            INSERT INTO wp_org_unit(id, code, name, unit_type, parent_id, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
            """,
            unit,
        )
    employees = [
        (
            "employee-frontdesk-ada",
            "frontdesk-ada",
            "业务前台 Ada",
            "业务前台人员",
            "org-frontdesk",
            "frontdesk",
            "统一接待客户需求，澄清目标并按组织关系派发任务。",
            ["需求接待", "结构化表单收集", "组织路由", "任务建账"],
        ),
        (
            "employee-knowledge-lin",
            "knowledge-lin",
            "知识运营 Lin",
            "知识运营专员",
            "org-knowledge",
            "knowledge_operator",
            "负责 Wiki、岗位知识和任务结论沉淀。",
            ["Wiki 候选整理", "岗位知识维护", "知识审核准备"],
        ),
        (
            "employee-rag-kai",
            "rag-kai",
            "RAG 支持 Kai",
            "RAG 检索工程师",
            "org-rag",
            "rag_specialist",
            "负责 RAG 检索、索引、权限和召回质量问题。",
            ["RAG 调试", "索引排障", "权限命中分析"],
        ),
        (
            "employee-delivery-mo",
            "delivery-mo",
            "任务执行 Mo",
            "任务执行员工",
            "org-delivery",
            "task_executor",
            "负责通用业务任务执行和跨部门交付。",
            ["需求拆解", "长任务执行", "交付物整理"],
        ),
    ]
    for employee in employees:
        execute(
            conn,
            """
            INSERT INTO wp_ai_employee(id, code, name, role_title, org_unit_id, position_code, description, capabilities_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                role_title = EXCLUDED.role_title,
                org_unit_id = EXCLUDED.org_unit_id,
                position_code = EXCLUDED.position_code,
                description = EXCLUDED.description,
                capabilities_json = EXCLUDED.capabilities_json
            """,
            (*employee[:7], json_dumps(employee[7])),
        )
    relations = [
        ("employee-frontdesk-ada", "employee-knowledge-lin", "routes_to", "前台可把知识沉淀任务交给知识运营"),
        ("employee-frontdesk-ada", "employee-rag-kai", "routes_to", "前台可把检索/RAG 问题交给 RAG 支持"),
        ("employee-frontdesk-ada", "employee-delivery-mo", "routes_to", "前台可把通用交付任务交给执行员工"),
        ("employee-knowledge-lin", "employee-rag-kai", "collaborates_with", "知识运营和 RAG 支持协同闭环 Wiki/RAG"),
        ("employee-delivery-mo", "employee-knowledge-lin", "reports_knowledge", "交付结论可沉淀给知识运营"),
    ]
    for source_id, target_id, relation_type, description in relations:
        execute(
            conn,
            """
            INSERT INTO wp_org_relation(id, source_employee_id, target_employee_id, relation_type, description)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (source_employee_id, target_employee_id, relation_type) DO UPDATE SET description = EXCLUDED.description
            """,
            (new_id("rel"), source_id, target_id, relation_type, description),
        )
    seed_skills(conn)
    for principal_id in ["principal-admin-demo", "principal-internal-demo"]:
        for employee_id in ["employee-frontdesk-ada", "employee-knowledge-lin", "employee-rag-kai", "employee-delivery-mo"]:
            for permission in ["consult_employee", "assign_employee"]:
                execute(
                    conn,
                    """
                    INSERT INTO wp_employee_permission(id, principal_id, employee_id, permission)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (principal_id, employee_id, permission) DO NOTHING
                    """,
                    (new_id("perm"), principal_id, employee_id, permission),
                )


def seed_skills(conn: Any) -> None:
    skills = [
        (
            "skill-intake-form",
            "intake_form",
            "结构化需求收集",
            "frontdesk",
            "把自然语言需求转成可确认的表单字段。",
            {"fields": ["目标", "背景", "截止时间", "优先级", "附件"]},
            {"blocks": ["form", "markdown", "task_status"]},
            {"requiresHumanConfirmation": True},
            ["employee-frontdesk-ada"],
        ),
        (
            "skill-org-routing",
            "org_routing",
            "组织路由与派发",
            "orchestration",
            "根据组织关系、岗位能力和权限边界选择协作员工。",
            {"fields": ["需求摘要", "业务域", "风险等级"]},
            {"blocks": ["org_route", "employee_card", "task_status"]},
            {"externalCustomerVisible": True},
            ["employee-frontdesk-ada"],
        ),
        (
            "skill-rag-debug",
            "rag_debug",
            "RAG 检索诊断",
            "knowledge",
            "分析检索、索引、权限命中和 citation 问题。",
            {"fields": ["问题", "actorId", "departmentId", "chunkId"]},
            {"blocks": ["markdown", "artifact", "citation"]},
            {"internalOnly": True},
            ["employee-rag-kai"],
        ),
        (
            "skill-wiki-candidate",
            "wiki_candidate",
            "任务结论沉淀 Wiki",
            "knowledge",
            "把任务过程和结论整理为候选 Wiki。",
            {"fields": ["任务结论", "证据", "适用岗位", "风险等级"]},
            {"blocks": ["markdown", "form", "artifact"]},
            {"reviewRequired": True},
            ["employee-knowledge-lin", "employee-delivery-mo"],
        ),
        (
            "skill-long-task",
            "long_task_checkpoint",
            "长任务检查点",
            "execution",
            "为长任务写入事件、checkpoint 和恢复状态。",
            {"fields": ["任务目标", "当前步骤", "下一步", "副作用"]},
            {"blocks": ["task_status", "markdown"]},
            {"idempotencyRequired": True},
            ["employee-delivery-mo", "employee-frontdesk-ada"],
        ),
    ]
    for skill in skills:
        execute(
            conn,
            """
            INSERT INTO wp_worker_skill(id, code, name, skill_type, description, input_schema, output_schema, guardrails)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                skill_type = EXCLUDED.skill_type,
                description = EXCLUDED.description,
                input_schema = EXCLUDED.input_schema,
                output_schema = EXCLUDED.output_schema,
                guardrails = EXCLUDED.guardrails
            """,
            (
                skill[0],
                skill[1],
                skill[2],
                skill[3],
                skill[4],
                json_dumps(skill[5]),
                json_dumps(skill[6]),
                json_dumps(skill[7]),
            ),
        )
        for employee_id in skill[8]:
            execute(
                conn,
                """
                INSERT INTO wp_skill_binding(id, employee_id, skill_id, binding_scope)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (employee_id, skill_id) DO UPDATE SET binding_scope = EXCLUDED.binding_scope
                """,
                (new_id("bind"), employee_id, skill[0], json_dumps({"seed": True})),
            )


def seed_principal(conn: Any, principal_id: str, code: str, name: str, principal_type: str, password: str) -> None:
    execute(
        conn,
        """
        INSERT INTO wp_principal(id, principal_code, display_name, principal_type, password_hash)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (principal_code) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            principal_type = EXCLUDED.principal_type,
            password_hash = EXCLUDED.password_hash
        """,
        (principal_id, code, name, principal_type, hash_password(password)),
    )


def sync_management_projection(conn: Any) -> None:
    if not table_exists(conn, "ds_department") or not table_exists(conn, "ds_ai_employee"):
        return
    if not column_exists(conn, "ds_department", "code") or not column_exists(conn, "ds_ai_employee", "role_title"):
        return

    department_rows = fetch_all(
        conn,
        """
        SELECT id, code, name, unit_type, parent_id, description, enabled
        FROM ds_department
        WHERE COALESCE(enabled, 1) = 1
        ORDER BY COALESCE(sort_order, 999), id
        """,
    )
    for row in department_rows:
        execute(
            conn,
            """
            INSERT INTO wp_org_unit(id, code, name, unit_type, parent_id, description)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                unit_type = EXCLUDED.unit_type,
                parent_id = EXCLUDED.parent_id,
                description = EXCLUDED.description
            """,
            (
                admin_org_id(row["id"]),
                row["code"],
                row["name"],
                row.get("unit_type") or "department",
                admin_org_id(row["parent_id"]) if row.get("parent_id") else None,
                row.get("description"),
            ),
        )

    employee_rows = fetch_all(
        conn,
        """
        SELECT id, code, name, description, position_code, department_id, role_title, responsibilities,
               skills_json, memory_policy_json, model_config_json, hr_role_code, manager_employee_id,
               employment_type, cost_rate, performance_status, enabled, status
        FROM ds_ai_employee
        WHERE COALESCE(enabled, 1) = 1
        ORDER BY id
        """,
    )
    employee_by_code: Dict[str, str] = {}
    employee_by_admin_id: Dict[Any, str] = {}
    for row in employee_rows:
        capabilities = {
            "source": "management_console",
            "skills": parse_json(row.get("skills_json")) or [],
            "hrRoleCode": row.get("hr_role_code"),
            "employmentType": row.get("employment_type"),
            "performanceStatus": row.get("performance_status"),
            "costRate": str(row.get("cost_rate") or "0"),
            "memoryPolicy": parse_json(row.get("memory_policy_json")) or {},
            "modelConfig": parse_json(row.get("model_config_json")) or {},
        }
        execute(
            conn,
            """
            INSERT INTO wp_ai_employee(id, code, name, role_title, org_unit_id, position_code, description, enabled, capabilities_json)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                role_title = EXCLUDED.role_title,
                org_unit_id = EXCLUDED.org_unit_id,
                position_code = EXCLUDED.position_code,
                description = EXCLUDED.description,
                enabled = EXCLUDED.enabled,
                capabilities_json = EXCLUDED.capabilities_json
            """,
            (
                admin_employee_id(row["id"]),
                row["code"],
                row["name"],
                row.get("role_title") or row.get("position_code") or "AI employee",
                admin_org_id(row["department_id"]) if row.get("department_id") else None,
                row.get("position_code"),
                row.get("responsibilities") or row.get("description"),
                1 if row.get("enabled") in (1, True) and str(row.get("status") or "").upper() != "DISABLED" else 0,
                json_dumps(capabilities),
            ),
        )
        projected = fetch_one(conn, "SELECT id, code FROM wp_ai_employee WHERE code = %s", (row["code"],))
        if projected:
            employee_by_code[projected["code"]] = projected["id"]
            employee_by_admin_id[row["id"]] = projected["id"]

    if employee_rows:
        placeholders = ", ".join(["%s"] * len(employee_rows))
        execute(
            conn,
            f"UPDATE wp_ai_employee SET enabled = 0 WHERE id LIKE 'employee-%%' AND code NOT IN ({placeholders})",
            tuple(row["code"] for row in employee_rows),
        )

    for row in employee_rows:
        source_id = employee_by_admin_id.get(row["id"])
        target_id = employee_by_admin_id.get(row.get("manager_employee_id"))
        if source_id and target_id:
            upsert_org_relation(conn, source_id, target_id, "reports_to", "Projected from management console manager relation")

    if table_exists(conn, "hr_employee_contact_relation"):
        relation_rows = fetch_all(
            conn,
            """
            SELECT source.code AS source_code, target.code AS target_code, r.relation_type, r.description
            FROM hr_employee_contact_relation r
            JOIN ds_ai_employee source ON source.id = r.ai_employee_id
            JOIN ds_ai_employee target ON target.id = r.related_employee_id
            """,
        )
        for row in relation_rows:
            source_id = employee_by_code.get(row["source_code"])
            target_id = employee_by_code.get(row["target_code"])
            if source_id and target_id:
                upsert_org_relation(conn, source_id, target_id, row["relation_type"], row.get("description"))

    grant_internal_employee_permissions(conn, list(employee_by_code.values()))
    sync_customer_employee_permissions(conn, employee_by_code)


def grant_internal_employee_permissions(conn: Any, employee_ids: List[str]) -> None:
    principals = fetch_all(
        conn,
        "SELECT id FROM wp_principal WHERE principal_type IN ('admin', 'internal_user') AND enabled = 1",
    )
    for principal in principals:
        for employee_id in employee_ids:
            for permission in ["consult_employee", "assign_employee"]:
                execute(
                    conn,
                    """
                    INSERT INTO wp_employee_permission(id, principal_id, employee_id, permission)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (principal_id, employee_id, permission) DO NOTHING
                    """,
                    (new_id("perm"), principal["id"], employee_id, permission),
                )


def sync_customer_employee_permissions(conn: Any, employee_by_code: Dict[str, str]) -> None:
    if not table_exists(conn, "customer_member") or not table_exists(conn, "customer_employee_visibility"):
        return
    rows = fetch_all(
        conn,
        """
        SELECT c.principal_code, e.code AS employee_code, v.can_consult, v.can_assign
        FROM customer_employee_visibility v
        JOIN customer_member c ON c.id = v.customer_id
        JOIN ds_ai_employee e ON e.id = v.ai_employee_id
        WHERE c.principal_code IS NOT NULL
        """,
    )
    principal_codes = sorted({row["principal_code"] for row in rows if row.get("principal_code")})
    for principal_code in principal_codes:
        principal = fetch_one(conn, "SELECT id FROM wp_principal WHERE principal_code = %s AND enabled = 1", (principal_code,))
        if not principal:
            continue
        execute(
            conn,
            "DELETE FROM wp_employee_permission WHERE principal_id = %s AND permission IN ('consult_employee', 'assign_employee')",
            (principal["id"],),
        )
    for row in rows:
        principal = fetch_one(conn, "SELECT id FROM wp_principal WHERE principal_code = %s AND enabled = 1", (row["principal_code"],))
        employee_id = employee_by_code.get(row["employee_code"])
        if not principal or not employee_id:
            continue
        for permission, enabled in [("consult_employee", row.get("can_consult")), ("assign_employee", row.get("can_assign"))]:
            if enabled in (1, True):
                execute(
                    conn,
                    """
                    INSERT INTO wp_employee_permission(id, principal_id, employee_id, permission)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (principal_id, employee_id, permission) DO NOTHING
                    """,
                    (new_id("perm"), principal["id"], employee_id, permission),
                )


def upsert_org_relation(conn: Any, source_id: str, target_id: str, relation_type: str, description: Optional[str]) -> None:
    execute(
        conn,
        """
        INSERT INTO wp_org_relation(id, source_employee_id, target_employee_id, relation_type, description)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (source_employee_id, target_employee_id, relation_type) DO UPDATE SET description = EXCLUDED.description
        """,
        (new_id("rel"), source_id, target_id, relation_type, description),
    )


def table_exists(conn: Any, table_name: str) -> bool:
    row = fetch_one(conn, "SELECT to_regclass(%s) AS table_ref", (table_name,))
    return bool(row and row.get("table_ref"))


def column_exists(conn: Any, table_name: str, column_name: str) -> bool:
    row = fetch_one(
        conn,
        """
        SELECT 1 AS found
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s AND column_name = %s
        """,
        (table_name, column_name),
    )
    return row is not None


def admin_org_id(source_id: Any) -> str:
    return f"org-admin-{source_id}"


def admin_employee_id(source_id: Any) -> str:
    return f"employee-admin-{source_id}"


def create_assistant_response(
    conn: Any,
    principal: Dict[str, Any],
    group: Dict[str, Any],
    session: Dict[str, Any],
    text: str,
) -> Dict[str, Any]:
    current_employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE id = %s", (session["primary_employee_id"],))
    route_employee = current_employee
    route_reason = "当前会话由指定员工处理。"
    create_task = True
    if current_employee.get("code") == "frontdesk-ada":
        route_employee = choose_route_employee(conn, text)
        route_reason = build_route_reason(route_employee, text)
    task = create_task_row(
        conn,
        group["id"],
        session["id"],
        title_from_text(text),
        text,
        principal["id"],
        route_employee["id"] if route_employee else current_employee["id"],
        route_employee.get("org_unit_id") if route_employee else current_employee.get("org_unit_id"),
        status_value="running",
    ) if create_task else None
    blocks = build_assistant_blocks(current_employee, route_employee, route_reason, task, text)
    message_id = insert_message(
        conn,
        group["id"],
        session["id"],
        "ai_employee",
        current_employee["id"],
        current_employee["name"],
        blocks,
    )
    return {"message_id": message_id, "task": task}


def build_assistant_blocks(
    current_employee: Dict[str, Any],
    route_employee: Dict[str, Any],
    route_reason: str,
    task: Optional[Dict[str, Any]],
    text: str,
) -> List[Dict[str, Any]]:
    task_id = task["id"] if task else None
    return [
        {
            "type": "markdown",
            "content": (
                f"我已作为 **{current_employee['role_title']}** 接收这项需求，并为它建立任务账本。\n\n"
                f"{route_reason}\n\n"
                "下一步会先确认结构化信息，再由对应员工继续处理。"
            ),
        },
        {
            "type": "form",
            "title": "补充精准任务信息",
            "data": {
                "submitLabel": "提交补充信息",
                "fields": [
                    {"name": "goal", "label": "任务目标", "type": "textarea", "required": True, "defaultValue": text},
                    {"name": "deadline", "label": "期望完成时间", "type": "text", "required": False},
                    {"name": "priority", "label": "优先级", "type": "select", "options": ["普通", "紧急", "阻塞业务"], "required": True},
                    {"name": "acceptance", "label": "验收标准", "type": "textarea", "required": False},
                ],
            },
        },
        {
            "type": "org_route",
            "title": "组织派发路径",
            "data": {
                "from": {"id": current_employee["id"], "name": current_employee["name"], "role": current_employee["role_title"]},
                "to": {"id": route_employee["id"], "name": route_employee["name"], "role": route_employee["role_title"]},
                "reason": route_reason,
            },
        },
        {
            "type": "employee_card",
            "title": route_employee["name"],
            "data": {
                "employeeId": route_employee["id"],
                "roleTitle": route_employee["role_title"],
                "description": route_employee.get("description"),
                "capabilities": parse_json(route_employee.get("capabilities_json")),
            },
        },
        {
            "type": "task_status",
            "title": "任务状态",
            "data": {
                "taskId": task_id,
                "status": task.get("status") if task else "queued",
                "progress": task.get("progress") if task else 0,
                "checkpoint": parse_json(task.get("checkpoint_json")) if task else {},
            },
        },
        {
            "type": "html",
            "title": "结构化摘要",
            "content": (
                "<section><strong>已记录：</strong>"
                f"<span>{escape_html(title_from_text(text))}</span>"
                "</section>"
            ),
        },
    ]


def build_consult_blocks(employee: Dict[str, Any], question: str) -> List[Dict[str, Any]]:
    return [
        {
            "type": "markdown",
            "content": f"我是 **{employee['name']}**。已收到咨询：{question or '暂无具体问题'}。\n\n我会先基于岗位知识包和历史任务记忆给出处理建议。",
        },
        {
            "type": "employee_card",
            "title": employee["name"],
            "data": {
                "employeeId": employee["id"],
                "roleTitle": employee["role_title"],
                "description": employee.get("description"),
                "capabilities": parse_json(employee.get("capabilities_json")),
            },
        },
    ]


def create_system_opening(
    conn: Any,
    group_id: str,
    session_id: str,
    principal: Dict[str, Any],
    employee_id: str,
    direct: bool,
) -> None:
    employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE id = %s", (employee_id,))
    content = (
        f"你好，{principal['display_name']}。我是 **{employee['name']}**，会直接处理这项需求。"
        if direct
        else "你好，我是 **业务前台 Ada**。我会先接待和澄清需求，再按组织关系拆分给合适的团队。"
    )
    insert_message(
        conn,
        group_id,
        session_id,
        "ai_employee",
        employee_id,
        employee["name"],
        [
            {"type": "markdown", "content": content},
            {
                "type": "form",
                "title": "需求登记",
                "data": {
                    "submitLabel": "提交需求登记",
                    "fields": [
                        {"name": "businessGoal", "label": "业务目标", "type": "textarea", "required": True},
                        {"name": "expectedOutput", "label": "期望输出", "type": "text", "required": True},
                        {"name": "materials", "label": "已有材料说明", "type": "textarea", "required": False},
                    ],
                },
            },
        ],
    )


def create_light_group(conn: Any, principal: Dict[str, Any], title: str, assigned_employee_id: str) -> str:
    frontdesk = get_frontdesk_employee(conn)
    group_id = new_id("demand")
    execute(
        conn,
        """
        INSERT INTO wp_demand_group(id, owner_principal_id, title, summary, status, intake_employee_id, assigned_employee_id)
        VALUES (%s, %s, %s, %s, 'in_progress', %s, %s)
        """,
        (group_id, principal["id"], title, title, frontdesk["id"], assigned_employee_id),
    )
    return group_id


def create_session_row(
    conn: Any,
    group_id: str,
    owner_id: str,
    title: str,
    mode: str,
    primary_employee_id: str,
) -> str:
    session_id = new_id("session")
    execute(
        conn,
        """
        INSERT INTO wp_conversation_session(id, demand_group_id, title, mode, owner_principal_id, primary_employee_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (session_id, group_id, title, mode, owner_id, primary_employee_id),
    )
    return session_id


def create_task_row(
    conn: Any,
    group_id: str,
    session_id: Optional[str],
    title: str,
    description: Optional[str],
    requested_by: str,
    assigned_employee_id: Optional[str],
    assigned_org_unit_id: Optional[str],
    status_value: str,
) -> Dict[str, Any]:
    task_id = new_id("task")
    checkpoint = {
        "createdAt": now_iso(),
        "stage": "task_created",
        "recoverable": True,
        "nextAction": "load_employee_context_and_execute",
    }
    execute(
        conn,
        """
        INSERT INTO wp_task_run(id, demand_group_id, session_id, title, description, status,
            requested_by_principal_id, assigned_employee_id, assigned_org_unit_id, progress, checkpoint_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            task_id,
            group_id,
            session_id,
            title,
            description,
            status_value,
            requested_by,
            assigned_employee_id,
            assigned_org_unit_id,
            10 if status_value == "running" else 0,
            json_dumps(checkpoint),
        ),
    )
    insert_event(conn, task_id, "created", requested_by, assigned_employee_id, checkpoint)
    insert_checkpoint(conn, task_id, "created", checkpoint)
    execute(conn, "UPDATE wp_demand_group SET assigned_employee_id = COALESCE(%s, assigned_employee_id), updated_at = CURRENT_TIMESTAMP WHERE id = %s", (assigned_employee_id, group_id))
    return fetch_one(conn, "SELECT * FROM wp_task_run WHERE id = %s", (task_id,))


def insert_message(
    conn: Any,
    group_id: str,
    session_id: str,
    sender_type: str,
    sender_id: str,
    sender_name: str,
    blocks: List[Dict[str, Any]],
) -> str:
    message_id = new_id("msg")
    execute(
        conn,
        """
        INSERT INTO wp_message(id, demand_group_id, session_id, sender_type, sender_id, sender_name, blocks_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (message_id, group_id, session_id, sender_type, sender_id, sender_name, json_dumps(blocks)),
    )
    execute(conn, "UPDATE wp_conversation_session SET updated_at = CURRENT_TIMESTAMP WHERE id = %s", (session_id,))
    return message_id


def insert_event(
    conn: Any,
    task_id: str,
    event_type: str,
    actor_principal_id: Optional[str],
    actor_employee_id: Optional[str],
    payload: Dict[str, Any],
) -> None:
    execute(
        conn,
        """
        INSERT INTO wp_task_event(id, task_id, event_type, actor_principal_id, actor_employee_id, payload_json)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (new_id("event"), task_id, event_type, actor_principal_id, actor_employee_id, json_dumps(payload)),
    )


def insert_checkpoint(conn: Any, task_id: str, checkpoint_key: str, payload: Dict[str, Any]) -> None:
    execute(
        conn,
        """
        INSERT INTO wp_task_checkpoint(id, task_id, checkpoint_key, payload_json)
        VALUES (%s, %s, %s, %s)
        """,
        (new_id("ckpt"), task_id, checkpoint_key, json_dumps(payload)),
    )


def get_demand_group_payload(conn: Any, group_id: str, principal: Dict[str, Any]) -> Dict[str, Any]:
    group = fetch_one(
        conn,
        """
        SELECT g.*, p.display_name AS owner_name,
               intake.name AS intake_employee_name,
               assigned.name AS assigned_employee_name
        FROM wp_demand_group g
        JOIN wp_principal p ON p.id = g.owner_principal_id
        LEFT JOIN wp_ai_employee intake ON intake.id = g.intake_employee_id
        LEFT JOIN wp_ai_employee assigned ON assigned.id = g.assigned_employee_id
        WHERE g.id = %s
        """,
        (group_id,),
    )
    payload = normalize(group)
    payload["sessions"] = list_sessions(group_id, principal)
    payload["tasks"] = [
        normalize_json(row, ["checkpoint_json"])
        for row in fetch_all(conn, "SELECT * FROM wp_task_run WHERE demand_group_id = %s ORDER BY updated_at DESC", (group_id,))
    ]
    payload["artifacts"] = [
        normalize_json(row, ["metadata_json"])
        for row in fetch_all(conn, "SELECT * FROM wp_output_artifact WHERE demand_group_id = %s ORDER BY created_at DESC", (group_id,))
    ]
    return payload


def get_visible_session(conn: Any, principal: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    session = fetch_one(conn, "SELECT * FROM wp_conversation_session WHERE id = %s", (session_id,))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    ensure_group_visible(conn, principal, session["demand_group_id"])
    return session


def get_visible_task(conn: Any, principal: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    task = fetch_one(conn, "SELECT * FROM wp_task_run WHERE id = %s", (task_id,))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    ensure_group_visible(conn, principal, task["demand_group_id"])
    return task


def ensure_group_visible(conn: Any, principal: Dict[str, Any], group_id: str) -> None:
    group = fetch_one(conn, "SELECT * FROM wp_demand_group WHERE id = %s", (group_id,))
    if not group:
        raise HTTPException(status_code=404, detail="Demand group not found")
    if principal["principal_type"] == "external_customer" and group["owner_principal_id"] != principal["id"]:
        raise HTTPException(status_code=403, detail="No permission to access this demand group")


def ensure_employee_action_allowed(conn: Any, principal: Dict[str, Any], employee_id: str, permission: str) -> None:
    employee = fetch_one(conn, "SELECT id FROM wp_ai_employee WHERE id = %s AND enabled = 1", (employee_id,))
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not has_employee_permission(conn, principal, employee_id, permission):
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")


def has_employee_permission(conn: Any, principal: Dict[str, Any], employee_id: str, permission: str) -> bool:
    if principal["principal_type"] == "admin":
        return True
    row = fetch_one(
        conn,
        """
        SELECT id FROM wp_employee_permission
        WHERE principal_id = %s AND employee_id = %s AND permission = %s
        """,
        (principal["id"], employee_id, permission),
    )
    return row is not None


def can_view_org(principal: Dict[str, Any]) -> bool:
    return principal["principal_type"] in {"internal_user", "admin"}


def visible_employee_rows_for_principal(conn: Any, principal: Dict[str, Any]) -> List[Dict[str, Any]]:
    return fetch_all(
        conn,
        """
        SELECT e.*, u.name AS org_unit_name
        FROM wp_ai_employee e
        LEFT JOIN wp_org_unit u ON u.id = e.org_unit_id
        WHERE e.enabled = 1
          AND EXISTS (
              SELECT 1
              FROM wp_employee_permission p
              WHERE p.principal_id = %s
                AND p.employee_id = e.id
                AND p.permission IN ('consult_employee', 'assign_employee')
          )
        ORDER BY u.name, e.name
        """,
        (principal["id"],),
    )


def visible_org_units_for_principal(conn: Any, principal: Dict[str, Any]) -> List[Dict[str, Any]]:
    all_units = fetch_all(conn, "SELECT * FROM wp_org_unit ORDER BY unit_type, name")
    by_id = {row["id"]: row for row in all_units}
    visible_ids = {
        row["org_unit_id"]
        for row in visible_employee_rows_for_principal(conn, principal)
        if row.get("org_unit_id")
    }
    if table_exists(conn, "customer_member") and table_exists(conn, "customer_department_visibility"):
        rows = fetch_all(
            conn,
            """
            SELECT u.id
            FROM customer_department_visibility v
            JOIN customer_member c ON c.id = v.customer_id
            JOIN ds_department d ON d.id = v.department_id
            JOIN wp_org_unit u ON u.code = d.code
            WHERE c.principal_code = %s
            """,
            (principal["principal_code"],),
        )
        visible_ids.update(row["id"] for row in rows)
    expanded_ids = set()
    for unit_id in visible_ids:
        current_id = unit_id
        while current_id and current_id in by_id and current_id not in expanded_ids:
            expanded_ids.add(current_id)
            current_id = by_id[current_id].get("parent_id")
    return [normalize(row) for row in all_units if row["id"] in expanded_ids]


def visibility_filter_for_groups(principal: Dict[str, Any]) -> tuple[str, List[Any]]:
    if principal["principal_type"] == "external_customer":
        return "WHERE g.owner_principal_id = %s", [principal["id"]]
    return "", []


def visibility_filter_for_tasks(principal: Dict[str, Any]) -> tuple[str, List[Any]]:
    if principal["principal_type"] == "external_customer":
        return "WHERE g.owner_principal_id = %s", [principal["id"]]
    return "", []


def get_frontdesk_employee(conn: Any) -> Dict[str, Any]:
    employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE code = 'frontdesk-ada' AND enabled = 1")
    if not employee:
        employee = fetch_one(
            conn,
            """
            SELECT * FROM wp_ai_employee
            WHERE enabled = 1 AND (position_code = 'customer_service_specialist' OR role_title ILIKE %s)
            ORDER BY code
            LIMIT 1
            """,
            ("%frontdesk%",),
        )
    if not employee:
        raise HTTPException(status_code=500, detail="Frontdesk employee is not initialized")
    return employee


def choose_route_employee(conn: Any, text: str) -> Dict[str, Any]:
    lower = text.lower()
    if any(keyword in lower for keyword in ["strategy", "战略", "方向", "报告", "research"]):
        employee = find_first_enabled_employee(conn, ["strategy-chief", "strategy-researcher-01"])
    elif any(keyword in lower for keyword in ["market", "营销", "市场", "产品", "prd"]):
        employee = find_first_enabled_employee(conn, ["marketing-leader", "marketing-pm-01", "marketing-pm-02"])
    elif any(keyword in lower for keyword in ["tech", "研发", "开发", "代码", "架构", "rag", "检索", "索引", "chunk", "embedding"]):
        employee = find_first_enabled_employee(conn, ["rd-leader", "public-rd-captain", "developer-01", "cto-luo"])
    elif any(keyword in lower for keyword in ["customer", "客服", "客户", "售后"]):
        employee = find_first_enabled_employee(conn, ["customer-service-leader", "customer-service-01"])
    else:
        employee = find_first_enabled_employee(conn, ["customer-service-01", "marketing-pm-01", "rd-leader", "delivery-mo"])
    return employee or get_frontdesk_employee(conn)
    if any(keyword in lower for keyword in ["rag", "检索", "索引", "召回", "chunk", "embedding"]):
        code = "rag-kai"
    elif any(keyword in lower for keyword in ["wiki", "知识", "文档", "沉淀", "岗位知识"]):
        code = "knowledge-lin"
    else:
        code = "delivery-mo"
    return fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE code = %s AND enabled = 1", (code,))


def find_first_enabled_employee(conn: Any, codes: List[str]) -> Optional[Dict[str, Any]]:
    for code in codes:
        employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE code = %s AND enabled = 1", (code,))
        if employee:
            return employee
    return None


def build_route_reason(employee: Dict[str, Any], text: str) -> str:
    code = employee.get("code")
    if code in {"strategy-chief", "strategy-researcher-01", "strategy-researcher-02"}:
        return "需求包含战略、方向或研究信号，已路由给业务战略部。"
    if code in {"marketing-leader", "marketing-pm-01", "marketing-pm-02"}:
        return "需求包含市场、营销或产品建设信号，已路由给市场部/产品经理。"
    if code in {"rd-leader", "public-rd-captain", "developer-01", "developer-02", "cto-luo"}:
        return "需求包含技术建设、研发、架构或检索/RAG 信号，已路由给科技部研发中心。"
    if code in {"customer-service-leader", "customer-service-01", "customer-service-02", "frontdesk-ada"}:
        return "需求需要客户服务接待、澄清或跟进，已路由给客户服务部。"
    if employee["code"] == "rag-kai":
        return "需求中包含检索、索引、RAG 或召回质量信号，已路由给 RAG 支持组。"
    if employee["code"] == "knowledge-lin":
        return "需求中包含 Wiki、文档、知识沉淀或岗位知识信号，已路由给知识运营部。"
    return "需求属于通用交付或需要进一步拆解，已路由给任务交付组。"


def employee_payload(conn: Any, principal: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    payload = normalize_json(row, ["capabilities_json"])
    payload["canConsult"] = has_employee_permission(conn, principal, row["id"], "consult_employee")
    payload["canAssign"] = has_employee_permission(conn, principal, row["id"], "assign_employee")
    return payload


def message_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    payload = normalize(row)
    payload["blocks"] = parse_json(row.get("blocks_json")) or []
    payload.pop("blocksJson", None)
    return payload


def public_principal(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "principalCode": row["principal_code"],
        "displayName": row["display_name"],
        "principalType": row["principal_type"],
    }


def _require_principal(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = verify_token(authorization.removeprefix("Bearer ").strip())
    with get_connection() as conn:
        principal = fetch_one(conn, "SELECT * FROM wp_principal WHERE id = %s AND enabled = 1", (payload["sub"],))
        if not principal:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Principal not found")
        return principal


def issue_token(principal_id: str, principal_type: str) -> str:
    payload = {
        "sub": principal_id,
        "typ": principal_type,
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=settings.token_ttl_hours)).timestamp()),
    }
    payload_raw = base64.urlsafe_b64encode(json_dumps(payload).encode("utf-8")).decode("ascii").rstrip("=")
    signature = sign(payload_raw)
    return f"{payload_raw}.{signature}"


def verify_token(token: str) -> Dict[str, Any]:
    try:
        payload_raw, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if not hmac.compare_digest(signature, sign(payload_raw)):
        raise HTTPException(status_code=401, detail="Invalid token signature")
    padded = payload_raw + "=" * (-len(payload_raw) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    if int(payload.get("exp") or 0) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def sign(payload_raw: str) -> str:
    return hmac.new(settings.auth_secret.encode("utf-8"), payload_raw.encode("utf-8"), hashlib.sha256).hexdigest()


def hash_password(password: str) -> str:
    return hashlib.sha256((settings.auth_secret + ":" + password).encode("utf-8")).hexdigest()


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


def normalize(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if row is None:
        return {}
    result: Dict[str, Any] = {}
    for key, value in row.items():
        camel = to_camel(key)
        if isinstance(value, datetime):
            result[camel] = value.isoformat()
        else:
            result[camel] = value
    return result


def normalize_json(row: Dict[str, Any], json_fields: List[str]) -> Dict[str, Any]:
    payload = normalize(row)
    for field in json_fields:
        camel = to_camel(field)
        if camel in payload:
            payload[camel.replace("Json", "")] = parse_json(payload.pop(camel))
    return payload


def parse_json(value: Any) -> Any:
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return value


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def title_from_text(text: str) -> str:
    clean = " ".join((text or "新任务").split())
    return clean[:48] + ("..." if len(clean) > 48 else "")


def summarize_blocks(blocks: List[MessageBlock]) -> str:
    values: List[str] = []
    for block in blocks:
        if isinstance(block.content, str):
            values.append(block.content)
        elif block.data:
            values.append(json_dumps(block.data))
    return "\n".join(values) or "结构化消息"


def build_tree(units: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_id = {unit["id"]: {**unit, "children": []} for unit in units}
    roots: List[Dict[str, Any]] = []
    for unit in by_id.values():
        parent_id = unit.get("parentId")
        if parent_id and parent_id in by_id:
            by_id[parent_id]["children"].append(unit)
        else:
            roots.append(unit)
    return roots


def escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )
