# sisTOPOGRAFIA - Memória de Contexto do Sistema (RAG)

> **Objetivo:** Fornecer contexto imediato, arquitetural e situacional para a IA (Fullstack Sênior), evitando re-leitura desnecessária de arquivos grandes. Atualize este documento sempre que houver mudanças significativas de arquitetura ou novas funcionalidades.

---

## 1. Arquitetura Geral (Thin Frontend / Smart Backend)

O sistema segue conceitos de **Clean Architecture** e **DDD (Domain-Driven Design)**, dividido em três camadas principais:

### 1.1 Frontend (React, Vite, TailWindCSS, Leaflet)

- **Local:** `/src`
- **Responsabilidade:** Renderização da UI (Glassmorphism), interação com o mapa (Leaflet), desenho de polígonos e envio de requisições simplificadas para o Node.js.
- **Componentes Chave:**
  - `App.tsx` (~302 linhas): Componente raiz. Usa hooks e delega UI para subcomponentes.
  - `components/layout/AppHeader.tsx`: Header da aplicação (auth, navegação, IA).
  - `components/layout/AppSidebar.tsx`: Painel lateral (busca, controles, resultados).
  - `components/layout/MapOverlayControls.tsx`: Botões overlay sobre o mapa.
  - `components/gis/MapSelector.tsx`: Mapa Leaflet principal.
  - `components/settings/`: Módulos do painel de configuração (SRP): `LayerToggle`, `SettingsGeneralTab`, `SettingsProjectTab`, `SettingsExportFooter`.
  - `components/SettingsModal.tsx` (~119 linhas): Orquestrador do modal de configuração.
  - Painéis de Analytics (`EarthworkPanel`, `HydrologicalProfilePanel`): Coletam input e geram payloads.
- **Auth & Storage:** Firebase Auth + Firestore para sessão e salvamento de projetos `.osmpro`.

### 1.2 Backend Server (Node.js, Express)

- **Local:** `/server`
- **Responsabilidade:** API REST para o Frontend, validação (Zod), rate limiting, orquestração do Motor Python.
- **Integração Python:** `pythonBridge.ts` usa `child_process.spawn` para invocar scripts Python e parsear `stdout` (JSON).

### 1.3 Motor Geoprocessamento (Python)

- **Local:** `/py_engine`
- **Responsabilidade:** Core intelligence matemática avançada, geração de arquivos CAD (.dxf) pesados, algoritmos 2.5D.
- **Estrutura DDD (modular):**
  - `controller.py`: Orquestrador. Delega para use cases.
  - `main.py`: Entrypoint CLI.
  - `dxf_generator.py` (~365 linhas): Classe principal DXF. Delega para módulos SRP.
  - `dxf_geometry_drawer.py` (~240 linhas): **[NOVO]** Desenho de geometrias (polígonos, linhas, pontos).
  - `dxf_terrain_drawer.py` (~200 linhas): **[NOVO]** Desenho de terreno (TIN, curvas, hidrologia, raster).
  - `dxf_styles.py`: Gerenciamento de estilos e layers CAD.
  - `layer_classifier.py`: Classificação de features OSM em layers CAD.
  - `legend_builder.py`: Construção de legenda e quadro de título.
  - `bim_data_attacher.py`: Anexação de dados BIM (XDATA) às entidades.
  - `/domain/services/`: Algoritmos de negócio (cut_fill, contours, environmental_engine, hydrology).
  - `/infrastructure/external_api/`: Fetchers de APIs externas (elevation, OSM, IBGE, INCRA).
  - `/infrastructure/adapters/`: Adaptadores de APIs ambientais (ICMBio, INEA).

## 2. Padrões OBRIGATÓRIOS do Projeto (Regras Globais)

- **Layering CAD:** TODAS as layers geradas no `.dxf` DEVEM conter o prefixo `sisTOPO_` (ex: `sisTOPO_VIAS`, `sisTOPO_EDIFICACAO`). **CRÍTICO: Este padrão foi corrigido e validado em Fase 11.**
- **Dimensão Espacial:** Todo o ecossistema é 2.5D. Usar lwpolyline com `elevation`, `thickness` e 3DFACE para TIN. NUNCA usar `LINE` 3D puro.
- **Custo Zero:** Todo provedor externo usa Free Tier. Groq API (IA), OSMNx, Open-Elevation, IBGE/INCRA APIs públicas.
- **Coordenadas de Teste Padronizadas:**
  - UTM: `23K 788547 7634925` (raio ~100m)
  - Decimal: `-22.15018, -42.92185` (raio ~500m e 1km)
