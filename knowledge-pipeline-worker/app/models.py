from typing import List, Optional

from pydantic import BaseModel


class DocumentToWikiRequest(BaseModel):
    publish: bool = True
    title: Optional[str] = None
    summary: Optional[str] = None
    tags: Optional[List[str]] = None
    actorId: int = 1
    actorName: str = "Knowledge Pipeline Worker"
