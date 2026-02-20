from fpdf import FPDF
import os
import datetime
try:
    from .utils.logger import Logger
except (ImportError, ValueError):
    from utils.logger import Logger

class PDFReportGenerator(FPDF):
    def header(self):
        # Logo
        self.set_fill_color(30, 58, 138) # Dark blue
        self.rect(0, 0, 210, 40, 'F')
        
        self.set_font('helvetica', 'B', 24)
        self.set_text_color(255, 255, 255)
        self.cell(0, 15, 'sisTOPOGRAFIA', ln=True, align='L')
        
        self.set_font('helvetica', '', 10)
        self.cell(0, 5, 'ENGENHARIA E ANÁLISE GEOESPACIAL', ln=True, align='L')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Página {self.page_no()}/{{nb}} - Gerado por sisTOPOGRAFIA AI em {datetime.datetime.now().strftime("%d/%m/%Y %H:%M")}', align='C')

    def create_report(self, data, output_path):
        """
        data: Dict containing 'project_name', 'stats', 'client', 'location_label'
        """
        self.add_page()
        self.set_auto_page_break(auto=True, margin=15)
        
        # Title Section
        self.set_font('helvetica', 'B', 16)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, 'LAUDO TÉCNICO DE ANÁLISE TOPOGRÁFICA', ln=True, align='C')
        self.ln(5)
        
        # Project Info Table
        self.set_fill_color(240, 244, 255)
        self.set_font('helvetica', 'B', 10)
        self.set_text_color(0, 0, 0)
        
        info = [
            ('Projeto:', data.get('project_name', 'N/A')),
            ('Cliente:', data.get('client', 'CLIENTE PADRÃO')),
            ('Localização:', data.get('location_label', 'N/A')),
            ('Data do Levantamento:', datetime.date.today().strftime("%d/%m/%Y")),
            ('Referência:', 'SIRGAS 2000 / Georeferenciado')
        ]
        
        for label, value in info:
            self.cell(50, 8, label, border=0, fill=True)
            self.set_font('helvetica', '', 10)
            self.cell(0, 8, value, border=0, ln=True)
            self.set_font('helvetica', 'B', 10)
        
        self.ln(10)
        
        # Topographical Summary
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, '1. SUMÁRIO TOPOGRÁFICO E AMBIENTAL', ln=True)
        self.set_draw_color(30, 58, 138)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
        
        stats = data.get('stats', {})
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        
        summary_text = (
            f"A área analisada apresenta uma declividade média de {stats.get('avg_slope', 8.4):.1f}%, "
            f"com variações de altitude entre {stats.get('min_height', 0):.1f}m e {stats.get('max_height', 0):.1f}m. "
            "Os dados sugerem uma morfologia de terreno que requer atenção especial para drenagem e estabilidade de taludes."
        )
        self.multi_cell(0, 6, summary_text)
        self.ln(5)
        
        # Detailed Metrics Grid
        self.set_fill_color(245, 245, 245)
        metrics = [
            ('Área Construída (estimada)', f"{stats.get('total_building_area', 0):.1f} m2"),
            ('Extensão de Vias', f"{stats.get('total_road_length', 0):.1f} m"),
            ('Densidade de Edificações', 'ALTA' if stats.get('total_buildings', 0) > 100 else 'MÉDIA'),
            ('Pontos de Vegetação', str(stats.get('total_nature', 0)))
        ]
        
        for m_label, m_val in metrics:
            self.cell(70, 8, m_label, border='B', fill=True)
            self.cell(0, 8, m_val, border='B', ln=True, align='R')
        
        self.ln(10)
        
        # Technical Recommendations
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, '2. RECOMENDAÇÕES TÉCNICAS', ln=True)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
        
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        recommendations = [
            "• Proceder com levantamento planialtimétrico cadastral in-loco para validação centimétrica.",
            "• Verificar restrições ambientais junto aos órgãos competentes para áreas de preservação.",
            "• Implementar sistema de drenagem pluvial compatível com a declividade local.",
            "• Considerar o uso de contenções caso a declividade em cortes ultrapasse 30%."
        ]
        for rec in recommendations:
            self.multi_cell(0, 6, rec)
        
        self.ln(5)
        
        # Earthwork Section
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(30, 58, 138)
        self.cell(0, 10, '3. MOVIMENTAÇÃO DE TERRA (ESTIMATIVA)', ln=True)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
        
        self.set_font('helvetica', '', 10)
        self.set_text_color(0, 0, 0)
        self.cell(70, 8, 'Volume de Corte (V+):', border='B', fill=True)
        self.cell(0, 8, f"{stats.get('cut_volume', 0):.1f} m3", border='B', ln=True, align='R')
        self.cell(70, 8, 'Volume de Aterro (V-):', border='B', fill=True)
        self.cell(0, 8, f"{stats.get('fill_volume', 0):.1f} m3", border='B', ln=True, align='R')
        
        self.ln(10)
        
        satellite_img = data.get('satellite_img')
        if satellite_img and os.path.exists(satellite_img):
            # 4. Imagem de Satélite
            self.set_font('helvetica', 'B', 12)
            self.set_text_color(30, 58, 138)
            self.cell(0, 10, '4. VISÃO AÉREA (GOOGLE MAPS STATIC)', ln=True)
            self.line(10, self.get_y(), 200, self.get_y())
            self.ln(5)
            
            # Center the image, leaving bottom pad for cert
            img_w = 120
            self.image(satellite_img, x=(210-img_w)/2, w=img_w)
            
        self.ln(15)
        
        # Certification
        self.set_y(-40)
        self.set_font('helvetica', 'I', 9)
        self.set_text_color(100, 100, 100)
        cert_text = "Certifico que os dados apresentados neste laudo são provenientes de processamento algorítmico de bases abertas (OSM) e georreferenciamento de satélite. Possui caráter técnico-preliminar para estudos de viabilidade."
        self.multi_cell(0, 5, cert_text, align='C')
        
        self.ln(10)
        self.set_font('helvetica', 'B', 10)
        self.set_text_color(0, 0, 0)
        self.cell(0, 5, 'sisTOPOGRAFIA - ANALISTA AI', ln=True, align='C')
        
        self.output(output_path)
        Logger.info(f"Report generated: {os.path.basename(output_path)}")
        return output_path

def generate_report(data, filename):
    generator = PDFReportGenerator()
    return generator.create_report(data, filename)
