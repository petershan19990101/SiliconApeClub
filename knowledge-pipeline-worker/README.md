# Knowledge Pipeline Worker

Independent MVP worker for the Silicon Ape Club knowledge layer.

It consumes parsed Silicon Ape Club admin documents, creates active LLM Wiki pages, creates sync jobs, calls Retrieval Service indexing, and records audit/notification evidence.

## APIs

- `GET /health`
- `GET /api/pipeline/jobs`
- `GET /api/pipeline/jobs/{job_id}`
- `POST /api/pipeline/documents/{document_id}/to-wiki`
