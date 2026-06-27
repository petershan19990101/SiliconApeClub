from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class Actor(BaseModel):
    type: Literal["USER", "AI_EMPLOYEE"]
    id: str
    departmentId: Optional[str] = None
    positionCode: Optional[str] = None


class TaskContext(BaseModel):
    type: Optional[str] = None
    projectId: Optional[str] = None
    riskLevel: Optional[Literal["low", "medium", "high"]] = None


class RetrievalPolicy(BaseModel):
    topK: int = Field(default=20, ge=1, le=100)
    rerankTopN: int = Field(default=8, ge=1, le=50)
    requireCitation: bool = True


class RetrievalRequest(BaseModel):
    query: str
    actor: Actor
    task: TaskContext = Field(default_factory=TaskContext)
    policy: RetrievalPolicy = Field(default_factory=RetrievalPolicy)


class RetrievalResult(BaseModel):
    chunkId: str
    content: str
    sourceTitle: str
    wikiPageId: Optional[str] = None
    wikiPageVersion: Optional[int] = None
    knowledgeStatus: str
    score: float
    rerankScore: float
    permissionMatchedBy: str
    whySelected: str


class RetrievalResponse(BaseModel):
    results: List[RetrievalResult]
    traceId: str
    debug: Optional[Dict[str, Any]] = None
