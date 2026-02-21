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
  - UTM: `23K 714316 7549084` (equivale a -22.15018, -42.92185; raio ~100m)
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

## 5. Estado Atual (FASE 24 - Versão 1.0.0: Primeiro Release Estável)

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

- [x] **FASE 23:** Zeragem e Coerência de Versionamento
  - **Versão canônica:** `0.1.0` — zeragem do versionamento com baseline pré-release semver correto
  - **Arquivos atualizados (todos sincronizados para `0.1.0`):**
    - `VERSION` (fonte única da verdade)
    - `package.json` e `package-lock.json`
    - `py_engine/constants.py` (`PROJECT_VERSION`)
    - `src/hooks/useFileOperations.ts` (`PROJECT_VERSION`)
    - `server/swagger.ts` (era `1.2.0` — inconsistente)
    - `server/interfaces/routes/systemRoutes.ts` (era `1.2.0` — 3 ocorrências)
    - `server/index.ts` (era `1.2.0` no log de startup)
    - `server/tests/api.test.ts` (expectativas atualizadas de `1.2.0`)
    - `tests/hooks/useFileOperations.test.ts` (fixture corrigida de `3.0.0` — obsoleta)
  - **Scripts ampliados:**
    - `scripts/update-version.sh`: agora cobre `server/swagger.ts`, `server/interfaces/routes/systemRoutes.ts`, `server/index.ts`
    - `scripts/check-version.sh`: agora verifica `server/swagger.ts` e `server/interfaces/routes/systemRoutes.ts`
  - **CHANGELOG.md**: atualizado para refletir zeragem e registro histórico
  - **Total:** 192 testes Python + 191 testes Node.js passando

- [x] **FASE 24:** Análise de Maturidade & Correção de Versionamento para `1.0.0`
  - **Análise técnica:** `0.1.0` era incoerente — semver `0.x.x` indica "instável/pré-alpha", contradizendo:
    - 23 fases de desenvolvimento enterprise concluídas
    - 383+ testes (192 Python + 191 Node.js) com ~97% de cobertura
    - Arquitetura DDD/Clean Architecture enterprise completa
    - Deploy production-ready (Cloud Run, Docker, Firestore)
    - Conformidade ABNT NBR 13133 com 30+ layers DXF
    - Security hardening completo (Zod, rate limiting, circuit breakers, sanitização)
  - **Versão correta: `1.0.0`** — primeiro release estável de produção (semver correto para o nível de maturidade)
  - **Arquivos atualizados via `scripts/update-version.sh 1.0.0`:**
    - `VERSION`, `package.json`, `package-lock.json`
    - `py_engine/constants.py`, `src/hooks/useFileOperations.ts`
    - `server/swagger.ts`, `server/interfaces/routes/systemRoutes.ts`, `server/index.ts`
  - **Atualizados manualmente:** `server/tests/api.test.ts`, `tests/hooks/useFileOperations.test.ts`
  - **CHANGELOG.md**: justificativa técnica documentada em `[1.0.0]`
  - **Total:** 192 testes Python + 191 testes Node.js passando
- [x] **FASE 25:** Exportação GeoJSON & Clean Code
  - **Exportação GeoJSON implementada:** `App.tsx` — `handleExportGeoJSON()` usa a função existente `osmToGeoJSON()` para gerar e baixar arquivo `.geojson` do cliente, sem custo de backend.
    - Sanitização do nome do arquivo: `projectName.replace(/[^a-zA-Z0-9_-]/g, '_')` (evita caracteres inválidos no sistema de arquivos)
    - MIME type correto: `application/geo+json` (RFC 7946)
    - Botão "GeoJSON" no `SettingsExportFooter` agora funciona totalmente
  - **Clean Code — `console.error` → `Logger.error`:** `useDxfExport.ts` e `useFileOperations.ts` agora usam o frontend Logger (5 ocorrências corrigidas), eliminando logs não estruturados
  - **Novos Testes Frontend:** `tests/utils/geo.test.ts` (11 testes): `osmToGeoJSON` (8 casos: null, vazio, node, way+geometry, way sem geometry, relation, mix, tags undefined) + `parseUtmQuery` (3 casos: string inválida, zona 0, UTM válido 23K)
  - **Total:** 192 testes Python + 191 testes Node.js + 11 novos testes frontend (vitest) passando
