import os


class Settings:
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
    postgres_database = os.getenv("POSTGRES_DATABASE", "docspace")
    postgres_username = os.getenv("POSTGRES_USERNAME", "docspace")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "docspace123")
    runtime_session_ttl_minutes = int(os.getenv("RUNTIME_SESSION_TTL_MINUTES", "120"))

    @property
    def postgres_dsn(self) -> str:
        return (
            f"host={self.postgres_host} port={self.postgres_port} "
            f"dbname={self.postgres_database} user={self.postgres_username} password={self.postgres_password}"
        )


settings = Settings()