- **Docker First:** Infraestrutura pronta para Cloud Run.
- **Limite de Linhas:** Arquivos > 500 linhas DEVEM ser modularizados. Usar SRP.

## 3. Convenção de Layers DXF (sisTOPO_)

```
sisTOPO_EDIFICACAO          # Edificações (com ANSI31 hatch)
sisTOPO_VIAS                # Vias (com sisTOPO_VIAS_MEIO_FIO)
sisTOPO_VIAS_MEIO_FIO       # Curb offsets das vias
sisTOPO_VEGETACAO           # Vegetação / árvores
sisTOPO_EQUIPAMENTOS        # Equipamentos urbanos
sisTOPO_MOBILIARIO_URBANO   # Mobiliário urbano
sisTOPO_HIDROGRAFIA         # Rios, córregos, corpos d'água (waterway/natural:water)
sisTOPO_TERRENO_PONTOS      # Pontos de grade de terreno
sisTOPO_TERRENO_TIN         # Malha TIN (3DFACE)
sisTOPO_CURVAS_NIVEL_MESTRA # Curvas de nível mestras (5x intervalo)
sisTOPO_TOPOGRAFIA_CURVAS   # Curvas de nível intermediárias
sisTOPO_RESTRICAO_APP_30M   # Buffer APP Legal 30m (Código Florestal)
sisTOPO_USO_RESIDENCIAL     # Uso do solo: residencial
sisTOPO_USO_COMERCIAL       # Uso do solo: comercial
sisTOPO_USO_INDUSTRIAL      # Uso do solo: industrial
sisTOPO_USO_VEGETACAO       # Uso do solo: vegetação/floresta
sisTOPO_UC_FEDERAL          # Unidade de Conservação Federal (ICMBio)
sisTOPO_UC_ESTADUAL         # Unidade de Conservação Estadual (INEA)
sisTOPO_UC_MUNICIPAL        # Unidade de Conservação Municipal
sisTOPO_INFRA_POWER_HV      # Infraestrutura elétrica alta tensão
sisTOPO_INFRA_POWER_LV      # Infraestrutura elétrica baixa tensão
sisTOPO_INFRA_TELECOM       # Infraestrutura de telecomunicações
sisTOPO_TEXTO               # Textos / rótulos
sisTOPO_ANNOT_AREA          # Anotações de área (m²)
sisTOPO_ANNOT_LENGTH        # Anotações de comprimento (m)
sisTOPO_LEGENDA             # Legenda cartográfica
sisTOPO_QUADRO              # Quadro de título
sisTOPO_MALHA_COORD         # Malha de coordenadas
sisTOPO_PONTOS_COORD        # Marcos geodésicos (blocos)
sisTOPO_PONTOS_TEXTO        # Textos de marcos geodésicos
sisTOPO_MDT_IMAGEM_SATELITE # Raster satélite overlay
sisTOPO_RISCO_ALTO          # Hachura de risco alto (declividade > 100%)
sisTOPO_RISCO_MEDIO         # Hachura de risco médio (declividade 30-100%)
```

## 4. Fluxos de Dados Principais

1. **Geração DXF:**
   `Frontend (Lat/Lon/Raio)` → `POST /api/generate-dxf` → `pythonBridge.ts` → `main.py` → `OSMController.run()` → `DXFGenerator` + `DXFGeometryDrawer` + `DXFTerrainDrawer` → `arquivo.dxf`

2. **Cálculo de Terraplenagem 2.5D:**
   `EarthworkPanel` → `POST /api/analyze-pad` → `CutFillOptimizer` → `{cut: m³, fill: m³}`

3. **Raster Satélite:**
   `quota_manager.py` (SQLite) → `google_maps_static.py` → `.png` → `DXFTerrainDrawer.add_raster_overlay()`

## 5. Estado Atual (FASE 22 - Input Validation Hardening & ABNT Script Fix)

