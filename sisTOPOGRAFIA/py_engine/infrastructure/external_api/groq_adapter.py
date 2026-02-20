import requests
import json
import os
from typing import Dict, Any, List
from utils.logger import Logger

class GroqAdapter:
    """Infrastructure adapter for Groq API (LLM)."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key
        if not self.api_key:
            self.api_key = os.getenv("GROQ_API_KEY")
        self.url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "mixtral-8x7b-32768"

    def get_completion(self, prompt: str, system_prompt: str = "Você é um engenheiro civil e urbanista especialista em topografia.") -> str:
        """Fetches a completion from Groq API."""
        if not self.api_key:
            Logger.warn("Groq API Key not found. Returning mock suggestion.")
            return self._mock_suggestion()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }

        try:
            response = requests.post(self.url, headers=headers, json=payload, timeout=15)
            response.raise_for_status()
            data = response.json()
            return data['choices'][0]['message']['content']
        except Exception as e:
            Logger.error(f"Groq API Error: {e}")
            return f"Erro ao contactar IA: {e}"

    def _mock_suggestion(self) -> str:
        return (
            "### Sugestões de Design (MOCK)\n"
            "1. **Drenagem**: Devido à declividade de 12%, recomenda-se sistema de drenagem com dissipadores.\n"
            "2. **Terraplanagem**: O volume de corte excede o de aterro em 15%, considere redistribuição local.\n"
            "3. **Sustentabilidade**: Face Norte livre, ideal para painéis solares na cobertura."
        )
