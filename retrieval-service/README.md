# Silicon Ape Club Retrieval Service

FastAPI service for Silicon Ape Club Knowledge Layer retrieval.

## Run

```powershell
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Docker Compose from the repository root is preferred:

```powershell
docker compose up -d
```

## Environment

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DATABASE`
- `POSTGRES_USERNAME`
- `POSTGRES_PASSWORD`
- `SILICONAPECLUB_SERVER_BASE_URL`
- `DOCSPACE_SERVER_BASE_URL` (backward-compatible fallback)
- `RETRIEVAL_SERVICE_TOKEN`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_EMBEDDING_MODEL`
- `DASHSCOPE_EMBEDDING_DIMENSIONS`
- `DASHSCOPE_RERANK_ENDPOINT`
- `DASHSCOPE_RERANK_MODEL`

Model settings are loaded first from the management platform table `sys_ai_model_profile`:

- `purpose=rag_embedding` for query and chunk embeddings.
- `purpose=rag_rerank` for rerank.

The `DASHSCOPE_*` environment variables are backward-compatible defaults used only when the database profile is missing. When no API key is configured and fallback is enabled, the service uses deterministic local hash embeddings and local rerank scoring so the local Docker MVP can run in development. Fallback is reported in debug metadata and must not be treated as a successful real model call.

## APIs

- `GET /api/retrieval/health`
- `POST /api/retrieval/search`
- `POST /api/retrieval/debug`
- `POST /api/retrieval/sync/pending`
- `POST /api/retrieval/sync/jobs/{jobId}`