### Concluído:
- [x] Correção do prefixo `sisTOPO_` em todas as layers (87 testes passando)
- [x] Modularização: `dxf_generator.py` 868→365 linhas (SRP)
- [x] Novo módulo: `dxf_geometry_drawer.py` (geometrias)
- [x] Novo módulo: `dxf_terrain_drawer.py` (terreno, TIN, curvas, hidrologia)
- [x] Modularização: `src/App.tsx` 763→302 linhas
- [x] Novos componentes: `AppHeader.tsx`, `AppSidebar.tsx`, `MapOverlayControls.tsx`
- [x] 15 novos testes unitários para módulos SRP (`test_modular_drawers.py`)
- [x] `fpdf2` adicionado em `requirements.txt`
- [x] `.gitignore` atualizado com padrões de banco de dados e output
- [x] **FASE 13:** Modularização de `SettingsModal.tsx` 567→119 linhas (SRP)
  - `components/settings/LayerToggle.tsx`: Componente de toggle de layer reutilizável
  - `components/settings/SettingsGeneralTab.tsx`: Aba de configurações gerais (layers, sistema, aparência)
  - `components/settings/SettingsProjectTab.tsx`: Aba de projeto e metadados (storage, carimbo)
  - `components/settings/SettingsExportFooter.tsx`: Rodapé de exportação (DXF, GeoJSON)
- [x] **FASE 14:** Cobertura de Testes - Camada de Aplicação (DDD)
  - `test_use_cases.py` (21 testes): `OsmFetcherUseCase`, `EnvironmentalExtractorUseCase`, `HydrologyService`
  - `test_cut_fill_optimizer.py` (8 testes): `CutFillOptimizer` com mock da API de elevação
  - Waterway detection testada (APP 30m buffer com GDFs sintéticos projetados)
  - Movido `@testing-library/dom` para `devDependencies` no `package.json`
- [x] **FASE 15:** Enterprise Hardening & Clean Code
  - **Bug Fix:** Bloco `except Exception` duplicado removido de `dxf_generator.add_geodetic_marker()` (dead code)
  - **No-Mock Rule:** `EconomicAnalysisUseCase.execute()` — `drain_length` substituído por cálculo derivado de `sqrt(total_volume) * slope_factor`; `solar_avg` lê média real do array numpy de analytics
  - **Novos Testes:** `test_enterprise_features.py` (16 testes): `EconomicAnalysisUseCase` (10 casos) + `SuggestiveDesignUseCase` (6 casos) com GroqAdapter mockado
  - **Total:** 132 testes Python passando (116 + 16)
- [x] **FASE 16:** Cobertura de Testes Backend & Sanitização de Entradas
  - **Sanitização Python:** `validate_coordinates()` adicionada em `utils/geo.py` — valida lat, lon, raio contra NaN, Inf e limites geográficos
  - **Integração:** `controller.py` chama `validate_coordinates()` no `__init__` antes de qualquer processamento
  - **Novos Testes Python:** `test_input_sanitization.py` (29 testes): `validate_coordinates`, `utm_zone`, `sirgas2000_utm_epsg`
  - **Novos Testes Backend:** `server/tests/jobStatusService.test.ts` (17 testes): ciclo completo de jobs
  - **Novos Testes Backend:** `server/tests/dxfCleanupService.test.ts` (8 testes): agendamento e limpeza de DXF
  - **Ampliação:** `server/tests/elevationService.test.ts` +9 testes incluindo mock de fetch e fallback de terreno plano
  - **Cobertura Backend melhorada:** 62.92% → 83.17% (statements)
    - `elevationService.ts`: 34.48% → 100%
    - `jobStatusService.ts`: 26.92% → 88.46%
    - `dxfCleanupService.ts`: 34.21% → 71.05%
  - **Gitignore:** Removidos do tracking arquivos de debug/diagnóstico (debug_*.py, audit_*.txt, *.db) seguindo regras existentes
  - **Total:** 161 testes Python + 79 testes Node.js passando
