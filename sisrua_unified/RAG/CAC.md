# sisRUA Unified — Cache Advanced Configuration (CAC)

## 🎯 Estratégia de Cache Multi-Camada

### Camada 1: Application Cache (Materialized Views)
- **MV_BT_HISTORY_DAILY_SUMMARY**: Dashboards BT (Refresh Hourly).
- **MV_AUDIT_STATS**: Relatórios de conformidade (Refresh Hourly).
- **MV_CONSTANTS_NAMESPACE_SUMMARY**: Status do catálogo (Refresh Hourly).
- **Mecanismo**: `REFRESH MATERIALIZED VIEW CONCURRENTLY` para evitar locks de leitura.

### Camada 2: Database Indices (Cache-Friendly)
- **BRIN (Block Range Index)**: Utilizado em séries temporais (`audit_logs`, `jobs`, `dxf_tasks`) para economia de espaço (1% de uma B-tree) e alta performance em queries de range.
- **GIN (Generalized Inverted Index)**: Otimização de busca em campos `JSONB` e textos longos.
- **TRGM (Trigram)**: Busca por substring em catálogos e logs.

### Camada 3: Elevation Tile Cache (Python Engine)
- **Localização**: `py_engine/domain/terrain/cache.py`
- **Mecanismo**: SQLite (`elevation_cache.db`).
- **Performance**: Hit rate de 80-90% em áreas urbanas, reduzindo latência em 100x para queries repetidas.

### Camada 4: Browser Cache (PWA/Workbox)
- **Precache**: Assets estáticos e manifest.
- **Runtime Cache**: Estratégia `NetworkFirst` para respostas de API, garantindo resiliência offline.

### Camada 5: Partition-Level Cache
- **Tabelas**: `audit_logs`, `jobs`, `dxf_tasks`, `bt_export_history`.
- **Granularidade**: Mensal (48 partições ativas).
- **Benefício**: Partition pruning e VACUUM local por partição.

### Camada 6: DG Result Cache (Run Isolation)
- **Localização**: `dgRunRepository.ts` / Tabela `dg_runs`.
- **Chave**: `input_hash` (Baseado em coordenadas de postes + params técnicos).
- **Mecanismo**: Evita re-cálculo de projetos pesados se a topologia for idêntica, retornando o `scenario_id` recomendado imediatamente.

### Camada 7: Hook-Level State Isolation (React Architecture)
- **Mecanismo**: Divisão de estados monolíticos em hooks especializados (`useAppEngineeringWorkflows`, `useAppLifecycleEffects`, `useAppMainHandlers`).
- **Benefício**: Redução de re-renders desnecessários no `AppWorkspace` ao isolar lógicas de negócio pesadas em sub-lifecycles. Melhora a percepção de performance (UX-20) e facilita o Unit Testing.

## 📊 Monitoramento de Saúde (Health Check)
Monitorado via `private.db_health_report()` diariamente às 07:00 UTC.
- **Target Cache Hit Ratio**: > 99%.
- **Target Blocked Locks**: 0.
- **Target Dead Tuples**: Mínimo possível via Auto-Vacuum diário.

## 🛠️ Comandos de Manutenção
- `SELECT * FROM private.v_maintenance_schedule;`
- `SELECT * FROM private.maintenance_log ORDER BY started_at DESC LIMIT 20;`
