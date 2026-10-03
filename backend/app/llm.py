"""One async client for every supported provider."""

import asyncio
from dataclasses import dataclass, field
from typing import Optional

import httpx

OPENAI_COMPATIBLE = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "xai": "https://api.x.ai/v1/chat/completions",
}
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SUPPORTED_PROVIDERS = set(OPENAI_COMPATIBLE) | {"anthropic", "google"}
RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 529}


class LLMError(Exception):
    pass


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    calls: int = 0

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens


@dataclass
class LLMClient:
    provider: str
    api_key: str
    model: str
    timeout: float = 240.0
    max_retries: int = 3
    usage: Usage = field(default_factory=Usage)
    _temperature_unsupported: bool = False

    def __post_init__(self):
        self.provider = self.provider.lower().strip()
        if self.provider not in SUPPORTED_PROVIDERS:
            raise LLMError(f"Unsupported AI provider: {self.provider}")
        self._client = httpx.AsyncClient(timeout=self.timeout)

    async def aclose(self):
        await self._client.aclose()

    async def chat(self, system: str, user: str, temperature: Optional[float] = None) -> str:
        attempt = 0
        while True:
            attempt += 1
            temp = None if self._temperature_unsupported else temperature
            try:
                return await self._dispatch(system, user, temp)
            except httpx.HTTPStatusError as exc:
                body = exc.response.text[:600]
                status = exc.response.status_code
                # Some reasoning models reject a custom temperature; retry once without it.
                if status == 400 and temp is not None and "temperature" in body.lower():
                    self._temperature_unsupported = True
                    continue
                if status in RETRYABLE_STATUS and attempt <= self.max_retries:
                    await asyncio.sleep(min(2 ** attempt, 20))
                    continue
                raise LLMError(f"{self.provider} API error {status}: {body}") from exc
            except (httpx.TransportError, httpx.TimeoutException) as exc:
                if attempt <= self.max_retries:
                    await asyncio.sleep(min(2 ** attempt, 20))
                    continue
                raise LLMError(f"Could not reach {self.provider}: {exc}") from exc

    async def _dispatch(self, system: str, user: str, temperature: Optional[float]) -> str:
        if self.provider in OPENAI_COMPATIBLE:
            return await self._openai_compatible(system, user, temperature)
        if self.provider == "anthropic":
            return await self._anthropic(system, user, temperature)
        return await self._google(system, user, temperature)

    async def _openai_compatible(self, system, user, temperature):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        if self.provider == "openrouter":
            headers["HTTP-Referer"] = "http://localhost:5173"
            headers["X-Title"] = "Agentic AI Translation Company"
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        resp = await self._client.post(OPENAI_COMPATIBLE[self.provider], headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        usage = data.get("usage") or {}
        self._track(usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"Unexpected response from {self.provider}: {str(data)[:400]}") from exc
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        return content or ""

    async def _anthropic(self, system, user, temperature):
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "system": system,
            "max_tokens": 8192,
            "messages": [{"role": "user", "content": user}],
        }
        if temperature is not None:
            payload["temperature"] = temperature
        resp = await self._client.post(ANTHROPIC_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        usage = data.get("usage") or {}
        self._track(usage.get("input_tokens", 0), usage.get("output_tokens", 0))
        return "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")

    async def _google(self, system, user, temperature):
        headers = {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
        }
        if temperature is not None:
            payload["generationConfig"] = {"temperature": temperature}
        resp = await self._client.post(GOOGLE_URL.format(model=self.model), headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        usage = data.get("usageMetadata") or {}
        self._track(usage.get("promptTokenCount", 0), usage.get("candidatesTokenCount", 0))
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"Unexpected response from Google: {str(data)[:400]}") from exc
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))

    def _track(self, input_tokens: int, output_tokens: int):
        self.usage.input_tokens += int(input_tokens or 0)
        self.usage.output_tokens += int(output_tokens or 0)
        self.usage.calls += 1