- [x] **FASE 17:** Cache OSM & Feature Completeness
  - **Cache OSM em memória:** `osmnx_client.py` agora implementa cache TTL (1 hora) baseado em SHA-256 dos parâmetros. Zero custo — sem dependências externas. Evita chamadas redundantes à API OSMNx.
    - `_cache_key()`: gera chave determinística por lat/lon/radius/tags/polygon
    - `_get_cached()` / `_set_cache()`: get/set com validação de TTL
    - `clear_osm_cache()`: limpeza explícita (testes e rotação)
  - **Feature Completeness — `OsmFetcherUseCase.build_tags()`:**
    - Adicionado suporte à config `equipment` → tags OSM: `leisure`, `man_made`
    - Adicionado suporte à config `infrastructure` → tags OSM: `power`, `telecom`
    - Alinhamento completo com `layer_classifier.py` (sisTOPO_EQUIPAMENTOS, INFRA_POWER_*, INFRA_TELECOM)
    - `controller._normalize_layers_config(cadastral=True)` já normalizava para `equipment=True`; agora build_tags() consome corretamente
  - **Novos Testes Python:** `test_fase17_osm_cache.py` (19 testes):
    - `TestOsmCache` (9 testes): cache key, miss, set/get, TTL expirado, clear, integração com fetch
    - `TestOsmFetcherEquipmentTags` (10 testes): equipment, infrastructure, combinado, alias cadastral
  - **Total:** 180 testes Python passando
- [x] **FASE 18:** Cache Persistente em Disco & Cobertura de Testes Backend
  - **Cache OSM L2 (disco):** `osmnx_client.py` agora implementa cache hierárquico L1 (memória) + L2 (disco, pickle).
    - `_OSM_CACHE_DIR`: configurável via `OSM_CACHE_DIR` env var; padrão `/tmp/sistopografia_osm_cache` (Cloud Run compatible)
    - `_get_disk_cached()` / `_set_disk_cache()`: get/set em disco com TTL e tratamento de corrupção
    - `_disk_cache_path()`: path determinístico por chave SHA-256
    - `clear_osm_cache()` atualizado: limpa L1 e L2 (arquivos `.pkl` no diretório de cache)
    - Promoção L2→L1: hit em disco popula automaticamente a memória para requisições subsequentes
    - Tolerância a falhas: erros de I/O em disco são silenciosos — sem impacto no fluxo principal
  - **Bug Fix E2E:** `e2e/dxfGeneration.spec.ts` linha 67 — template literal corrigido (`${lat}, ${lon}`)
  - **Cobertura Backend melhorada:** 83.17% → 93.14% (statements)
    - `cloudTasksService.ts`: 56.66% → 95% (+15 novos testes: modo dev, produção, getTaskStatus, erros)
    - `dxfCleanupService.ts`: 71.05% → 94.73% (+5 novos testes: Date.now mockado, fs.unlinkSync error, log de ciclo)
  - **Novos Testes Python:** `test_fase18_disk_cache.py` (12 testes):
    - `TestOsmDiskCache` (12 testes): path, set/get, TTL expirado, corrupção, dir inexistente, clear, promoção L2→L1, criação de diretório
  - **Total:** 192 testes Python + 94 testes Node.js passando
- [x] **FASE 19:** Integração Cross-Instance & Refinamentos Enterprise
  - **Cross-instance real:** `taskRoutes.ts` e `GenerateDxfUseCase.ts` agora usam `jobStatusServiceFirestore.ts` e `cacheServiceFirestore.ts`
    - Em produção (`USE_FIRESTORE=true`): estado de jobs e cache DXF persistidos no Firestore — cross-instance nativo em Cloud Run multi-réplica
    - Em desenvolvimento (`USE_FIRESTORE=false`): fallback automático para memória — zero impacto no DX
    - Todas as chamadas agora são `async/await` — sem fire-and-forget em rotas críticas
  - **Rate Limiter pt-BR:** Mensagens de erro do rate limiter (`dxfRateLimiter` e `generalRateLimiter`) traduzidas para português (pt-BR)
  - **Health Endpoint melhorado:** `/health` agora reporta `firestoreEnabled` e `osmCache.entries` (monitoramento zero-cost do cache L2 em disco)
  - **Novos Testes Backend:** `server/tests/jobStatusServiceFirestore.test.ts` (8 testes): ciclo completo em modo memória
  - **Novos Testes Backend:** `server/tests/cacheServiceFirestore.test.ts` (7 testes): createCacheKey, set/get/delete/TTL em modo memória
  - **Total:** 192 testes Python + 113 testes Node.js passando
