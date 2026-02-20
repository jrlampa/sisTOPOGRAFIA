from typing import Dict, Any
from infrastructure.external_api.groq_adapter import GroqAdapter
from utils.logger import Logger

class SuggestiveDesignUseCase:
    """Application service to handle AI-driven design suggestions."""

    def __init__(self, groq_adapter: GroqAdapter):
        self.groq_adapter = groq_adapter

    def execute(self, analysis_results: Dict[str, Any], context: str = "") -> str:
        """Generates a design suggestion based on analytical data."""
        Logger.info("UseCase: Generating AI Suggestive Design...")

        # Construct highly technical prompt
        prompt = self._build_prompt(analysis_results, context)
        
        suggestion = self.groq_adapter.get_completion(prompt)
        
        return suggestion

    def _build_prompt(self, stats: Dict[str, Any], context: str) -> str:
        """Builds a structured engineering prompt."""
        
        # Extract stats safely
        slope_avg = stats.get('slope_avg', 0)
        solar_avg = stats.get('solar_avg', 0)
        cut_vol = stats.get('earthwork', {}).get('cut_volume', 0)
        fill_vol = stats.get('earthwork', {}).get('fill_volume', 0)
        
        prompt = f"""
Analise os seguintes dados técnicos de topografia e forneça diretrizes de design de engenharia:

DADOS DO TERRENO:
- Declividade Média: {slope_avg:.1f}%
- Índice Solar Médio: {solar_avg:.2f} (0-1)
- Movimentação de Terra Estimada:
    - Corte: {cut_vol:.1f} m³
    - Aterro: {fill_vol:.1f} m³

CONTEXTO ADICIONAL:
{context}

REQUISITOS DA RESPOSTA:
1. Responda em Português do Brasil (pt-BR).
2. Use Markdown com títulos (###).
3. Seja extremamente técnico e prático (foco em engenharia civil/urbanismo).
4. Aborde: Drenagem, Terraplanagem, Implantação de Edificações e Sustentabilidade.
"""
        return prompt
