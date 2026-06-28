import os


class Settings:
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_database = os.getenv("POSTGRES_DATABASE", "docspace")
    postgres_username = os.getenv("POSTGRES_USERNAME", "docspace")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "docspace123")
    auth_secret = os.getenv("WORKER_PLATFORM_AUTH_SECRET", "silicon-ape-club-worker-dev-secret")
    token_ttl_hours = int(os.getenv("WORKER_PLATFORM_TOKEN_TTL_HOURS", "24"))
    knowledge_runtime_base_url = os.getenv("KNOWLEDGE_RUNTIME_BASE_URL", "http://knowledge-runtime-service:8091")
    task_memory_base_url = os.getenv("TASK_MEMORY_BASE_URL", "http://task-memory-service:8092")
    retrieval_base_url = os.getenv("RETRIEVAL_BASE_URL", "http://retrieval-service:8090")
    admin_server_base_url = os.getenv("SILICONAPECLUB_SERVER_BASE_URL", "http://siliconapeclub-server:8080")

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} "
            f"dbname={self.postgres_database} user={self.postgres_username} password={self.postgres_password}"
        )


settings = Settings()
