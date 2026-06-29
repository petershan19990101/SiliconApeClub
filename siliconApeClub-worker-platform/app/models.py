from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


MessageBlockType = Literal[
    "markdown",
    "html",
    "code",
    "image",
    "form",
    "artifact",
    "task_status",
    "org_route",
    "employee_card",
    "handoff",
]


class LoginRequest(BaseModel):
    username: str
    password: str


class DemandGroupCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    directEmployeeId: Optional[str] = None


class SessionCreate(BaseModel):
    title: Optional[str] = None
    primaryEmployeeId: Optional[str] = None
    mode: Literal["frontdesk", "direct_employee", "consult"] = "frontdesk"


class MessageBlock(BaseModel):
    type: MessageBlockType
    content: Any = None
    title: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)


class MessageCreate(BaseModel):
    text: Optional[str] = None
    blocks: List[MessageBlock] = Field(default_factory=list)


class TaskCreate(BaseModel):
    demandGroupId: str
    sessionId: Optional[str] = None
    title: str
    description: Optional[str] = None
    assignedEmployeeId: Optional[str] = None
    assignedOrgUnitId: Optional[str] = None


class EmployeeActionRequest(BaseModel):
    demandGroupId: Optional[str] = None
    sessionId: Optional[str] = None
    title: Optional[str] = None
    question: Optional[str] = None
    description: Optional[str] = None


class HandoffRequest(BaseModel):
    toEmployeeId: str
    note: Optional[str] = None


class ReviewRequest(BaseModel):
    outcome: Literal["approved", "rejected", "needs_changes"]
    note: Optional[str] = None


class WikiCandidateCreate(BaseModel):
    taskId: Optional[str] = None
    demandGroupId: Optional[str] = None
    title: str
    draftContent: str
    sourceSummary: Optional[str] = None


class SkillProposalCreate(BaseModel):
    taskId: Optional[str] = None
    demandGroupId: Optional[str] = None
    sourceEmployeeId: Optional[str] = None
    code: str
    name: str
    description: Optional[str] = None
    departmentId: Optional[int] = None
    skillType: str = "tool"
    skillLevel: Literal["basic", "advanced"] = "basic"
    invocationMode: str = "tool_call"
    inputSchemaJson: str = "{}"
    outputSchemaJson: str = "{}"
    orchestrationConfigJson: str = "{}"
    guardrailsJson: str = "{}"


class CapabilityProposalCreate(BaseModel):
    taskId: Optional[str] = None
    demandGroupId: Optional[str] = None
    sourceEmployeeId: Optional[str] = None
    code: str
    name: str
    description: Optional[str] = None
    departmentId: Optional[int] = None
    inputSchemaJson: str
    outputSchemaJson: str = "{}"
    orchestrationConfigJson: str = "{}"
    guardrailsJson: str = '{"externalVisible": true, "humanReviewRequired": true}'
