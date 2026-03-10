"""AI Service – FastAPI entry point."""
import logging
import os

from fastapi import FastAPI
from pydantic import BaseModel

from model_manager import ModelManager
from prompt_builder import build_messages
from response_parser import parse_response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

_model_manager: ModelManager | None = None


def get_model_manager() -> ModelManager:
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager(api_key=GROQ_API_KEY)
    return _model_manager


app = FastAPI(title="CIVilizaTu AI Service", version="1.0.0")


class DecideRequest(BaseModel):
    game_state: dict = {}

    class Config:
        extra = "allow"


@app.post("/ai/decide")
async def decide(body: dict):
    """Accept the full game_state JSON and return AI actions."""
    mm = get_model_manager()
    messages = build_messages(body)
    try:
        raw = mm.chat(messages, max_tokens=500)
        result = parse_response(raw)
    except Exception as e:
        logger.error("AI decision error: %s", e)
        result = {
            "actions": [{"type": "endTurn"}],
            "reasoning": f"Error: {str(e)}",
            "analysis": "",
        }
    return result


@app.get("/health")
async def health():
    return {"status": "ok", "model": get_model_manager().current_model}


@app.get("/ai/token-usage")
async def token_usage():
    return {"usage": get_model_manager().get_token_usage()}
