import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "changeme-please-set-a-real-secret-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DB_PATH: str = "/data/questlog.db"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite:///{self.DB_PATH}"


settings = Settings()
