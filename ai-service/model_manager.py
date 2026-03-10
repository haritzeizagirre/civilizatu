"""Manages switching between GroQ models on 429 errors."""
import logging
import time
from groq import Groq, RateLimitError

logger = logging.getLogger(__name__)

MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
]


class ModelManager:
    def __init__(self, api_key: str):
        self._client = Groq(api_key=api_key)
        self._model_index = 0
        self._token_usage: list[dict] = []

    @property
    def current_model(self) -> str:
        return MODELS[self._model_index]

    def _next_model(self):
        self._model_index = (self._model_index + 1) % len(MODELS)
        logger.warning("Switched to model: %s", self.current_model)

    def chat(self, messages: list[dict], max_tokens: int = 1500) -> str:
        """Send a chat completion; auto-retry on rate-limit with next model."""
        last_exc = None
        for attempt in range(len(MODELS)):
            try:
                response = self._client.chat.completions.create(
                    model=self.current_model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.4,
                )
                usage = response.usage
                self._token_usage.append({
                    "model": self.current_model,
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "timestamp": time.time(),
                })
                return response.choices[0].message.content
            except RateLimitError as e:
                logger.warning("Rate limit on %s (attempt %d): %s", self.current_model, attempt + 1, e)
                self._next_model()
                last_exc = e
            except Exception as e:
                logger.error("GroQ call error: %s", e)
                raise

        raise last_exc or RuntimeError("All GroQ models exhausted")

    def get_token_usage(self) -> list[dict]:
        return self._token_usage
