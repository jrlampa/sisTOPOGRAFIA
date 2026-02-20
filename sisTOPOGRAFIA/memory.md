# sisTOPOGRAFIA - Memória de Contexto do Sistema (RAG)

> **Objetivo:** Fornecer contexto imediato, arquitetural e situacional para a IA (Fullstack Sênior), evitando re-leitura desnecessária de arquivos grandes. Atualize este documento sempre que houver mudanças significativas de arquitetura ou novas funcionalidades grandes.

---

## 1. Arquitetura Geral (Thin Frontend / Smart Backend)

O sistema segue conceitos de **Clean Architecture** e **DDD (Domain-Driven Design)**, dividido em três camadas principais:

### 1.1 Frontend (React, Vite, TailWindCSS, Leaflet)

- **Local:** `/src`
- **Responsabilidade:** Renderização da UI (Glassmorphism), interação com o mapa (Leaflet), desenho de polígonos e envio de requisições simplificadas para o Node.js.
- **Componentes Chave:**
  - `MapSelector.tsx`: Componente principal do Leaflet (desenha modes: `circle`, `polygon`, `measure`, `pad`).
  - Painéis de Analytics (`EarthworkPanel`, `HydrologicalProfilePanel`): Coletam input do usuário e geram payloads.
- **Auth & Storage:** Usa `Firebase Auth` e `Firestore` para sessão e salvamento de `.osmpro` geolocalizado na nuvem.

### 1.2 Backend Server (Node.js, Express)

- **Local:** `/server`
- **Responsabilidade:** API REST para o Frontend, validação de segurança (Zod), rate limiting (express-rate-limit), e orquestrar a execução do Motor Python.
- **Integração Python:** `pythonBridge.ts` usa `child_process.spawn` para invocar scripts Python (via executável local ou Docker) e fazer parser do `stdout` (JSON).

### 1.3 Motor Geoprocessamento (Python)

- **Local:** `/py_engine`
- **Responsabilidade:** Core intelligence matemática avançada, geração de arquivos CAD (.dxf) pesados, e algoritmos 2.5D.
- **Estrutura DDD:**
  - `/domain`: Lógica de negócio (algoritmos topológicos como `cut_fill_optimizer.py`, `environmental_engine.py`, `contours.py`).
  - `/infrastructure/cad`: Responsável direto pelo DXF (`dxf_generator.py`, `dxf_adapter.py`, `dxf_styles.py`).
  - `/infrastructure/external_api`: Comitê de fetchers (`elevation_client.py` [OpenElevation DEM], `osmnx_client.py` [OSM], `google_maps_static.py` [Raster satélite]).

## 2. Padrões OBRIGATÓRIOS do Projeto (Regras Globais)

- **Layering CAD:** TODAS as layers geradas no `.dxf` DEVEM conter o prefixo `sisTOPO_` (ex: `sisTOPO_VIAS`, `sisTOPO_EDIFICACAO`).
- **Dimensão Espacial:** Todo o ecossistema é voltado a análises em **2.5D**. Não usar puro 3D.
- **Custo Zero Ext:** Todo provedor externo (APIs) deve ser mantido na "Free Tier". (Zero custo a todo custo). Ferramenta principal: Groq API (IA), OSMNx, Open-Elevation.
- **Coordenadas de Teste Padronizadas:**
  - UTM: `23K 788547 7634925` (raios ~100m)
  - Decimal: `-22.15018, -42.92185` (raio max ~1km)
- **Docker First:** A infraestrutura e scripts Python são escritos preparados para serem envelopados via container (Cloud Run).

## 3. Fluxos de Dados (Data Flow) Principais

1. **Geração DXF Padrão:**
   `Frontend Map (Lat/Lon/Radius)` -> `Node.js POST /api/generate-dxf` -> `pythonBridge` chama `main.py` -> Cria o Cache Local / Roda `dxf_generator` -> Retorna ID/Link do arquivo.
2. **Cálculo de Terraplenagem 2.5D (Pad Earthworks):**
   `Frontend (EarthworkPanel)` desenha um Polígono e define Target Z -> POST `/api/analyze-pad` -> `analyze_pad.py` roda `CutFillOptimizer` -> Busca Malha DEM HR local -> Calcula Voxels -> Retorna `{"cut": m3, "fill": m3}`.
3. **Imagens Raster Satellite:**
   DXF processa a latitude central -> Aciona `quota_manager.py` (Limite SQLite) -> `google_maps_static.py` -> Traz .png -> Adiciona ao ModelSpace cartográfico (`sisTOPO_MDT_IMAGEM_SATELITE`).

## 4. Estado Atual "AS IS" (Momento Presente: FASE 9)

Nós alcançamos a Maturidade BIM Enterprise da Fase 8. O foco atual (Fase 9) é enriquecimento "AS-IS":

- [EM ANDAMENTO] - Implementar detecção automática de Rios (`waterway`) no OSM via Python.
- [EM ANDAMENTO] - Gerar geometrias de **buffer 30m** com `shapely` representando Áreas de Preservação Permanente (APP Legal).
- [EM ANDAMENTO] - Buscar dados de Zoneamento (`landuse`) via OSM.
- [EM ANDAMENTO] - Extrair XDATA de altura `building:levels` ou `height` diretamente nas tags do OSM para edifícios (sisTOPO_EDIFICACAO) proporcionando elevações precisas pro DXF e Metadados.