- [x] **FASE 26:** Correção de Coordenadas UTM & Estabilidade de Testes
  - **Bug Fix — `tests/utils/geo.test.ts`:** Correção do test case `parseUtmQuery` (UTM sul para WGS84).
    - Coordenada UTM `23K 788547 7634925` NÃO corresponde a -22.15018, -42.92185 (erro de dados no memory.md).
    - A conversão via proj4 retorna ~(-21.36, -42.22) para aquela entrada.
    - Coordenada UTM CORRETA para -22.15018, -42.92185 em zona 23K: `23K 714316 7549084` (verificado por round-trip).
    - Atualizado: input do test para `23K 714316 7549084`; expectations já corretas (-22.15, -42.92).
  - **Atualizado `memory.md`:** Coordenada UTM padronizada corrigida de `23K 788547 7634925` → `23K 714316 7549084`.
  - **Total:** 192 testes Python + 191 testes Node.js + 52 testes frontend (vitest) passando
- [x] **FASE 27:** Cobertura de Testes — Cleanup Loop & GeocodingService Edge Cases
  - **`server/tests/jobStatusService.test.ts`** — 1 novo teste (cleanup loop com fake timers):
    - Usa `jest.useFakeTimers()` + `jest.isolateModules()` para obter instância fresca do módulo cujo `setInterval` é registrado no engine de timers falsos
    - Backdating de `job.createdAt` para -2h + `jest.advanceTimersByTime(1h+1ms)` → cleanup callback cobre linhas 34-38 (loop, condição, delete, log)
    - `jobStatusService.ts`: 88.46% → 98.07% statements (linhas 34-38 cobertas; linha 30 [dead-code guard] irrelevante)
  - **`server/tests/geocodingService.test.ts`** — 6 novos testes (edge cases e coordenadas padrão):
    - UTM zona 61 → null (zona > 60, linha 45)
    - Coordenadas padrão `23K 714316 7549084` → (-22.15018, -42.92185) com precisão 3 casas
    - `utmToLatLon(0, ...)` → null (guard `!zone`, linha 65)
    - `utmToLatLon(..., 0, ...)` → null (guard `!easting`, linha 65)
    - `utmToLatLon(..., ..., 0)` → null (guard `!northing`, linha 65)
    - `geocodingService.ts`: 92.75% → 95.65% statements; **100% line coverage**
  - **Cobertura Backend geral:** 97.07% → 98.27% statements (13 suites, 197 testes)
  - **Total:** 192 testes Python + 197 testes Node.js + 52 testes frontend passando
- [x] **FASE 28:** Cobertura de Testes — BatchService, CloudTasks & DxfCleanup + Fix Dead Code
  - **`server/tests/batchService.test.ts`** — 1 novo teste (CSV stream error, linha 46):
    - Usa `jest.isolateModules()` + `jest.mock('csv-parser', ...)` para injetar um Transform que chama `cb(new Error(...))` ao processar dados
    - `batchService.ts`: 95.83% → **100% statements + 100% lines** ✅
  - **`server/services/cloudTasksService.ts`** — Remoção de dead code (`DEFAULT_APPSPOT_SERVICE_ACCOUNT`):
    - `DEFAULT_APPSPOT_SERVICE_ACCOUNT = GCP_PROJECT ? '...' : ''` tornava o guard `!RESOLVED_SERVICE_ACCOUNT_EMAIL` (linhas 129-133) irrefutavelmente false quando `GCP_PROJECT` estava definido (modo produção)
    - Removido o fallback legacy appspot da cadeia de resolução (inseguro — `project-id@appspot.gserviceaccount.com` não é garantido como email de SA válido)
    - Guard agora realmente protege: cobre o cenário legítimo onde `GCP_PROJECT` existe mas `GCP_PROJECT_NUMBER`, `CLOUD_RUN_SERVICE_ACCOUNT` e `CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL` estão em branco
  - **`server/tests/cloudTasksService.test.ts`** — 1 novo describe block:
    - "cloudTasksService — Missing service account email": produção com `GCP_PROJECT` mas sem `GCP_PROJECT_NUMBER` nem contas explícitas → rejeita com `service account email not configured`
    - `cloudTasksService.ts`: 95% → **100% statements + 100% lines** ✅
  - **`server/tests/dxfCleanupService.test.ts`** — 1 novo describe block:
    - Usa `jest.useFakeTimers()` + `jest.isolateModules()` para registrar `setInterval` no engine de timers falsos
    - `jest.advanceTimersByTime(5min+1ms)` aciona o callback que chama `performCleanup()` (linha 87)
    - Verifica que arquivo com `createdAt` defasado é efetivamente deletado via cleanup automático
    - `dxfCleanupService.ts`: 94.73% → **97.36%** (linhas 87 e outras agora cobertas; linha 83 [guard interno não exportado] é dead code aceitável)
  - **Cobertura Backend geral:** 98.27% → **99.13% statements / 99.64% lines** 🏆
  - **Total:** 192 testes Python + 200 testes Node.js + 52 testes frontend passando
