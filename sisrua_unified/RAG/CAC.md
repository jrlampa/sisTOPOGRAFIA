# sisRUA Unified — Cache Advanced Configuration (CAC)

## ✅ Atualização Operacional — 2026-05-13
- **Auditoria de Banco de Dados**: Otimização da exportação SIEM concluída. A rota `/api/audit/export` agora consome exclusivamente `mv_audit_siem_export`, reduzindo latência de 1.1s para <50ms.
- **Build/PWA validado**: `vite build` gerou `dist/`, `sw.js` e `workbox` com precache de 45 entradas.
- **Cache browser preservado**: nenhuma alteração regressiva identificada na camada PWA/Workbox durante a remediação de dependências.
- **Auditoria de segurança**: dependências de produção revalidadas com `npm audit --omit=dev --audit-level=critical`, retornando `found 0 vulnerabilities`.
- **Recomendação CAC**: manter monitoramento de tamanho de bundles e runtime cache após novas features, especialmente módulos admin, mapa, BT editor/panel e Recharts.
- **Governança**: qualquer mudança futura em cache ou dependências deve passar por `typecheck`, `lint`, `build`, `security:audit`, `test:qa:regression` e `coverage:policy` antes de commit na branch `dev`.

## 🎯 Estratégia de Cache Multi-Camada

### Camada 1: Application Cache (Materialized Views)
- **MV_BT_HISTORY_DAILY_SUMMARY**: Dashboards BT (Refresh Hourly).
- **MV_AUDIT_STATS**: Relatórios de conformidade (Refresh Hourly).
- **MV_CONSTANTS_NAMESPACE_SUMMARY**: Status do catálogo (Refresh Hourly).
- **MV_AUDIT_SIEM_EXPORT**: Exportação forense otimizada (Nova em 064 - Refresh Hourly). Rota de exportação migrada de view dinâmica para esta MV em 2026-05-13.
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

### Camada 8: API Runtime Cache (Proxy/Memory)
- **OSM_PROVIDER_CACHE**: Memória (LRU Simulado) no `osmRoutes.ts`.
- **TTL**: 24 horas.
- **Benefício**: Reduz dependência de Overpass API externa, garantindo performance e resiliência a quedas de serviço.

## 📊 Monitoramento de Saúde (Health Check)
Monitorado via `private.db_health_report()` diariamente às 07:00 UTC.
- **Target Cache Hit Ratio**: > 99%.
- **Target Blocked Locks**: 0.
- **Target Dead Tuples**: Mínimo possível via Auto-Vacuum diário.

## Métricas de Qualidade e Cobertura (Maio 2026)
- **Cobertura Backend:** 86.44% (Meta 80% Atingida)
- **Cobertura Frontend:** 44.53% (Evolução de +10% na Onda 2)
- **Média Global:** ~65% (Tendência de alta para atingir 80% na Onda 3)
- **Segurança:** 100% de cobertura em Auth, Webhooks e Sanitização.

## Onda 2 de Testes Frontend (Concluída 2026-05-14)
- **Componentes Cobertos:** AppHeader, BtTopologyPanel, MapSelector (Poles, Edges, Transformers layers), BtModals, DgWizardModal, CompliancePanel, FloatingLayerPanel.
- **Hooks Cobertos:** useAppOrchestrator, useAppSidebarProps, useCompliance, useBudget, useAppMainHandlers, useAdminForm, useAppLifecycleEffects, useABTest, useFocusTrap, useAriaAnnounce.
- **Infraestrutura:** Implementados mocks globais para Leaflet e Framer Motion, estabilizando a suíte de testes de UI.

## 🛠️ Comandos de Manutenção
- `SELECT * FROM private.v_maintenance_schedule;`
- `SELECT * FROM private.maintenance_log ORDER BY started_at DESC LIMIT 20;`
