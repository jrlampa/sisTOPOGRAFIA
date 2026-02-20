"""
pdf_adapter.py — Infrastructure adapter para geração de PDF técnico.
Usa fpdf2 API moderna (XPos/YPos em vez de ln=True deprecated).
DDD — Infrastructure Layer.
"""
from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime
import os

try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger


class PdfAdapter(FPDF):
    """Adapter de infraestrutura para geração de PDF via fpdf2."""

    def header(self):
        self.set_fill_color(30, 58, 138)
        self.rect(0, 0, 210, 40, 'F')
        self.set_font('helvetica', 'B', 24)
        self.set_text_color(255, 255, 255)
        self.cell(0, 15, 'sisTOPOGRAFIA',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        self.ln(10)

    def generate(self, data: dict, output_path: str) -> str:
        """
        Gera PDF de análise técnica com estatísticas e análise econômica.

        Args:
            data:        dict com 'project_name', 'client', 'stats', 'economics'
            output_path: caminho de saída do PDF

        Returns:
            output_path do arquivo gerado
        """
        self.add_page()
        stats     = data.get('stats', {})
        economics = data.get('economics', {})

        # Cabeçalho do laudo
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, 'LAUDO TECNICO TOPOGRAFICO',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')

        # Dados do projeto
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        self.cell(0, 8, f"Projeto: {data.get('project_name', 'N/A')}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 8, f"Cliente: {data.get('client', 'N/A')}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)

        # Estatísticas técnicas
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, 'ESTATISTICAS TECNICAS',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        self.cell(0, 8, f"Corte: {stats.get('cut_volume', 0):.1f} m3",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 8, f"Aterro: {stats.get('fill_volume', 0):.1f} m3",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 8, f"Declividade Media: {stats.get('slope_avg', 0):.1f}%",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(5)

        # Análise econômica
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, 'ANALISE ECONOMICA ESTIMADA',
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(0, 0, 0)
        self.set_font('helvetica', '', 10)

        breakdown      = economics.get('breakdown', {})
        earthwork_cost = breakdown.get('earthwork', {})
        summary        = breakdown.get('summary', {})

        self.cell(0, 8, f"Custo Mov. Terra: R$ {earthwork_cost.get('total', 0):,.2f}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 8, f"Capex Estimado: R$ {summary.get('total_capex', 0):,.2f}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.cell(0, 8, f"Economia Solar Anual: R$ {summary.get('solar_annual_saving', 0):,.2f}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.ln(10)
        self.set_font('helvetica', 'I', 8)
        self.multi_cell(
            0, 5,
            "Nota: Valores estimados com base em tabelas de precos de mercado. "
            "Nao substituem orcamento detalhado de engenharia."
        )

        self.output(output_path)
        Logger.info(f"Infrastructure PDF gerado: {output_path}")
        return output_path
