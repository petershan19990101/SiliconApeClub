import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_connection
from .models import (
    CapabilityProposalCreate,
    DemandGroupCreate,
    EmployeeActionRequest,
    HandoffRequest,
    LoginRequest,
    MessageBlock,
    MessageCreate,
    ReviewRequest,
    SessionCreate,
    SkillProposalCreate,
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
        sync_management_projection(conn)
        frontdesk = get_frontdesk_employee(conn)
        return {
            "principal": public_principal(principal),
            "frontdeskEmployee": normalize(frontdesk),
            "serviceBoundary": {
                "clientEntry": "/api/worker-platform/**",
                "internalOnly": ["knowledge-runtime-service", "task-memory-service", "retrieval-service", "siliconApeClub-server"],
            },
            "blockTypes": ["markdown", "html", "code", "image", "form", "artifact", "task_status", "org_route", "employee_card", "handoff"],
            "capabilities": visible_capabilities(conn, principal),
            "canViewOrg": can_view_org(principal),
        }


@app.get("/api/worker-platform/quick-capabilities")
@app.get("/api/worker-platform/capabilities")
def list_capabilities(principal: Dict[str, Any] = Depends(require_principal)) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        sync_management_projection(conn)
        return visible_capabilities(conn, principal)


@app.post("/api/worker-platform/sessions/{session_id}/quick-capabilities/{capability_code}/open")
@app.post("/api/worker-platform/sessions/{session_id}/capabilities/{capability_code}/open")
def open_capability_form(
    session_id: str,
    capability_code: str,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    with get_connection() as conn:
        session = get_visible_session(conn, principal, session_id)
        capability = get_visible_capability(conn, principal, capability_code)
        employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE id = %s", (session["primary_employee_id"],))
        message_id = insert_message(
            conn,
            session["demand_group_id"],
            session["id"],
            "ai_employee",
            employee["id"],
            employee["name"],
            build_capability_prompt_blocks(capability, "用户从客户端快捷能力入口选择。"),
        )
        conn.commit()
        return {
            "assistantMessage": message_payload(fetch_one(conn, "SELECT * FROM wp_message WHERE id = %s", (message_id,))),
            "capability": capability,
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
            request.title or "新的服务对话",
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
        form_submission = extract_form_submission(user_blocks)
        if form_submission:
            assistant = handle_form_submission(conn, principal, group, session, form_submission)
        else:
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


@app.post("/api/worker-platform/skills/proposals")
def create_skill_proposal(
    request: SkillProposalCreate,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    if not can_view_org(principal):
        raise HTTPException(status_code=403, detail="External customers cannot propose employee skills")
    if request.skillLevel == "advanced" and principal["principal_type"] != "admin":
        raise HTTPException(status_code=403, detail="Advanced skills can only be proposed by top management")
    with get_connection() as conn:
        if not table_exists(conn, "hr_skill_repository"):
            raise HTTPException(status_code=503, detail="Skill repository is not initialized")
        if request.taskId:
            task = get_visible_task(conn, principal, request.taskId)
        else:
            task = None
        if request.demandGroupId:
            ensure_group_visible(conn, principal, request.demandGroupId)
        source_employee_id = request.sourceEmployeeId or (task.get("assigned_employee_id") if task else None)
        if source_employee_id:
            employee_detail(source_employee_id, principal)
        admin_employee_id_value = admin_source_numeric_id(source_employee_id, "employee-admin-")
        department_id = request.departmentId
        if department_id is None and source_employee_id:
            employee = fetch_one(conn, "SELECT org_unit_id FROM wp_ai_employee WHERE id = %s", (source_employee_id,))
            department_id = admin_source_numeric_id(employee.get("org_unit_id") if employee else None, "org-admin-")
        execute(
            conn,
            """
            INSERT INTO hr_skill_repository(code, name, description, department_id, skill_type, skill_level, invocation_mode,
                input_schema_json, output_schema_json, orchestration_config_json, guardrails_json,
                source_type, source_employee_id, review_status, enabled, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ai_employee', %s, 'pending_review', 0, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                department_id = EXCLUDED.department_id,
                skill_type = EXCLUDED.skill_type,
                skill_level = EXCLUDED.skill_level,
                invocation_mode = EXCLUDED.invocation_mode,
                input_schema_json = EXCLUDED.input_schema_json,
                output_schema_json = EXCLUDED.output_schema_json,
                orchestration_config_json = EXCLUDED.orchestration_config_json,
                guardrails_json = EXCLUDED.guardrails_json,
                source_type = EXCLUDED.source_type,
                source_employee_id = EXCLUDED.source_employee_id,
                review_status = 'pending_review',
                enabled = 0,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                request.code,
                request.name,
                request.description,
                department_id,
                request.skillType,
                request.skillLevel,
                request.invocationMode,
                request.inputSchemaJson,
                request.outputSchemaJson,
                request.orchestrationConfigJson,
                request.guardrailsJson,
                admin_employee_id_value,
                principal["principal_code"],
            ),
        )
        if request.taskId:
            insert_event(conn, request.taskId, "skill_proposal_created", principal["id"], source_employee_id, {"skillCode": request.code})
        conn.commit()
        row = fetch_one(conn, "SELECT * FROM hr_skill_repository WHERE code = %s", (request.code,))
        return normalize(row)


@app.post("/api/worker-platform/capabilities/proposals")
def create_capability_proposal(
    request: CapabilityProposalCreate,
    principal: Dict[str, Any] = Depends(require_principal),
) -> Dict[str, Any]:
    if not can_view_org(principal):
        raise HTTPException(status_code=403, detail="External customers cannot propose business capabilities")
    with get_connection() as conn:
        if not table_exists(conn, "hr_skill_repository"):
            raise HTTPException(status_code=503, detail="Skill repository is not initialized")
        if request.taskId:
            task = get_visible_task(conn, principal, request.taskId)
        else:
            task = None
        if request.demandGroupId:
            ensure_group_visible(conn, principal, request.demandGroupId)
        source_employee_id = request.sourceEmployeeId or (task.get("assigned_employee_id") if task else None)
        if source_employee_id:
            employee_detail(source_employee_id, principal)
        admin_employee_id_value = admin_source_numeric_id(source_employee_id, "employee-admin-")
        department_id = request.departmentId
        if department_id is None and source_employee_id:
            employee = fetch_one(conn, "SELECT org_unit_id FROM wp_ai_employee WHERE id = %s", (source_employee_id,))
            department_id = admin_source_numeric_id(employee.get("org_unit_id") if employee else None, "org-admin-")
        orchestration = parse_json(request.orchestrationConfigJson) or {}
        orchestration.setdefault("defaultVisible", True)
        orchestration.setdefault("deterministic", True)
        guardrails = parse_json(request.guardrailsJson) or {}
        guardrails.setdefault("externalVisible", True)
        guardrails.setdefault("humanReviewRequired", True)
        execute(
            conn,
            """
            INSERT INTO hr_skill_repository(code, name, description, department_id, skill_type, skill_level, invocation_mode,
                input_schema_json, output_schema_json, orchestration_config_json, guardrails_json,
                source_type, source_employee_id, review_status, enabled, created_by)
            VALUES (%s, %s, %s, %s, 'business_action', 'basic', 'form_submit', %s, %s, %s, %s,
                'ai_employee', %s, 'pending_review', 0, %s)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                department_id = EXCLUDED.department_id,
                skill_type = 'business_action',
                skill_level = 'basic',
                invocation_mode = 'form_submit',
                input_schema_json = EXCLUDED.input_schema_json,
                output_schema_json = EXCLUDED.output_schema_json,
                orchestration_config_json = EXCLUDED.orchestration_config_json,
                guardrails_json = EXCLUDED.guardrails_json,
                source_type = EXCLUDED.source_type,
                source_employee_id = EXCLUDED.source_employee_id,
                review_status = 'pending_review',
                enabled = 0,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                request.code,
                request.name,
                request.description,
                department_id,
                request.inputSchemaJson,
                request.outputSchemaJson,
                json_dumps(orchestration),
                json_dumps(guardrails),
                admin_employee_id_value,
                principal["principal_code"],
            ),
        )
        if request.taskId:
            insert_event(conn, request.taskId, "capability_proposal_created", principal["id"], source_employee_id, {"capabilityCode": request.code})
        conn.commit()
        row = fetch_one(conn, "SELECT * FROM hr_skill_repository WHERE code = %s", (request.code,))
        return normalize(row)


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
        CREATE TABLE IF NOT EXISTS wp_form_submission (
            id TEXT PRIMARY KEY,
            demand_group_id TEXT NOT NULL REFERENCES wp_demand_group(id),
            session_id TEXT NOT NULL REFERENCES wp_conversation_session(id),
            capability_code TEXT NOT NULL,
            capability_name TEXT NOT NULL,
            submitted_by_principal_id TEXT REFERENCES wp_principal(id),
            values_json TEXT NOT NULL,
            task_id TEXT,
            status TEXT NOT NULL DEFAULT 'submitted',
            result_json TEXT,
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
        cleanup_legacy_client_concepts(conn)
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
        ("org-frontdesk", "business-frontdesk", "业务前台", "department", "org-sac", "外部客户接待、事项澄清、组织派发"),
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
            "统一接待客户事项，澄清目标并按组织关系派发任务。",
            ["事项接待", "结构化表单收集", "组织路由", "任务建账"],
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
            ["事项拆解", "长任务执行", "交付物整理"],
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
            "结构化事项收集",
            "frontdesk",
            "把自然语言描述转成可确认的表单字段。",
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
            {"fields": ["事项摘要", "业务域", "风险等级"]},
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
        (
            "skill-business-order-create",
            "business_order_create",
            "业务下单",
            "business_action",
            "收集商品、数量、联系人和收货地址，直接创建演示订单。",
            {
                "title": "业务下单",
                "required": ["productName", "quantity", "deliveryAddress", "contactPhone"],
                "properties": {
                    "productName": {"type": "string", "title": "商品/服务名称", "placeholder": "例如：企业知识库初始化服务"},
                    "quantity": {"type": "number", "title": "数量", "default": 1},
                    "deliveryAddress": {"type": "string", "title": "收货/服务地址", "ui:widget": "textarea"},
                    "contactPhone": {"type": "string", "title": "联系电话"},
                    "remark": {"type": "string", "title": "备注", "ui:widget": "textarea"},
                },
            },
            {"type": "object", "properties": {"orderId": {"type": "string"}, "status": {"type": "string"}}},
            {
                "externalVisible": True,
                "orchestration": {
                    "actionCode": "create_order",
                    "formTitle": "业务下单",
                    "submitLabel": "提交订单",
                    "defaultVisible": True,
                    "deterministic": True,
                    "keywords": ["下单", "订购", "购买", "order"],
                    "routeEmployeeCodes": ["frontdesk-ada", "customer-service-01"],
                    "displayHtml": "<section><h3>业务下单</h3><p>请填写精确入参，提交后直接创建订单账本。</p></section>",
                },
            },
            ["employee-frontdesk-ada"],
        ),
        (
            "skill-business-order-query",
            "business_order_query",
            "查询订单进度",
            "business_action",
            "通过订单号和联系方式查询当前订单处理进度。",
            {
                "title": "查询订单进度",
                "required": ["orderId"],
                "properties": {
                    "orderId": {"type": "string", "title": "订单号"},
                    "contactPhone": {"type": "string", "title": "联系电话"},
                },
            },
            {"type": "object", "properties": {"orderId": {"type": "string"}, "status": {"type": "string"}}},
            {
                "externalVisible": True,
                "orchestration": {
                    "actionCode": "query_order_status",
                    "formTitle": "查询订单进度",
                    "submitLabel": "查询进度",
                    "defaultVisible": True,
                    "deterministic": True,
                    "keywords": ["订单进度", "查订单", "查询订单", "进度", "order status"],
                    "routeEmployeeCodes": ["frontdesk-ada", "customer-service-01"],
                    "displayHtml": "<section><h3>查询订单进度</h3><p>输入订单号即可查询，不需要再次走大模型。</p></section>",
                },
            },
            ["employee-frontdesk-ada"],
        ),
        (
            "skill-business-return-request",
            "business_return_request",
            "退货申请",
            "business_action",
            "收集订单号、退货原因和取件信息，登记退货申请。",
            {
                "title": "退货申请",
                "required": ["orderId", "reason", "pickupAddress"],
                "properties": {
                    "orderId": {"type": "string", "title": "订单号"},
                    "reason": {"type": "string", "title": "退货原因", "ui:widget": "textarea"},
                    "pickupAddress": {"type": "string", "title": "取件地址", "ui:widget": "textarea"},
                    "contactPhone": {"type": "string", "title": "联系电话"},
                },
            },
            {"type": "object", "properties": {"returnRequestId": {"type": "string"}, "status": {"type": "string"}}},
            {
                "externalVisible": True,
                "orchestration": {
                    "actionCode": "return_request",
                    "formTitle": "退货申请",
                    "submitLabel": "提交退货申请",
                    "defaultVisible": True,
                    "deterministic": True,
                    "keywords": ["退货", "退款", "售后", "return"],
                    "routeEmployeeCodes": ["frontdesk-ada", "customer-service-01"],
                    "displayHtml": "<section><h3>退货申请</h3><p>请提供订单号、原因和取件地址，客服 AI 员工会跟进审核。</p></section>",
                },
            },
            ["employee-frontdesk-ada"],
        ),
        (
            "skill-business-address-query",
            "business_address_query",
            "查询服务地址",
            "business_action",
            "根据城市或区域查询可服务地址。",
            {
                "title": "查询服务地址",
                "required": ["region"],
                "properties": {
                    "region": {"type": "string", "title": "城市/区域"},
                    "serviceType": {"type": "string", "title": "服务类型", "enum": ["售前咨询", "订单履约", "售后服务"]},
                },
            },
            {"type": "object", "properties": {"addresses": {"type": "array"}}},
            {
                "externalVisible": True,
                "orchestration": {
                    "actionCode": "query_service_address",
                    "formTitle": "查询服务地址",
                    "submitLabel": "查询地址",
                    "defaultVisible": True,
                    "deterministic": True,
                    "keywords": ["地址", "网点", "服务地址", "查询地址", "address"],
                    "routeEmployeeCodes": ["frontdesk-ada", "customer-service-01"],
                    "displayHtml": "<section><h3>查询服务地址</h3><p>填写区域后直接查询可服务地址。</p></section>",
                },
            },
            ["employee-frontdesk-ada"],
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

    sync_management_skills(conn, employee_by_admin_id)
    grant_internal_employee_permissions(conn, list(employee_by_code.values()))
    sync_customer_employee_permissions(conn, employee_by_code)


def sync_management_skills(conn: Any, employee_by_admin_id: Dict[Any, str]) -> None:
    if not table_exists(conn, "hr_skill_repository") or not table_exists(conn, "hr_skill_binding"):
        return
    skill_rows = fetch_all(
        conn,
        """
        SELECT id, code, name, description, skill_type, skill_level, invocation_mode,
               input_schema_json, output_schema_json, orchestration_config_json, guardrails_json, enabled
        FROM hr_skill_repository
        WHERE review_status = 'approved' AND COALESCE(enabled, 1) = 1
        ORDER BY id
        """,
    )
    runtime_skill_id_by_admin_id: Dict[Any, str] = {}
    for row in skill_rows:
        guardrails = parse_json(row.get("guardrails_json")) or {}
        guardrails["orchestration"] = parse_json(row.get("orchestration_config_json")) or {}
        guardrails["skillLevel"] = row.get("skill_level") or "basic"
        guardrails["invocationMode"] = row.get("invocation_mode") or "tool_call"
        execute(
            conn,
            """
            INSERT INTO wp_worker_skill(id, code, name, skill_type, description, input_schema, output_schema, guardrails, enabled)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                skill_type = EXCLUDED.skill_type,
                description = EXCLUDED.description,
                input_schema = EXCLUDED.input_schema,
                output_schema = EXCLUDED.output_schema,
                guardrails = EXCLUDED.guardrails,
                enabled = EXCLUDED.enabled
            """,
            (
                admin_skill_id(row["id"]),
                row["code"],
                row["name"],
                row.get("skill_type") or "tool",
                row.get("description"),
                row.get("input_schema_json") or "{}",
                row.get("output_schema_json") or "{}",
                json_dumps(guardrails),
            ),
        )
        runtime_skill = fetch_one(conn, "SELECT id FROM wp_worker_skill WHERE code = %s", (row["code"],))
        if runtime_skill:
            runtime_skill_id_by_admin_id[row["id"]] = runtime_skill["id"]

    if skill_rows:
        placeholders = ", ".join(["%s"] * len(skill_rows))
        execute(
            conn,
            f"UPDATE wp_worker_skill SET enabled = 0 WHERE id LIKE 'skill-admin-%%' AND code NOT IN ({placeholders})",
            tuple(row["code"] for row in skill_rows),
        )

    if runtime_skill_id_by_admin_id:
        placeholders = ", ".join(["%s"] * len(runtime_skill_id_by_admin_id))
        execute(
            conn,
            f"DELETE FROM wp_skill_binding WHERE skill_id IN ({placeholders})",
            tuple(runtime_skill_id_by_admin_id.values()),
        )
    binding_rows = fetch_all(
        conn,
        """
        SELECT b.ai_employee_id, b.skill_id, b.binding_scope, b.required, b.sort_order
        FROM hr_skill_binding b
        JOIN hr_skill_repository s ON s.id = b.skill_id
        WHERE b.enabled = 1 AND s.review_status = 'approved' AND s.enabled = 1
        ORDER BY b.ai_employee_id, b.sort_order, s.name
        """,
    )
    for row in binding_rows:
        employee_id = employee_by_admin_id.get(row["ai_employee_id"])
        runtime_skill_id = runtime_skill_id_by_admin_id.get(row["skill_id"])
        if not employee_id or not runtime_skill_id:
            continue
        execute(
            conn,
            """
            INSERT INTO wp_skill_binding(id, employee_id, skill_id, binding_scope, enabled)
            VALUES (%s, %s, %s, %s, 1)
            ON CONFLICT (employee_id, skill_id) DO UPDATE SET
                binding_scope = EXCLUDED.binding_scope,
                enabled = EXCLUDED.enabled
            """,
            (
                new_id("bind"),
                employee_id,
                runtime_skill_id,
                json_dumps({"source": "management_console", "required": bool(row.get("required")), "sortOrder": row.get("sort_order")}),
            ),
        )


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
    if not table_exists(conn, "customer_member"):
        return
    principal_codes = [
        row["principal_code"]
        for row in fetch_all(conn, "SELECT principal_code FROM customer_member WHERE principal_code IS NOT NULL")
        if row.get("principal_code")
    ]
    for principal_code in principal_codes:
        principal = fetch_one(conn, "SELECT id FROM wp_principal WHERE principal_code = %s AND enabled = 1", (principal_code,))
        if not principal:
            continue
        execute(
            conn,
            "DELETE FROM wp_employee_permission WHERE principal_id = %s AND permission IN ('consult_employee', 'assign_employee')",
            (principal["id"],),
        )

    rows: List[Dict[str, Any]] = []
    if table_exists(conn, "customer_employee_visibility"):
        rows.extend(fetch_all(
            conn,
            """
            SELECT c.principal_code, e.code AS employee_code, v.can_consult, v.can_assign
            FROM customer_employee_visibility v
            JOIN customer_member c ON c.id = v.customer_id
            JOIN ds_ai_employee e ON e.id = v.ai_employee_id
            WHERE c.principal_code IS NOT NULL
            """,
        ))
    if table_exists(conn, "customer_role_employee_visibility") and table_exists(conn, "customer_role_binding"):
        rows.extend(fetch_all(
            conn,
            """
            SELECT c.principal_code, e.code AS employee_code, v.can_consult, v.can_assign
            FROM customer_role_employee_visibility v
            JOIN customer_role_binding b ON b.role_id = v.role_id
            JOIN customer_member c ON c.id = b.customer_id
            JOIN ds_ai_employee e ON e.id = v.ai_employee_id
            WHERE c.principal_code IS NOT NULL
            """,
        ))
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


def admin_skill_id(source_id: Any) -> str:
    return f"skill-admin-{source_id}"


def admin_source_numeric_id(value: Optional[str], prefix: str) -> Optional[int]:
    if not value or not value.startswith(prefix):
        return None
    suffix = value[len(prefix):]
    return int(suffix) if suffix.isdigit() else None


def visible_capabilities(conn: Any, principal: Dict[str, Any]) -> List[Dict[str, Any]]:
    if table_exists(conn, "client_quick_capability"):
        rows = fetch_all(
            conn,
            """
            SELECT c.*, g.group_code, g.group_name, g.group_sort
            FROM client_quick_capability c
            JOIN client_quick_capability_group g ON g.id = c.group_id
            WHERE c.enabled = 1
              AND g.enabled = 1
            ORDER BY g.group_sort, c.sort_order, c.id
            """,
        )
        capabilities = [quick_capability_payload(row) for row in rows]
        if can_view_org(principal):
            return [capability for capability in capabilities if capability.get("visibleToInternal", True)]
        return [
            capability
            for capability in capabilities
            if capability.get("visibleToExternal") and not capability.get("internalOnly")
        ]

    rows = fetch_all(
        conn,
        """
        SELECT *
        FROM wp_worker_skill
        WHERE enabled = 1
          AND skill_type IN ('business_action', 'form_template')
        ORDER BY name
        """,
    )
    capabilities = [capability_payload(row) for row in rows]
    if can_view_org(principal):
        return capabilities
    return [
        capability
        for capability in capabilities
        if capability.get("externalVisible") and not capability.get("internalOnly")
    ]


def get_visible_capability(conn: Any, principal: Dict[str, Any], capability_code: str) -> Dict[str, Any]:
    if table_exists(conn, "client_quick_capability"):
        row = fetch_one(
            conn,
            """
            SELECT c.*, g.group_code, g.group_name, g.group_sort
            FROM client_quick_capability c
            JOIN client_quick_capability_group g ON g.id = c.group_id
            WHERE c.enabled = 1
              AND g.enabled = 1
              AND c.capability_code = %s
            """,
            (capability_code,),
        )
        if row:
            capability = quick_capability_payload(row)
            if principal["principal_type"] == "external_customer" and (
                not capability.get("visibleToExternal") or capability.get("internalOnly")
            ):
                raise HTTPException(status_code=403, detail="Capability is not visible to external customers")
            if can_view_org(principal) and not capability.get("visibleToInternal", True):
                raise HTTPException(status_code=403, detail="Capability is not visible to internal users")
            return capability

    row = fetch_one(
        conn,
        """
        SELECT *
        FROM wp_worker_skill
        WHERE enabled = 1
          AND skill_type IN ('business_action', 'form_template')
          AND code = %s
        """,
        (capability_code,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Capability not found")
    capability = capability_payload(row)
    if principal["principal_type"] == "external_customer" and (
        not capability.get("externalVisible") or capability.get("internalOnly")
    ):
        raise HTTPException(status_code=403, detail="Capability is not visible to external customers")
    return capability


def quick_capability_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    input_schema = parse_json(row.get("input_schema_json")) or {}
    fields = form_fields_from_schema(input_schema)
    keywords = parse_json(row.get("keywords_json")) or []
    payload = normalize(row)
    payload["id"] = str(row.get("id"))
    payload["code"] = row.get("capability_code")
    payload["name"] = row.get("capability_name")
    payload["skillType"] = "client_quick_capability"
    payload["inputSchema"] = input_schema
    payload["outputSchema"] = {}
    payload["guardrails"] = {
        "externalVisible": bool(row.get("visible_to_external")),
        "internalOnly": bool(row.get("visible_to_internal") in (0, False)),
    }
    payload["orchestration"] = {
        "actionCode": row.get("action_code"),
        "formTitle": row.get("form_title") or input_schema.get("title") or row.get("capability_name"),
        "submitLabel": row.get("submit_label") or input_schema.get("submitLabel") or "提交",
        "defaultVisible": True,
        "deterministic": True,
        "keywords": keywords,
        "displayHtml": row.get("display_html"),
    }
    payload["formTitle"] = payload["orchestration"]["formTitle"]
    payload["submitLabel"] = payload["orchestration"]["submitLabel"]
    payload["fields"] = fields
    payload["displayHtml"] = row.get("display_html") or build_default_form_html(row.get("capability_name"), row.get("description"))
    payload["defaultVisible"] = True
    payload["keywords"] = keywords
    payload["actionCode"] = row.get("action_code")
    payload["transactionServiceCode"] = row.get("transaction_service_code")
    payload["deterministic"] = True
    payload["externalVisible"] = bool(row.get("visible_to_external"))
    payload["visibleToExternal"] = bool(row.get("visible_to_external"))
    payload["visibleToInternal"] = bool(row.get("visible_to_internal"))
    payload["internalOnly"] = not bool(row.get("visible_to_external")) and bool(row.get("visible_to_internal"))
    return payload


def capability_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    input_schema = parse_json(row.get("input_schema")) or {}
    output_schema = parse_json(row.get("output_schema")) or {}
    guardrails = parse_json(row.get("guardrails")) or {}
    orchestration = guardrails.get("orchestration") or {}
    fields = form_fields_from_schema(input_schema)
    title = orchestration.get("formTitle") or input_schema.get("title") or row["name"]
    payload = normalize(row)
    payload["inputSchema"] = input_schema
    payload["outputSchema"] = output_schema
    payload["guardrails"] = guardrails
    payload["orchestration"] = orchestration
    payload["formTitle"] = title
    payload["submitLabel"] = orchestration.get("submitLabel") or input_schema.get("submitLabel") or "提交"
    payload["fields"] = fields
    payload["displayHtml"] = orchestration.get("displayHtml") or build_default_form_html(row["name"], row.get("description"))
    payload["defaultVisible"] = bool(orchestration.get("defaultVisible", True))
    payload["keywords"] = orchestration.get("keywords") or []
    payload["actionCode"] = orchestration.get("actionCode") or row["code"]
    payload["deterministic"] = bool(orchestration.get("deterministic", True))
    payload["externalVisible"] = bool(guardrails.get("externalVisible", False))
    payload["internalOnly"] = bool(guardrails.get("internalOnly", False))
    return payload


def form_fields_from_schema(schema: Dict[str, Any]) -> List[Dict[str, Any]]:
    if isinstance(schema.get("fields"), list):
        return [normalize_form_field(field) for field in schema["fields"] if isinstance(field, dict)]
    properties = schema.get("properties") if isinstance(schema.get("properties"), dict) else {}
    required = set(schema.get("required") or [])
    fields: List[Dict[str, Any]] = []
    for name, raw in properties.items():
        if not isinstance(raw, dict):
            continue
        field_type = str(raw.get("type") or "string")
        widget = str(raw.get("ui:widget") or raw.get("widget") or "")
        if raw.get("enum") or raw.get("options"):
            control_type = "select"
        elif widget in {"textarea", "multiline"} or field_type == "text":
            control_type = "textarea"
        elif field_type in {"integer", "number"}:
            control_type = "number"
        elif field_type == "boolean":
            control_type = "select"
        else:
            control_type = str(raw.get("ui:type") or raw.get("controlType") or "text")
        options = raw.get("enum") or raw.get("options")
        if field_type == "boolean" and not options:
            options = ["是", "否"]
        fields.append(
            normalize_form_field(
                {
                    "name": name,
                    "label": raw.get("title") or raw.get("label") or name,
                    "type": control_type,
                    "required": name in required or bool(raw.get("required")),
                    "defaultValue": raw.get("default"),
                    "placeholder": raw.get("placeholder"),
                    "helpText": raw.get("description"),
                    "options": options,
                }
            )
        )
    return fields


def normalize_form_field(field: Dict[str, Any]) -> Dict[str, Any]:
    options = field.get("options")
    if isinstance(options, list):
        normalized_options = [
            {"label": str(item.get("label")), "value": str(item.get("value"))}
            if isinstance(item, dict)
            else {"label": str(item), "value": str(item)}
            for item in options
        ]
    else:
        normalized_options = []
    field_type = str(field.get("type") or "text")
    if field_type not in {"text", "textarea", "select", "number", "date", "email", "tel"}:
        field_type = "textarea" if field_type == "text_area" else "text"
    return {
        "name": str(field.get("name") or ""),
        "label": str(field.get("label") or field.get("title") or field.get("name") or ""),
        "type": field_type,
        "required": bool(field.get("required", False)),
        "defaultValue": "" if field.get("defaultValue") is None else str(field.get("defaultValue")),
        "placeholder": field.get("placeholder"),
        "helpText": field.get("helpText") or field.get("description"),
        "options": normalized_options,
    }


def build_default_form_html(name: str, description: Optional[str]) -> str:
    return (
        "<section class=\"capability-intro\">"
        f"<h3>{escape_html(name)}</h3>"
        f"<p>{escape_html(description or '请填写下面的结构化表单，AI 员工会把控后续服务流程。')}</p>"
        "</section>"
    )


def build_capability_prompt_blocks(capability: Dict[str, Any], user_text: str) -> List[Dict[str, Any]]:
    content = (
        f"我识别到你可能要办理 **{capability['name']}**。"
        "这类事项需要精确入参，我先给你一张结构化表单，提交后会直接进入对应业务动作和任务账本。"
    )
    if user_text:
        content += f"\n\n识别依据：{user_text}"
    return [
        {"type": "markdown", "content": content},
        {
            "type": "form",
            "title": capability["formTitle"],
            "data": {
                "capabilityCode": capability["code"],
                "capabilityName": capability["name"],
                "transactionServiceCode": capability.get("transactionServiceCode"),
                "actionCode": capability.get("actionCode"),
                "submitLabel": capability["submitLabel"],
                "htmlContent": capability.get("displayHtml"),
                "description": capability.get("description"),
                "deterministic": capability.get("deterministic", True),
                "fields": capability.get("fields") or [],
            },
        },
    ]


def build_chat_guidance_blocks(conn: Any, principal: Dict[str, Any], employee: Dict[str, Any]) -> List[Dict[str, Any]]:
    capabilities = [cap for cap in visible_capabilities(conn, principal) if cap.get("defaultVisible")][:4]
    names = "、".join(capability["name"] for capability in capabilities) or "下单、查进度、退货"
    return [
        {
            "type": "markdown",
            "content": (
                f"我是 **{employee['name']}**，可以先陪你把事情聊清楚。\n\n"
                f"如果你要办理确定性业务，可以直接选择右侧快捷能力，例如：{names}。"
                "我也会在聊天中识别意图，并在需要精确入参时给出表单。"
            ),
        }
    ]


def match_capability(conn: Any, principal: Dict[str, Any], text: str) -> Optional[Dict[str, Any]]:
    lower = (text or "").lower()
    if not lower.strip():
        return None
    best: Optional[Dict[str, Any]] = None
    best_score = 0
    for capability in visible_capabilities(conn, principal):
        keywords = capability.get("keywords") or []
        candidates = [capability.get("code"), capability.get("name"), *(str(item) for item in keywords)]
        score = sum(1 for item in candidates if item and str(item).lower() in lower)
        if score > best_score:
            best = capability
            best_score = score
    return best if best_score > 0 else None


def is_small_talk(text: str) -> bool:
    clean = (text or "").strip().lower()
    if not clean:
        return True
    greetings = {"你好", "您好", "hi", "hello", "在吗", "嗨", "help", "帮助"}
    return len(clean) <= 12 and any(item in clean for item in greetings)


def extract_form_submission(blocks: List[MessageBlock]) -> Optional[Dict[str, Any]]:
    for block in blocks:
        if block.type != "form":
            continue
        data = block.data or {}
        values = data.get("values")
        capability_code = data.get("capabilityCode")
        if capability_code and isinstance(values, dict):
            return {
                "title": block.title or data.get("capabilityName") or "结构化表单",
                "capabilityCode": str(capability_code),
                "values": values,
                "fields": data.get("fields") if isinstance(data.get("fields"), list) else [],
            }
    return None


def handle_form_submission(
    conn: Any,
    principal: Dict[str, Any],
    group: Dict[str, Any],
    session: Dict[str, Any],
    submission: Dict[str, Any],
) -> Dict[str, Any]:
    capability = get_visible_capability(conn, principal, submission["capabilityCode"])
    values = {key: value for key, value in submission["values"].items()}
    route_employee = choose_capability_employee(conn, capability, values)
    task = create_task_row(
        conn,
        group["id"],
        session["id"],
        capability["name"],
        json_dumps(values),
        principal["id"],
        route_employee["id"] if route_employee else session.get("primary_employee_id"),
        route_employee.get("org_unit_id") if route_employee else None,
        status_value="running",
    )
    result = execute_business_action(capability, values, task["id"])
    execute(
        conn,
        """
        INSERT INTO wp_form_submission(id, demand_group_id, session_id, capability_code, capability_name,
            submitted_by_principal_id, values_json, task_id, status, result_json)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'processed', %s)
        """,
        (
            new_id("form"),
            group["id"],
            session["id"],
            capability["code"],
            capability["name"],
            principal["id"],
            json_dumps(values),
            task["id"],
            json_dumps(result),
        ),
    )
    execute(
        conn,
        "UPDATE wp_task_run SET status = %s, progress = %s, checkpoint_json = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        ("completed" if result.get("completed", True) else "running", 100 if result.get("completed", True) else 40, json_dumps(result), task["id"]),
    )
    insert_event(conn, task["id"], "form_submitted", principal["id"], route_employee["id"] if route_employee else None, {"capabilityCode": capability["code"], "values": values})
    insert_event(conn, task["id"], "business_action_executed", principal["id"], route_employee["id"] if route_employee else None, result)
    insert_checkpoint(conn, task["id"], "business_action_result", result)
    task = fetch_one(conn, "SELECT * FROM wp_task_run WHERE id = %s", (task["id"],))
    message_id = insert_message(
        conn,
        group["id"],
        session["id"],
        "ai_employee",
        route_employee["id"] if route_employee else session["primary_employee_id"],
        route_employee["name"] if route_employee else "业务前台 Ada",
        build_form_result_blocks(capability, route_employee, task, result),
    )
    return {"message_id": message_id, "task": task}


def choose_capability_employee(conn: Any, capability: Dict[str, Any], values: Dict[str, Any]) -> Dict[str, Any]:
    route_codes = capability.get("orchestration", {}).get("routeEmployeeCodes") or []
    if isinstance(route_codes, list):
        employee = find_first_enabled_employee(conn, [str(code) for code in route_codes])
        if employee:
            return employee
    return choose_route_employee(conn, json_dumps(values) + " " + capability.get("name", ""))


def execute_business_action(capability: Dict[str, Any], values: Dict[str, Any], task_id: str) -> Dict[str, Any]:
    action_code = capability.get("actionCode") or capability["code"]
    transaction_service_code = capability.get("transactionServiceCode")
    if action_code == "create_order":
        order_id = f"SO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{task_id[-6:].upper()}"
        return {
            "completed": True,
            "actionCode": action_code,
            "transactionServiceCode": transaction_service_code,
            "orderId": order_id,
            "status": "created",
            "message": "订单已按结构化入参创建，客服 AI 员工会继续跟进履约。",
            "echo": values,
        }
    if action_code == "query_order_status":
        order_id = str(values.get("orderId") or values.get("order_id") or "未提供")
        return {
            "completed": True,
            "actionCode": action_code,
            "transactionServiceCode": transaction_service_code,
            "orderId": order_id,
            "status": "processing",
            "message": "订单当前处于处理中，预计下一节点会由客户服务部继续同步。",
            "echo": values,
        }
    if action_code == "return_request":
        request_id = f"RT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{task_id[-6:].upper()}"
        return {
            "completed": True,
            "actionCode": action_code,
            "transactionServiceCode": transaction_service_code,
            "returnRequestId": request_id,
            "status": "pending_review",
            "message": "退货申请已登记，后续会进入客服审核。",
            "echo": values,
        }
    if action_code == "query_service_address":
        return {
            "completed": True,
            "actionCode": action_code,
            "transactionServiceCode": transaction_service_code,
            "status": "answered",
            "message": "已根据区域查询服务地址，后续可由客服补充更精确信息。",
            "addresses": [
                {"name": "硅基猿猴俱乐部客户服务中心", "address": "线上服务台 / 当前演示环境"},
            ],
            "echo": values,
        }
    return {
        "completed": True,
        "actionCode": action_code,
        "transactionServiceCode": transaction_service_code,
        "status": "accepted",
        "message": "表单已提交，AI 员工会按该能力配置继续处理。",
        "echo": values,
    }


def build_form_result_blocks(
    capability: Dict[str, Any],
    employee: Optional[Dict[str, Any]],
    task: Dict[str, Any],
    result: Dict[str, Any],
) -> List[Dict[str, Any]]:
    facts = []
    for key in ["orderId", "returnRequestId", "status"]:
        if result.get(key):
            facts.append(f"- **{key}**: {result[key]}")
    return [
        {
            "type": "markdown",
            "content": (
                f"**{capability['name']}** 已按结构化表单处理完成。\n\n"
                f"{result.get('message', '业务动作已执行。')}\n\n"
                + ("\n".join(facts) if facts else "")
            ),
        },
        {
            "type": "task_status",
            "title": "任务状态",
            "data": {
                "taskId": task["id"],
                "status": task.get("status"),
                "progress": task.get("progress"),
                "checkpoint": result,
            },
        },
        {
            "type": "org_route",
            "title": "服务把控员工",
            "data": {
                "from": {"name": "业务能力表单", "role": "deterministic_form"},
                "to": {"id": employee.get("id") if employee else None, "name": employee.get("name") if employee else "业务前台 Ada", "role": employee.get("role_title") if employee else "业务前台"},
                "reason": "该业务能力通过传统表单提交入参，AI 员工负责服务把控、异常升级和后续跟进。",
            },
        },
    ]


def create_assistant_response(
    conn: Any,
    principal: Dict[str, Any],
    group: Dict[str, Any],
    session: Dict[str, Any],
    text: str,
) -> Dict[str, Any]:
    current_employee = fetch_one(conn, "SELECT * FROM wp_ai_employee WHERE id = %s", (session["primary_employee_id"],))
    matched_capability = match_capability(conn, principal, text)
    if matched_capability:
        message_id = insert_message(
            conn,
            group["id"],
            session["id"],
            "ai_employee",
            current_employee["id"],
            current_employee["name"],
            build_capability_prompt_blocks(matched_capability, text),
        )
        return {"message_id": message_id, "task": None}
    if is_small_talk(text):
        message_id = insert_message(
            conn,
            group["id"],
            session["id"],
            "ai_employee",
            current_employee["id"],
            current_employee["name"],
            build_chat_guidance_blocks(conn, principal, current_employee),
        )
        return {"message_id": message_id, "task": None}
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
    analysis = analyze_employee_message(conn, principal, current_employee, route_employee, route_reason, text)
    blocks = build_assistant_blocks(current_employee, route_employee, route_reason, task, text, analysis)
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


def analyze_employee_message(
    conn: Any,
    principal: Dict[str, Any],
    current_employee: Dict[str, Any],
    route_employee: Dict[str, Any],
    route_reason: str,
    text: str,
) -> Dict[str, Any]:
    profile = get_ai_model_profile(conn, "worker_chat")
    metadata = ai_profile_metadata(profile, "worker_chat")
    if not profile:
        return fallback_worker_analysis(current_employee, route_reason, metadata, "profile_not_found")
    if not profile.get("api_key"):
        return fallback_worker_analysis(current_employee, route_reason, metadata, "api_key_not_configured")
    try:
        content = call_worker_chat_model(profile, principal, current_employee, route_employee, route_reason, text)
        metadata["realCall"] = True
        metadata["fallbackUsed"] = False
        return {"content": content, "metadata": metadata}
    except Exception as exc:
        metadata["realCall"] = False
        metadata["fallbackReason"] = str(exc)
        if profile_truthy(profile.get("fallback_enabled", 1)):
            return fallback_worker_analysis(current_employee, route_reason, metadata, str(exc))
        metadata["fallbackUsed"] = False
        return {
            "content": (
                "模型调用失败，当前未启用自动降级。我已保留任务账本，"
                "请在管理台系统设置中检查 AI 模型配置后继续处理。"
            ),
            "metadata": metadata,
        }


def get_ai_model_profile(conn: Any, purpose: str) -> Dict[str, Any]:
    try:
        row = fetch_one(
            conn,
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
        return dict(row) if row else {}
    except Exception:
        return {}


def call_worker_chat_model(
    profile: Dict[str, Any],
    principal: Dict[str, Any],
    current_employee: Dict[str, Any],
    route_employee: Dict[str, Any],
    route_reason: str,
    text: str,
) -> str:
    endpoint = profile.get("endpoint")
    api_key = profile.get("api_key")
    model_name = profile.get("model_name")
    if not endpoint or not api_key or not model_name:
        raise ValueError("model endpoint, api key or model name is missing")
    config = parse_json(profile.get("config_json")) or {}
    temperature = float(config.get("temperature", 0.2)) if isinstance(config, dict) else 0.2
    max_tokens = int(config.get("maxTokens", 900)) if isinstance(config, dict) else 900
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是硅基猿猴俱乐部 AI 员工公司的数字员工。"
                    "你必须用简洁的中文 Markdown 回复，先明确你已接收事项，"
                    "再说明组织派发或协作路径、需要补充的结构化信息、下一步动作。"
                    "不要编造已经完成的外部系统动作。"
                ),
            },
            {
                "role": "user",
                "content": json_dumps(
                    {
                        "principal": {
                            "displayName": principal.get("display_name"),
                            "principalType": principal.get("principal_type"),
                        },
                        "currentEmployee": {
                            "name": current_employee.get("name"),
                            "roleTitle": current_employee.get("role_title"),
                        },
                        "routeEmployee": {
                            "name": route_employee.get("name"),
                            "roleTitle": route_employee.get("role_title"),
                            "description": route_employee.get("description"),
                        },
                        "routeReason": route_reason,
                        "customerMessage": text,
                    }
                ),
            },
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    with httpx.Client(timeout=int(profile.get("timeout_seconds") or 30)) as client:
        response = client.post(endpoint, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
        response.raise_for_status()
        data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not content:
        raise ValueError("model response does not contain choices[0].message.content")
    return str(content).strip()


def fallback_worker_analysis(
    current_employee: Dict[str, Any],
    route_reason: str,
    metadata: Dict[str, Any],
    reason: str,
) -> Dict[str, Any]:
    metadata["realCall"] = False
    metadata["fallbackUsed"] = True
    metadata["fallbackReason"] = reason
    return {
        "content": (
            f"我已作为 **{current_employee['role_title']}** 接收这项事项，并为它建立任务账本。\n\n"
            f"{route_reason}\n\n"
            "下一步会先确认结构化信息，再由对应员工继续处理。"
        ),
        "metadata": metadata,
    }


def ai_profile_metadata(profile: Dict[str, Any], purpose: str) -> Dict[str, Any]:
    return {
        "purpose": purpose,
        "profileCode": profile.get("profile_code"),
        "provider": profile.get("provider"),
        "modelName": profile.get("model_name"),
        "realCall": False,
        "fallbackUsed": False,
    }


def profile_truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


def build_assistant_blocks(
    current_employee: Dict[str, Any],
    route_employee: Dict[str, Any],
    route_reason: str,
    task: Optional[Dict[str, Any]],
    text: str,
    analysis: Dict[str, Any],
) -> List[Dict[str, Any]]:
    task_id = task["id"] if task else None
    return [
        {
            "type": "markdown",
            "content": analysis.get("content") or (
                f"我已作为 **{current_employee['role_title']}** 接收这项事项，并为它建立任务账本。\n\n"
                f"{route_reason}\n\n下一步会先确认结构化信息，再由对应员工继续处理。"
            ),
            "data": analysis.get("metadata") or {},
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
        f"你好，{principal['display_name']}。我是 **{employee['name']}**，你可以直接描述要办理或咨询的事情。"
        if direct
        else "你好，我是 **业务前台 Ada**。你可以先直接聊天说明要办理或咨询的事情；如果需要精确入参，我会再给你对应表单。"
    )
    insert_message(
        conn,
        group_id,
        session_id,
        "ai_employee",
        employee_id,
        employee["name"],
        [{"type": "markdown", "content": content}],
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
    if (
        table_exists(conn, "customer_member")
        and table_exists(conn, "customer_role_binding")
        and table_exists(conn, "customer_role_department_visibility")
    ):
        rows = fetch_all(
            conn,
            """
            SELECT u.id
            FROM customer_role_department_visibility v
            JOIN customer_role_binding b ON b.role_id = v.role_id
            JOIN customer_member c ON c.id = b.customer_id
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
        return "这件事包含战略、方向或研究信号，已路由给业务战略部。"
    if code in {"marketing-leader", "marketing-pm-01", "marketing-pm-02"}:
        return "这段内容包含市场、营销或产品建设信号，已路由给市场部/产品经理。"
    if code in {"rd-leader", "public-rd-captain", "developer-01", "developer-02", "cto-luo"}:
        return "这段内容包含技术建设、研发、架构或检索/RAG 信号，已路由给科技部研发中心。"
    if code in {"customer-service-leader", "customer-service-01", "customer-service-02", "frontdesk-ada"}:
        return "这件事需要客户服务接待、澄清或跟进，已路由给客户服务部。"
    if employee["code"] == "rag-kai":
        return "这段内容包含检索、索引、RAG 或召回质量信号，已路由给 RAG 支持组。"
    if employee["code"] == "knowledge-lin":
        return "这段内容包含 Wiki、文档、知识沉淀或岗位知识信号，已路由给知识运营部。"
    return "这件事属于通用交付或需要进一步拆解，已路由给任务交付组。"


def employee_payload(conn: Any, principal: Dict[str, Any], row: Dict[str, Any]) -> Dict[str, Any]:
    payload = normalize_json(row, ["capabilities_json"])
    payload["canConsult"] = has_employee_permission(conn, principal, row["id"], "consult_employee")
    payload["canAssign"] = has_employee_permission(conn, principal, row["id"], "assign_employee")
    return payload


def message_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    payload = normalize(row)
    payload["blocks"] = sanitize_message_blocks(parse_json(row.get("blocks_json")) or [])
    payload.pop("blocksJson", None)
    return payload


def cleanup_legacy_client_concepts(conn: Any) -> None:
    execute(
        conn,
        """
        UPDATE wp_demand_group
        SET title = '服务对话'
        WHERE title IN ('新的客户需求', '新的需求沟通', '需求登记')
           OR title LIKE %s
        """,
        ("新的客户需求%",),
    )
    execute(
        conn,
        """
        UPDATE wp_conversation_session
        SET title = '服务对话'
        WHERE title IN ('新的客户需求', '新的需求沟通', '需求登记')
           OR title LIKE %s
        """,
        ("新的客户需求%",),
    )
    rows = fetch_all(
        conn,
        """
        SELECT id, blocks_json
        FROM wp_message
        WHERE blocks_json LIKE %s
           OR blocks_json LIKE %s
        """,
        ("%需求登记%", "%我会先接待和澄清需求%"),
    )
    for row in rows:
        blocks = parse_json(row.get("blocks_json")) or []
        sanitized = sanitize_message_blocks(blocks)
        if sanitized != blocks:
            execute(conn, "UPDATE wp_message SET blocks_json = %s WHERE id = %s", (json_dumps(sanitized), row["id"]))


def sanitize_message_blocks(blocks: Any) -> List[Dict[str, Any]]:
    if not isinstance(blocks, list):
        return []
    sanitized: List[Dict[str, Any]] = []
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if is_legacy_intake_form_block(block):
            continue
        next_block = dict(block)
        if next_block.get("type") == "markdown" and isinstance(next_block.get("content"), str):
            next_block["content"] = sanitize_system_markdown(next_block["content"])
        sanitized.append(next_block)
    return sanitized


def is_legacy_intake_form_block(block: Dict[str, Any]) -> bool:
    if block.get("type") != "form":
        return False
    data = block.get("data") if isinstance(block.get("data"), dict) else {}
    fields = data.get("fields") if isinstance(data.get("fields"), list) else []
    field_names = {str(field.get("name")) for field in fields if isinstance(field, dict)}
    title = str(block.get("title") or "")
    submit_label = str(data.get("submitLabel") or "")
    return (
        "需求登记" in title
        or "需求登记" in submit_label
        or {"businessGoal", "expectedOutput", "materials"}.issubset(field_names)
    )


def sanitize_system_markdown(content: str) -> str:
    return (
        content.replace(
            "你好，我是 **业务前台 Ada**。我会先接待和澄清需求，再按组织关系拆分给合适的团队。",
            "你好，我是 **业务前台 Ada**。你可以直接说明要办理或咨询的事情；需要精确入参时，我会再给你对应表单。",
        )
        .replace(
            "我会先接待和澄清需求，再按组织关系拆分给合适的团队。",
            "你可以直接说明要办理或咨询的事情；需要精确入参时，我会再给你对应表单。",
        )
    )


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
