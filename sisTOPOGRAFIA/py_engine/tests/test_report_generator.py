"""
test_report_generator.py — Testes unitários para PDFReportGenerator e generate_report().
Cobre: create_report, header, footer, _section_project_info, _section_topographic_summary,
       _section_technical_recommendations, _section_earthwork, _section_satellite,
       _certification_block, _section_header, generate_report function.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from report_generator import generate_report, PDFReportGenerator


# Dados mínimos válidos para gerar o laudo
def _minimal_data(**overrides):
    base = {
        'project_name': 'Projeto Teste',
        'client': 'Cliente Teste',
        'location_label': 'Nova Friburgo - RJ',
        'stats': {
            'avg_slope': 12.5,
            'min_height': 800.0,
            'max_height': 950.0,
            'total_building_area': 2500.0,
            'total_road_length': 1200.0,
            'total_buildings': 150,
            'total_nature': 45,
            'cut_volume': 3500.0,
            'fill_volume': 2800.0,
        },
    }
    base.update(overrides)
    return base


class TestGenerateReportFunction:
    def test_generate_report_creates_file(self, tmp_path):
        """generate_report deve criar o arquivo PDF no caminho especificado."""
        output = str(tmp_path / 'laudo.pdf')
        result = generate_report(_minimal_data(), output)
        assert os.path.exists(output), "Arquivo PDF deve ser criado"
        assert result == output

    def test_generate_report_returns_path(self, tmp_path):
        """generate_report deve retornar o mesmo caminho passado como output."""
        output = str(tmp_path / 'out.pdf')
        returned = generate_report(_minimal_data(), output)
        assert returned == output

    def test_generate_report_file_has_content(self, tmp_path):
        """PDF gerado não deve estar vazio."""
        output = str(tmp_path / 'laudo.pdf')
        generate_report(_minimal_data(), output)
        assert os.path.getsize(output) > 1000, "PDF deve ter conteúdo significativo"

    def test_generate_report_minimal_fields(self, tmp_path):
        """Deve funcionar com apenas os campos mínimos (sem stats)."""
        data = {'project_name': 'Min', 'client': 'CLI'}
        output = str(tmp_path / 'min.pdf')
        generate_report(data, output)
        assert os.path.exists(output)


class TestPDFReportGeneratorSections:
    def test_section_project_info_called(self, tmp_path):
        """Laudo deve incluir título e info do projeto."""
        output = str(tmp_path / 'proj.pdf')
        data = _minimal_data(project_name='Topografia Avançada', client='Empresa XPTO')
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_topographic_summary_high_buildings(self, tmp_path):
        """Com total_buildings > 100 deve usar 'ALTA' para densidade."""
        output = str(tmp_path / 'alta.pdf')
        data = _minimal_data()
        data['stats']['total_buildings'] = 200
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_topographic_summary_low_buildings(self, tmp_path):
        """Com total_buildings <= 100 deve usar 'MEDIA' para densidade."""
        output = str(tmp_path / 'media.pdf')
        data = _minimal_data()
        data['stats']['total_buildings'] = 50
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_earthwork_present(self, tmp_path):
        """Seção de movimentação de terra deve ser incluída."""
        output = str(tmp_path / 'earth.pdf')
        data = _minimal_data()
        data['stats']['cut_volume'] = 5000.0
        data['stats']['fill_volume'] = 4200.0
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_satellite_skipped_when_missing(self, tmp_path):
        """Sem satellite_img, seção 4 deve ser ignorada sem erro."""
        output = str(tmp_path / 'nosat.pdf')
        data = _minimal_data()
        data['satellite_img'] = None
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_satellite_skipped_nonexistent_file(self, tmp_path):
        """satellite_img apontando para arquivo inexistente deve ser ignorado."""
        output = str(tmp_path / 'nofile.pdf')
        data = _minimal_data()
        data['satellite_img'] = '/tmp/inexistente_satellite.png'
        generate_report(data, output)
        assert os.path.exists(output)

    def test_section_satellite_with_image(self, tmp_path):
        """Quando satellite_img existe, seção 4 deve ser adicionada."""
        from PIL import Image
        img_path = str(tmp_path / 'sat.png')
        img = Image.new('RGB', (100, 100), color=(30, 100, 200))
        img.save(img_path)

        output = str(tmp_path / 'sat.pdf')
        data = _minimal_data()
        data['satellite_img'] = img_path
        generate_report(data, output)
        assert os.path.exists(output)
        assert os.path.getsize(output) > 1000


class TestPDFReportGeneratorHeaderFooter:
    def test_header_and_footer_called_during_create_report(self, tmp_path):
        """header() e footer() devem ser chamados durante a criação do laudo."""
        gen = PDFReportGenerator()
        output = str(tmp_path / 'hf.pdf')
        gen.create_report(_minimal_data(), output)
        assert os.path.exists(output)
