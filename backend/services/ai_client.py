"""HTTP client to call the ai-service container."""
import httpx
from config import get_settings


async def request_ai_decision(game_state_json: dict) -> dict:
    settings = get_settings()
    url = f"{settings.ai_service_url}/ai/decide"
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = client.post(url, json=game_state_json)
        response.raise_for_status()
        return response.json()