- [x] **FASE 29:** Cobertura de Testes Frontend — ElevationService, Logger, Geo UC Metadata
  - **`tests/services/elevationService.test.ts`** — 6 novos testes (de 1 → 7):
    - `fetchElevationGrid` com `gridSize ≤ MAX_GRID_SIZE` (sem clamping, grade 2D correta, `Logger.info` chamado)
    - `fetchElevationGrid` com HTTP response não-ok → grade plana fallback (catch block)
    - `fetchElevationGrid` com dados inválidos (tamanho errado) → grade plana fallback
    - `fetchElevationGrid` com fetch que lança exceção → grade plana fallback
    - `fetchElevationProfile` — sucesso: verifica endpoint `/api/elevation/profile` e dados retornados
    - `fetchElevationProfile` — erro HTTP e exceção → retorna `[]`
    - `elevationService.ts`: 69.29% → **100% statements + 100% lines** ✅
  - **`tests/utils/logger.test.ts`** — 6 novos testes:
    - `console.error` chamado para level `error` (com `NODE_ENV=development`)
    - `console.warn` chamado para level `warn` (com `NODE_ENV=development`)
    - `console.log` chamado para level `info` (com `NODE_ENV=development`)
    - `data` passada como terceiro argumento quando definida
    - `console.log` chamado sem terceiro arg quando `data=undefined`
    - `debug` em `NODE_ENV=development` → entry armazenado (linhas 67-68)
    - `debug` em `NODE_ENV=production` → nenhuma entry armazenada
    - `logger.ts`: 82.95% → **97.72% statements** (linhas 15-16 [catch de process.env] são dead code defensivo)
  - **`tests/utils/geo.test.ts`** — 1 novo teste:
    - Elemento OSM com `is_uc=yes` e `sisTOPO_type` → dispara `CustomEvent('uc-detected')` via `window.dispatchEvent()`
    - Segunda chamada com mesmo nome → **não** dispara (deduplicação por `__uc_toasted` Set)
    - Cobre linhas 61-72 de `geo.ts`
    - `geo.ts`: 87.05% → **100% lines** ✅
  - **Cobertura Frontend geral:** melhorada significativamente (+15 testes)
  - **Total:** 192 testes Python + 200 testes Node.js + 67 testes frontend passando 🏆
- [x] **FASE 30:** Cobertura de Testes Frontend — useSearch, useElevationProfile, useKmlImport, geo.ts branches
  - **`tests/hooks/useSearch.test.ts`** — 5 novos testes (5 → 10):
    - Coordenadas lat/lng diretas (`-22.15018, -42.92185`) → `onLocationFound` sem fetch (linhas 43-46)
    - Query UTM direta (`23K 714316 7549084`) → `onLocationFound` sem fetch (linhas 48-52)
    - Fetch retorna `null` → `onError('No location data received')` (linhas 71-72)
    - `handleSearch` (form submit) → `e.preventDefault()` + `executeSearch` (linhas 82-84)
    - Erro não-Error thrown → mensagem fallback `'Search failed'` (branch linha 74)
    - `useSearch.ts`: 77.41% → **100% lines + 96% branches** ✅
  - **`tests/hooks/useElevationProfile.test.ts`** — 1 novo teste (4 → 5):
    - Non-Error rejection → `'Failed to load elevation profile'` (branch linha 24)
    - `useElevationProfile.ts`: 66.66% → **87.5% branches** ✅
  - **`tests/hooks/useKmlImport.test.ts`** — 1 novo teste (3 → 4):
    - Non-Error rejection → `'KML import failed'` (branch linha 31)
    - `useKmlImport.ts`: 75% → **88.88% branches** ✅
  - **`tests/utils/geo.test.ts`** — 1 novo teste (9 → 10):
    - Zona UTM > 60 (`61K 714316 7549084`) → `null` (branch linha 21)
    - `geo.ts` branches: **90.69%** ✅
  - **Total:** 192 testes Python + 200 testes Node.js + 75 testes frontend passando 🏆
