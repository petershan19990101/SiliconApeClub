from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class RuntimeContextResponse(BaseModel):
    sessionId: str
    aiEmployee: Dict[str, Any]
    packages: List[Dict[str, Any]]
    mustReadWiki: List[Dict[str, Any]]
    defaultRetrievalScope: Dict[str, Any]
    permissionBoundary: Dict[str, Any]
    securityContext: Dict[str, Any]


class FeedbackRequest(BaseModel):
    actorType: Literal["USER", "AI_EMPLOYEE"]
    actorId: str
    feedbackType: str = Field(default="knowledge_issue")
    targetType: Optional[str] = None
    targetId: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WikiProposalRequest(BaseModel):
    sourceTaskMemoryId: Optional[str] = None
    createdByActorType: Literal["USER", "AI_EMPLOYEE"]
    createdByActorId: str
    suggestedTemplate: Optional[str] = None
    title: str
    draftContent: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    citationIds: List[str] = Field(default_factory=list)
    applicablePositions: List[str] = Field(default_factory=list)
    riskLevel: Literal["low", "medium", "high", "critical"] = "medium"


class ReviewRequest(BaseModel):
    reviewerId: Optional[int] = None
    reviewComment: Optional[str] = None
