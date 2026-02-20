from fpdf import FPDF
import datetime
import os
try:
    from ...utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class PdfAdapter(FPDF):
    """Infrastructure adapter for PDF report generation using fpdf2."""
    
    def header(self):
        self.set_fill_color(30, 58, 138)
        self.rect(0, 0, 210, 40, 'F')
        self.set_font('helvetica', 'B', 24)
        self.set_text_color(255, 255, 255)
        self.cell(0, 15, 'sisTOPOGRAFIA', ln=True, align='L')
        self.ln(10)

    def generate(self, data: dict, output_path: str):
        self.add_page()
        self.set_font('helvetica', 'B', 16)
        self.cell(0, 10, 'LAUDO TÉCNICO TOPOGRÁFICO', ln=True, align='C')
        
        stats = data.get('stats', {})
        economics = data.get('economics', {})
        
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        self.cell(0, 8, f"Projeto: {data.get('project_name')}", ln=True)
        self.cell(0, 8, f"Cliente: {data.get('client')}", ln=True)
        self.ln(5)
        
        # Technical Stats
        self.set_font('helvetica', 'B', 12)
        self.cell(0, 10, 'ESTATÍSTICAS TÉCNICAS', ln=True)
        self.set_font('helvetica', '', 10)
        self.cell(0, 8, f"Corte: {stats.get('cut_volume', 0):.1f} m3", ln=True)
        self.cell(0, 8, f"Aterro: {stats.get('fill_volume', 0):.1f} m3", ln=True)
        self.cell(0, 8, f"Declividade Média: {stats.get('slope_avg', 0):.1f}%", ln=True)
        self.ln(5)

        # Economic Analysis
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, 'ANÁLISE ECONÔMICA ESTIMADA', ln=True)
        self.set_text_color(0, 0, 0)
        self.set_font('helvetica', '', 10)
        
        breakdown = economics.get('breakdown', {})
        earthwork_cost = breakdown.get('earthwork', {})
        summary = breakdown.get('summary', {})
        
        self.cell(0, 8, f"Custo Estimado Mov. Terra: R$ {earthwork_cost.get('total', 0):,.2f}", ln=True)
        self.cell(0, 8, f"Custo Total Capex Estimado: R$ {summary.get('total_capex', 0):,.2f}", ln=True)
        self.cell(0, 8, f"Economia Solar Anual Estimada: R$ {summary.get('solar_annual_saving', 0):,.2f}", ln=True)
        
        self.ln(10)
        self.set_font('helvetica', 'I', 8)
        self.multi_cell(0, 5, "Nota: Os valores acima são estimativas preliminares baseadas em tabelas de preços padrão de mercado e não substituem o orçamento detalhado de engenharia.")
        
        self.output(output_path)
        Logger.info(f"Infrastructure: PDF Generated at {output_path}")
