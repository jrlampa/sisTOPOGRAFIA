"""
memorial_engine.py — Gerador de Memorial Descritivo Topográfico (ABNT)
Responsabilidade: Calcular métricas e gerar texto técnico normatizado.
SIRGAS 2000 / UTM.
"""
import datetime
import math

class MemorialEngine:
    """
    Engine para geração de memoriais descritivos técnicos.
    """
    
    @staticmethod
    def generate_memorial(project_info: dict, vertices: list) -> str:
        """
        Gera o texto do memorial descritivo.
        vertices: lista de tuplas (x, y, z, label)
        """
        client = project_info.get('client', 'CLIENTE NÃO INFORMADO')
        project_name = project_info.get('project', 'LOTEAMENTO / ÁREA')
        location = project_info.get('location', 'CIDADE, UF')
        rt = project_info.get('designer', 'JONATAS LAMPA (RT)')
        datum = "SIRGAS 2000"
        projection = "UTM"
        
        # Cálculos de Geometria
        area = project_info.get('total_area', 0.0)
        perimeter = project_info.get('perimeter', 0.0)
        
        months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        today = datetime.date.today()
        date_str = f"{today.day} de {months[today.month-1]} de {today.year}"
        
        memorial = f"""
MEMORIAL DESCRITIVO - LEVANTAMENTO TOPOGRÁFICO
-------------------------------------------------------------------------
PROJETO: {project_name.upper()}
CLIENTE: {client.upper()}
LOCALIZAÇÃO: {location.upper()}
-------------------------------------------------------------------------

1. OBJETO
O presente memorial descreve uma área de terras com {area:,.2f} m², 
situada em {location}, conforme polígono definido pelos vértices abaixo.

2. METODOLOGIA E PRECISÃO
O levantamento foi realizado utilizando técnicas de georreferenciamento 
amarradas ao Sistema Geodésico Brasileiro, com Datum {datum} e 
Projeção {projection}. Os erros cometidos estão dentro das tolerâncias 
exigidas pela NBR 13133.

3. DESCRIÇÃO PERIMÉTRICA
Inicia-se a descrição deste perímetro no vértice {vertices[0][3] if len(vertices)>0 else 'P1'}, 
de coordenadas E= {vertices[0][0]:,.3f}m e N= {vertices[0][1]:,.3f}m.

"""
        # Adicionar tabela de vértices
        memorial += "TABELA DE COORDENADAS (SIRGAS 2000 UTM)\n"
        memorial += "VÉRTICE | ESTE (X)      | NORTE (Y)     | COTA (Z)\n"
        memorial += "---------------------------------------------------------\n"
        for x, y, z, label in vertices:
            memorial += f"{label:<7} | {x:<13,.3f} | {y:<13,.3f} | {z:<8,.3f}\n"
        
        memorial += f"""
-------------------------------------------------------------------------
PERÍMETRO TOTAL: {perimeter:,.2f} m
ÁREA TOTAL: {area:,.2f} m²
-------------------------------------------------------------------------

4. RESPONSABILIDADE TÉCNICA
{rt}
Registro Profissional Conforme ART/CFT vinculada.

{location}, {date_str}.
"""
        return memorial
        
    @staticmethod
    def calculate_perimeter(coords: list) -> float:
        """Calcula perímetro de um polígono fechado."""
        if len(coords) < 2: return 0.0
        p = 0.0
        for i in range(len(coords)):
            p1 = coords[i]
            p2 = coords[(i + 1) % len(coords)]
            p += math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2)
        return p

    @staticmethod
    def calculate_area(coords: list) -> float:
        """Calcula área via fórmula de Shoelace."""
        if len(coords) < 3: return 0.0
        area = 0.0
        for i in range(len(coords)):
            x1, y1 = coords[i][:2]
            x2, y2 = coords[(i + 1) % len(coords)][:2]
            area += (x1 * y2) - (x2 * y1)
        return abs(area) / 2.0