- [x] **FASE 20:** Enterprise Hardening - Cobertura de Testes Firestore & Correção de Timer Leaks
  - **Correção de timer leaks:** `cacheServiceFirestore.ts` e `jobStatusServiceFirestore.ts` armazenam referência do `setInterval` e expõem `stopCleanupInterval()` para limpeza correta em testes (prevenindo "worker process failed to exit gracefully").
  - **Refatoração `isFirestoreEnabled()`:** `USE_FIRESTORE` de constante de módulo para função chamada em runtime — permite que testes alterem `process.env.USE_FIRESTORE` sem recarregar módulos.
  - **Cobertura de Testes Backend massivamente expandida:** 73.17% → 96.06% (statements)
    - `cacheServiceFirestore.ts`: 50.51% → 100% (statements)
    - `jobStatusServiceFirestore.ts`: 40.76% → 100% (statements)
  - **Novos Testes Backend (41 novos testes):**
    - Paths Firestore (USE_FIRESTORE=true) para todos os métodos (createJob, getJob, updateJobStatus, completeJob, failJob)
    - Circuit breaker fallback com job/cache existente em memória (linhas 121-126, 169-173, 214-217)
    - Limpeza de jobs antigos com `jest.spyOn(Date, 'now')` (try-finally para restauração segura)
    - Serialização determinística de arrays no `createCacheKey` (linha 56 coberta)
    - Timeout de cache e expiração TTL em modo Firestore
    - Erros críticos vs circuit breaker em todos os handlers
  - **Total:** 192 testes Python + 154 testes Node.js passando
- [x] **FASE 21:** Performance Monitoring & Rate Limiter 100% Coverage
  - **Novo módulo SRP:** `server/middleware/monitoring.ts` — middleware de monitoramento de performance
    - Registra método, caminho, status HTTP e duração (ms) de cada requisição via `logger.info`
    - Emite `logger.warn` para requisições lentas (> 5.000 ms) — sem dependências externas (zero custo)
    - Responsabilidade única: apenas observação — sem lógica de negócio (SRP)
    - Registrado globalmente em `server/index.ts` após `generalRateLimiter`
  - **Rate Limiter testável:** `keyGenerator` exportado de `rateLimiter.ts` como named export
    - Permite testes diretos da função de geração de chave (IPv4, IPv6, fallback 'unknown')
  - **Cobertura Backend melhorada:** 96.06% → 97.02% (statements)
    - `rateLimiter.ts`: 58.33% → 100% (statements + branches + funcs + lines) — handlers e keyGenerator totalmente testados
    - `monitoring.ts`: Novo módulo — 100% (statements + branches + funcs + lines) desde o primeiro commit
  - **Novos Testes Backend (7 novos testes):**
    - `server/tests/rateLimiter.test.ts`: +3 testes diretos de `keyGenerator` (IPv4, IPv6, undefined), +2 testes de handlers (DXF e geral com valores completos)
    - `server/tests/monitoring.test.ts`: 6 testes (next(), log de conclusão, slow request warn, sem warn rápido, status HTTP, arredondamento)
  - **Total:** 192 testes Python + 161 testes Node.js passando

- [x] **FASE 22:** Input Validation Hardening & ABNT Script Fix
  - **Novo schema Zod:** `analyzePadSchema` adicionado em `server/schemas/apiSchemas.ts`
    - Valida `polygon` como string não-vazia com limite de 50.000 caracteres (proteção contra payloads gigantes)
    - Valida `target_z` como número coercível no intervalo [-500m, 9000m] (faixa de cotas plausível no Brasil)
  - **Validação Zod em `geoRoutes.ts`:** Rota `POST /api/analyze-pad` agora usa `analyzePadSchema.safeParse()` em vez de checagem manual `if (!polygon || !target_z)`, alinhando-a ao padrão de todas as outras rotas do sistema.
  - **Bug Fix ABNT:** `py_engine/scripts/verify_abnt_standards.py`
    - Comentário do cabeçalho corrigido: `TOPO_*` → `sisTOPO_*`
    - Mensagens de erro agora usam `sisTOPO_CURVAS_NIVEL_MESTRA` (prefixo correto)
    - Layer de curvas intermediárias corrigida: `sisTOPO_CURVAS_NIVEL_INTERM` (inexistente) → `sisTOPO_TOPOGRAFIA_CURVAS` (nome real, conforme `memory.md` e `dxf_styles.py`)
  - **Novos Testes Backend:** `server/tests/apiSchemas.test.ts` (30 testes):
    - `searchSchema` (4 testes): query vazia, longa, válida, coordenadas
    - `elevationProfileSchema` (5 testes): lat/lon fora do range, steps default, steps acima do limite
    - `analyzePadSchema` (10 testes): coerção de string, polygon vazio/ausente, target_z ausente/fora do range/-500 a 9000, payload gigante, valor negativo válido
    - `analysisSchema` (3 testes): stats básicos, sem locationName, buildings negativo
    - `batchRowSchema` (4 testes): linha válida, nome com caractere especial, raio acima do limite, modo default
    - `dxfRequestExtendedSchema` (4 testes): DXF válido, raio, modo inválido, coerção string→number
  - **Total:** 192 testes Python + 191 testes Node.js passando

