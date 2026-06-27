from app.models import RetrievalRequest


def test_retrieval_request_defaults():
    request = RetrievalRequest(
        query="CRM 客户分层规则",
        actor={"type": "AI_EMPLOYEE", "id": "1", "departmentId": "1", "positionCode": "product_manager"},
    )

    assert request.policy.topK == 20
    assert request.policy.rerankTopN == 8
    assert request.policy.requireCitation is True
