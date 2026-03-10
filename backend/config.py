from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    groq_api_key: str = ""
    jwt_secret: str = "change_this_secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    mongo_uri: str = "mongodb://admin:adminpass@mongodb:27017/civilizatu?authSource=admin"
    ai_service_url: str = "http://ai-service:8001"
    enable_cheats: bool = True
    allowed_origins: str = "http://localhost:4200,http://localhost:80"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
