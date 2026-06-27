from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class TaskMemoryRequest(BaseModel):
    aiEmployeeId: int
    runtimeSessionId: Optional[str] = None
    taskId: Optional[str] = None
    taskGoal: str
    inputSummary: Optional[str] = None
    queryLog: List[Dict[str, Any]] = Field(default_factory=list)
    retrievedChunkIds: List[str] = Field(default_factory=list)
    citedChunkIds: List[str] = Field(default_factory=list)
    outputSummary: Optional[str] = None
    humanFeedback: Optional[str] = None
    successStatus: Literal["unknown", "success", "failed", "partial"] = "unknown"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskMemoryPatch(BaseModel):
    outputSummary: Optional[str] = None
    humanFeedback: Optional[str] = None
    successStatus: Optional[Literal["unknown", "success", "failed", "partial"]] = None
    promoteStatus: Optional[Literal["none", "candidate", "promoted", "rejected"]] = None
    metadata: Optional[Dict[str, Any]] = None


class PromoteRequest(BaseModel):
    createdByActorType: Literal["USER", "AI_EMPLOYEE"] = "AI_EMPLOYEE"
    createdByActorId: Optional[str] = None
    title: Optional[str] = None
    suggestedTemplate: Optional[str] = "task_memory"
    riskLevel: Literal["low", "medium", "high", "critical"] = "medium"
    applicablePositions: List[str] = Field(default_factory=list)
