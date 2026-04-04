# Análise Técnica: APIs Públicas Brasileiras para Sis RUA

## Resumo Executivo

| API | Protocolo | Dados | Ganho Técnico | Prioridade |
|-----|-----------|-------|---------------|------------|
| INDE | WMS/WFS | Vetores oficiais | ⭐⭐⭐⭐⭐ Alto | 1 |
| IBGE | REST/JSON | Malhas territoriais | ⭐⭐⭐⭐⭐ Alto | 1 |
| INPE TOPODATA | GeoTIFF/WCS | Elevação 30m | ⭐⭐⭐⭐⭐ Alto | 1 |
| BDGEx | WMS/WFS | Cartas militares | ⭐⭐⭐ Médio | 2 |

---

## 1. INDE - Infraestrutura Nacional de Dados Espaciais

### Análise Técnica
- **Protocolos**: WMS (Web Map Service), WFS (Web Feature Service), CSW (Catalogue Service)
- **Dados**: Limites municipais, rodovias, hidrografia, bases cartográficas vetoriais
- **Acesso**: Visualizador + endpoints OGC

### Ganho Técnico
✅ **MUITO ALTO** - Dados oficiais brasileiros validados pelo governo
✅ **Substitui OSM** em áreas rurais onde OSM é incompleto
✅ **Limites municipais oficiais** - essencial para projetos cadastrais
✅ **Rodovias DNIT/IBGE** - mais precisas que OSM em estradas federais

### Implementação Recomendada
- Cliente WMS/WFS em Python usando `owslib`
- Cache local de capabilities
- Fallback para OSM quando INDE não tiver dados

---

## 2. IBGE API - Malhas Territoriais

### Análise Técnica
- **Endpoint**: `https://servicodados.ibge.gov.br/api/v3/malhas/`
- **Formato**: GeoJSON
- **Dados**: Polígonos de estados, municípios, regiões

### Ganho Técnico
✅ **MUITO ALTO** - Malhas oficiais para cálculo de áreas
✅ **Geocoding reverso** - identificar município/estado a partir de coordenadas
✅ **Limites precisos** - essencial para documentação técnica
✅ **API REST simples** - fácil integração

### Implementação Recomendada
- Serviço Node.js para buscar malha por coordenadas
- Cache das malhas mais acessadas
- Integração ao relatório de metadados do DXF

---

## 3. INPE TOPODATA - Modelos Digitais de Elevação

### Análise Técnica
- **Dados**: SRTM refinado 30m (melhor que open-elevation ~90m)
- **Formato**: GeoTIFF, WCS (Web Coverage Service)
- **Camadas**: Altitude, declividade, orientação, relevo sombreado

### Ganho Técnico
✅ **MUITO ALTO** - Resolução 30m vs 90m do open-elevation atual
✅ **Dados brasileiros validados** - correções específicas para território nacional
✅ **Declividade calculada** - ready-to-use para projetos de engenharia
✅ **Curvas de nível precisas** - melhor que interpolação do OSMnx

### Implementação Recomendada
- Substituir open-elevation pelo TOPODATA
- Download de tiles GeoTIFF por demanda
- Processamento local com rasterio

---

## 4. BDGEx - Banco de Dados Geográfico do Exército

### Análise Técnica
- **Protocolos**: WMS/WFS
- **Dados**: Cartas topográficas vetoriais/matriciais
- **Escalas**: 1:25.000 a 1:250.000
- **Acesso**: Requer cadastro (nível cidadão disponível)

### Ganho Técnico
✅ **MÉDIO** - Cartografia militar de alta qualidade
✅ **Curvas de nível oficiais** - validadas para engenharia
⚠️ **Restrição**: Requer cadastro, não é API aberta
⚠️ **Overhead**: Processo de autenticação adicional

### Implementação Recomendada
- Integração opcional (feature flag)
- Documentar processo de cadastro para usuários
- Usar como fonte complementar, não principal

---

## Decisão de Implementação

### IMPLEMENTAR (Alta Prioridade)
1. **IBGE API** - Ganho imediato, REST simples
2. **INPE TOPODATA** - Qualidade superior de elevação
3. **INDE WMS/WFS** - Dados vetoriais oficiais

### IMPLEMENTAR (Média Prioridade)
4. **BDGEx** - Como fonte complementar opcional

---

## Arquitetura de Integração

```
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│  Sis RUA        │      │  APIs Brasileiras   │      │  Fallback       │
│  Frontend       │──────▶  - IBGE (malhas)    │      │  OSM (global)   │
│                 │      │  - INDE (vetores)   │──────▶                 │
│                 │      │  - INPE (elevação)  │      │  Open-Elevation │
└─────────────────┘      └─────────────────────┘      └─────────────────┘
         │                           │                         │
         ▼                           ▼                         ▼
   Seleção no mapa           Cache local              Fallback automático
   Geração DXF               (tile-based)             se APIs falharem
```

### Cache Strategy
- IBGE: Malhas por município (long-term cache)
- INPE: Tiles GeoTIFF 1°x1° (persistent cache)
- INDE: Capabilities WMS (short-term cache, 1h)

---

## Checklist de Implementação

### Fase 1: IBGE (1-2 dias)
- [ ] Serviço `ibgeService.ts` - busca malha por coordenadas
- [ ] Integração ao geocoding - identificar município
- [ ] Cache das malhas mais comuns
- [ ] Testes de unidade

### Fase 2: INPE TOPODATA (2-3 dias)
- [ ] Serviço `topodataService.ts` - download GeoTIFF
- [ ] Substituição do elevation_client.py
- [ ] Processamento raster com rasterio
- [ ] Validação de precisão vs open-elevation

### Fase 3: INDE (3-4 dias)
- [ ] Cliente WMS/WFS com owslib
- [ ] Parser de capabilities
- [ ] Integração ao dxf_generator.py
- [ ] Feature toggle: OSM vs INDE

### Fase 4: BDGEx (1-2 dias, opcional)
- [ ] Documentação de cadastro
- [ ] Cliente WMS autenticado
- [ ] Feature flag para usuários cadastrados

---

## Referências Técnicas

### IBGE API
- Documentação: https://servicodados.ibge.gov.br/api/docs/malhas
- Exemplo: `https://servicodados.ibge.gov.br/api/v3/malhas/estados/35`

### INPE TOPODATA
- Portal: http://www.dsr.inpe.br/topodata/index.php
- Dados: GeoTIFF via FTP/HTTP

### INDE
- Catálogo: https://inde.gov.br/
- WMS Exemplo: `https://geoservicos.ibge.gov.br/geoserver/wms`

### BDGEx
- Portal: https://bdgex.eb.mil.br/
- Cadastro: Necessário nível "Cidadão"