### Em Andamento:
- [ ] Testes E2E com Playwright (requerem servidor ativo)


## 6. Regras de Desenvolvimento

### SRP (Single Responsibility Principle):
- `DXFGenerator`: Orquestração e API pública do DXF
- `DXFGeometryDrawer`: APENAS desenho de geometrias (polígonos, linhas, pontos)
- `DXFTerrainDrawer`: APENAS terreno (TIN, curvas, hidrologia, raster)
- `LegendBuilder`: APENAS legenda e quadro de título
- `LayerClassifier`: APENAS classificação de features em layers
- `BimDataAttacher`: APENAS anexação de XDATA BIM

### Circuit Breaker (APIs externas):
- APIs governamentais (ICMBio, INEA) DEVEM retornar `None` em timeout/conexão falha
- O DXF DEVE ser gerado mesmo com TODAS as APIs offline
- Ver `TestAPICircuitBreaker` em `test_phase11_hardening.py`

### Segurança:
- Input do usuário: sanitizar via Zod (backend) + validação Python
- Nenhum dado externo não sanitizado deve ir direto para o DXF
- APIs públicas: rate limiting via `quota_manager.py` (SQLite local)

## 7. Roles da Equipe de Desenvolvimento

### Tech Lead (Orquestrador)
- **Responsabilidade:** Visão arquitetural, decisões de design de sistema, revisão de PRs críticos, garantir aderência ao DDD e SRP.
- **Foco:** Manter coerência entre camadas (Frontend → Node.js → Python), evolução da arquitetura, atualização do `memory.md`.
- **Ferramentas:** GitHub Issues/PRs, arquitetura de software, definição de interfaces entre módulos.

### Dev Fullstack Sênior (Principal Coder)
- **Responsabilidade:** Implementação de features completas (frontend + backend + Python engine), refatoração, modularização de código > 500 linhas.
- **Foco:** Clean Code, SRP, performance, integração entre camadas, Zero Cost APIs.
- **Stack:** TypeScript/React (frontend), Node.js/Express (backend), Python/ezdxf/geopandas (engine).

### DevOps/QA (Testes e Infraestrutura)
- **Responsabilidade:** Manter Docker, CI/CD, testes unitários e E2E, validação headless de `.dxf` (accoreconsole.exe), cobertura de testes.
- **Foco:** `pytest` (Python), Jest (Node.js), Playwright (E2E), Docker Compose, Cloud Run.
- **Regra:** Executar `python -m pytest py_engine/tests/` após toda mudança no motor Python.

### UI/UX Designer (Interfaces)
- **Responsabilidade:** Interface em pt-BR, Glassmorphism design system, acessibilidade, consistência visual.
- **Foco:** Componentes React responsivos, TailwindCSS, feedback visual ao usuário, UX de mapas.
- **Regra:** Toda interface deve usar terminologia em pt-BR. Sem texto hardcoded em inglês na UI.

### Estagiário (Criatividade Fora da Caixa)
- **Responsabilidade:** Propor soluções inovadoras, pesquisar novas APIs gratuitas, prototipar ideias experimentais.
- **Foco:** OSM features não exploradas, integrações criativas (IBGE, INEA, ICMBio), otimizações não óbvias.
- **Regra:** Toda proposta deve ser Zero Cost e não quebrar os testes existentes.