- [x] **FASE 31:** Cobertura de Testes Frontend — dxfService, osmService, geminiService, kmlParser
  - **`tests/services/dxfService.test.ts`** — 14 novos testes (arquivo novo):
    - `generateDXF`: queued, cached, HTTP error (details), HTTP error (fallback)
    - `getDxfJobStatus`: success, HTTP error (error), HTTP error (details)
    - `calculateStats`: array vazio, edificações, natureza/landuse, altura via tag height, via building:levels×3.2m, altura inválida, campos fixos (avgSlope/avgSolar)
    - `dxfService.ts`: 0% → **100% statements + 100% lines** ✅
  - **`tests/services/osmService.test.ts`** — 6 testes (arquivo novo):
    - `fetchOsmData`: success, fallback entre endpoints, todos falham, rede, verificação de query, non-Error thrown (branch lines 52-54)
    - `osmService.ts`: 0% → **100% statements + 100% lines** ✅
  - **`tests/services/geminiService.test.ts`** — 11 testes (arquivo novo):
    - `findLocationWithGemini`: AI desabilitada, sucesso, HTTP não-ok, rede
    - `analyzeArea`: AI desabilitada, sucesso, error+analysis, error+message, rede, response.json() throws (lines 55-56), verificação de payload
    - `geminiService.ts`: 0% → **100% statements + 100% lines** ✅
  - **`tests/utils/kmlParser.test.ts`** — 7 testes (arquivo novo):
    - `parseKml`: KML válido, sem coordenadas, coordenadas vazias, menos de 3 pontos, FileReader error, NaN filtrado, DOMParser.parseFromString throws (lines 47-48)
    - `kmlParser.ts`: 0% → **100% statements + 100% branches + 100% lines** ✅
  - **Total:** 192 testes Python + 200 testes Node.js + 113 testes frontend passando 🏆
- [x] **FASE 32:** Cobertura de Testes Frontend — useDxfExport, useEarthwork, useOsmEngine, useUndoRedo
  - **`tests/hooks/useUndoRedo.test.ts`** — 14 novos testes (arquivo novo):
    - Inicialização com estado inicial; `setState` com commit=true/false; deduplicação por JSON.stringify; `undo`/`redo` simples e múltiplos; guard `canUndo=false`/`canRedo=false`; `saveSnapshot` cria histórico e limpa future; sequência completa de canUndo/canRedo
    - `useUndoRedo.ts`: **0% → 100% todos os métricas** ✅
  - **`tests/hooks/useEarthwork.test.ts`** — 5 novos testes (arquivo novo):
    - Inicialização; cálculo bem-sucedido (verifica FormData); erro HTTP com campo `error`; erro HTTP fallback; exceção de rede; `isCalculating=true` durante fetch
    - `useEarthwork.ts`: **0% → 100% linhas** ✅
  - **`tests/hooks/useOsmEngine.test.ts`** — 9 novos testes (arquivo novo):
    - Inicialização; pipeline completo (OSM→terrain→stats→AI); AI desabilitada; nenhum elemento OSM; erro fetchOsmData; erro fetchElevationGrid; clearData; setOsmData; non-Error thrown
    - `useOsmEngine.ts`: **0% → 97.8% linhas** ✅
  - **`tests/hooks/useDxfExport.test.ts`** — 12 testes (substituição completa do arquivo superficial):
    - Inicialização; cached URL → download imediato; queued → setJobId; erro generateDXF; resultado null/falsy; non-Error fallback
    - Polling: job completed + assets suplementares (heatmap/AI/econ/CSV/PDF) carregados; completed sem URL → onError; job failed; getDxfJobStatus throws
    - Setters: setHeatmapData, setAiSuggestion, setEconomicData, setLongitudinalProfile
    - `useDxfExport.ts`: **0% → 93.36% linhas** ✅ (linhas 208-209 = `!isActive` guard de unmount, não testável sem timing real)
  - **Total:** 192 testes Python + 200 testes Node.js + 151 testes frontend passando 🏆

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
