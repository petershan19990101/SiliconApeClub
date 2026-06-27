import os


class Settings:
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_database = os.getenv("POSTGRES_DATABASE", "docspace")
    postgres_username = os.getenv("POSTGRES_USERNAME", "docspace")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "docspace123")

    docspace_server_base_url = os.getenv("DOCSPACE_SERVER_BASE_URL", "http://localhost:8080")
    service_token = os.getenv("RETRIEVAL_SERVICE_TOKEN", "docspace-retrieval-dev-token")

    dashscope_api_key = os.getenv("DASHSCOPE_API_KEY", "")
    dashscope_base_url = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    dashscope_embedding_model = os.getenv("DASHSCOPE_EMBEDDING_MODEL", "text-embedding-v4")
    dashscope_embedding_dimensions = int(os.getenv("DASHSCOPE_EMBEDDING_DIMENSIONS", "1024"))
    dashscope_rerank_endpoint = os.getenv("DASHSCOPE_RERANK_ENDPOINT", "https://dashscope.aliyuncs.com/compatible-api/v1/reranks")
    dashscope_rerank_model = os.getenv("DASHSCOPE_RERANK_MODEL", "qwen3-rerank")

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} "
            f"dbname={self.postgres_database} user={self.postgres_username} password={self.postgres_password}"
        )


settings = Settings()
