# DocSpace Retrieval Service

FastAPI service for DocSpace Knowledge Layer retrieval.

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
- `DOCSPACE_SERVER_BASE_URL`
- `RETRIEVAL_SERVICE_TOKEN`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_EMBEDDING_MODEL`
- `DASHSCOPE_EMBEDDING_DIMENSIONS`
- `DASHSCOPE_RERANK_ENDPOINT`
- `DASHSCOPE_RERANK_MODEL`

When `DASHSCOPE_API_KEY` is empty, the service uses deterministic local hash embeddings and local rerank scoring so the MVP can run in development.

## APIs

- `GET /api/retrieval/health`
- `POST /api/retrieval/search`
- `POST /api/retrieval/debug`
- `POST /api/retrieval/sync/pending`
- `POST /api/retrieval/sync/jobs/{jobId}`
