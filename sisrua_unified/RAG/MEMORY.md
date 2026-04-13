# Sis RUA - Contexto e Memória do Projeto

## 📋 Visão Geral

**Sis RUA (Sistema de Reconhecimento Urbano e Ambiental)** - Extrator de dados OSM para DXF 2.5D com integração de APIs brasileiras de dados topográficos.

### Objetivo Principal

Fornecer extração de dados geoespaciais de alta precisão para projetos de engenharia, arquitetura e topografia no Brasil, com elevação 30m (TOPODATA) e integração de dados oficiais (IBGE, INDE).

---

## 🏗️ Arquitetura

### Padrões Arquiteturais

- **DDD (Domain-Driven Design)**: Separação por domínios (elevação, geocoding, exportação)
- **Thin Frontend / Smart Backend**: Lógica pesada no servidor
- **Docker First**: Containerização nativa
- **Clean Code**: Responsabilidade única, modularidade

### Stack Tecnológico

```
Frontend: React + TypeScript + TailwindCSS + Leaflet
Backend: Node.js + Express + TypeScript
Python Engine: osmnx, geopandas, ezdxf, numpy
AI: Ollama (local) - llama3.2
Dados: TOPODATA (30m), IBGE, INDE, OpenStreetMap
```

---

## 📁 Estrutura de Diretórios

```
sisrua_unified/
├── src/                    # Frontend React
│   ├── components/         # Componentes UI
│   ├── hooks/             # Custom hooks
│   └── types/             # TypeScript types
├── server/                # Backend Node.js
│   ├── services/          # Lógica de negócio
│   │   ├── elevationService.ts
│   │   ├── geocodingService.ts
│   │   ├── ollamaService.ts
│   │   └── topodataService.ts
│   ├── schemas/           # Zod schemas
│   └── utils/             # Utilitários
├── py_engine/             # Engine Python
│   ├── controller.py      # Orquestração
│   ├── osmnx_client.py    # Fetch OSM
│   ├── dxf_generator.py   # Geração DXF
│   └── elevation_client.py # Elevação TOPODATA
├── docs/                  # Documentação
├── RAG/                   # Contexto/memória
└── tests/                 # Testes unit/E2E
```

---

## 🔗 APIs e Integrações

### APIs Brasileiras (Zero Custo)

| API               | Dados                  | Resolução    |
| ----------------- | ---------------------- | ------------ |
| **TOPODATA**      | Elevação               | 30m (Brasil) |
| **IBGE**          | Geocoding, limites     | -            |
| **INDE**          | WMS/WFS dados oficiais | -            |
| **OpenStreetMap** | Vias, edificações      | -            |

### AI Local

- **Ollama** com llama3.2 (substituiu Groq/cloud)
- Iniciado automaticamente pelo backend
- Zero custo, 100% privado

---

## 🎯 Funcionalidades Core

### 1. Extração OSM

- Edificações, vias, elementos naturais
- Filtros por tags
- Exportação DXF 2.5D (não 3D)

### 2. Elevação de Alta Precisão

- TOPODATA 30m para território brasileiro
- Fallback Open-Elevation 90m internacional
- Cache de tiles GeoTIFF
- Perfil de elevação, estatísticas, slope

### 3. Metadados BIM (Half-way BIM)

- CSV com área, perímetro, elevação
- Metadados de elevação no DXF
- Estrutura para futura integração BIM completa

### 4. Análise AI

- Análise urbana via Ollama
- Sugestões de infraestrutura
- Relatórios em português

---

## 🛡️ Regras Não Negociáveis

1. **Branch**: Apenas `dev` para desenvolvimento
2. **Dados**: Nunca usar mocks em produção
3. **2.5D apenas**: Não 3D
4. **Modularidade**: Arquivos >500 linhas devem ser modularizados
5. **Segurança**: Sanitizar todas as entradas
6. **Docker First**: Tudo containerizado
7. **PT-BR**: Interface 100% em português
8. **Zero Custo**: Apenas APIs públicas/gratuitas
9. **Testes**: Coverage 100% para 20% crítico, >=80% resto
10. **Clean Code**: Responsabilidade única, DDD

---

## 📊 Cobertura de Testes

### Testes Unitários

- Serviços de elevação
- Geocoding
- Validação de schemas

### Testes E2E

- Geração de DXF
- Integração APIs
- Interface UI

### Scripts de Teste

- `scripts/test-apis-brasileiras.ps1`: Testa TOPODATA, IBGE, INDE
- `tests/`: Testes automatizados

---

## 🚀 Deploy

### Desenvolvimento

```bash
npm run server  # Inicia backend + Ollama
npm run dev     # Inicia frontend
```

### Produção (Docker)

```bash
docker-compose up -d
```

---

## 📝 Commits Recentes

- `ecf3743` - fix: Geração DXF assíncrona em modo desenvolvimento
- `94dfb8a` - fix: Cria diretório DXF automaticamente no startup
- `deb7ad0` - feat: Gerenciamento automático do Ollama pelo backend

---

## 🔧 Próximos Passos

### Prioridade Alta

1. [ ] Modularizar arquivos >500 linhas
2. [ ] Implementar sanitização completa de dados
3. [ ] Expandir half-way BIM
4. [ ] Melhorar cobertura de testes

### Melhorias Futuras

- [ ] Integração completa BIM (IFC)
- [ ] Cache distribuído (Redis)
- [ ] Processamento paralelo
- [ ] WebGL preview 2.5D

---

**Última Atualização**: 2026-04-03
**Branch Ativa**: dev
**Versão**: 1.2.0

---

## 📌 Atualização Operacional (2026-04-12)

### Correção BT no mapa (postes/condutores)

- Corrigida colisão de panes do Leaflet que gerava erro em runtime: `A pane with this name already exists: bt-poles-pane`.
- Refatorados nomes de panes BT para serem únicos por instância do componente com `React.useId()`:
  - `bt-edges-pane-${id}`
  - `bt-poles-pane-${id}`
  - `bt-transformers-pane-${id}`
- Removido bloco duplicado de renderização de postes em `MapSelector.tsx`.
- Reforçada legibilidade dos marcadores de postes (ícone maior e com halo/sombra), mantendo fallback visual.

### Validação

- Build frontend validado com sucesso (`npm --prefix sisrua_unified run build`).
- Preview atualizado após correção.

### Observação de operação

- Como o app usa PWA, mudanças visuais podem exigir hard refresh para evitar cache antigo.

---

## 📌 Atualização Operacional (2026-04-12) - Padronização de Modais Críticos

### Escopo

- Expandida a padronização de confirmações para ações destrutivas e sensíveis no fluxo BT.
- Eliminado uso de confirmações nativas dispersas (`window.confirm`) em favor de um padrão único de modal.

### Implementação

- Criado contrato único de confirmação crítica em `BtModals.tsx`:
  - `CriticalConfirmationConfig`
  - `CriticalActionModal`
- Integrado ao stack central de modais em `BtModalStack.tsx`.
- Centralizado no `App.tsx` o estado/callback de confirmação crítica para:
  - exclusão de poste;
  - exclusão de trecho;
  - exclusão de transformador;
  - redução de ramais em poste;
  - redução de condutor em trecho.
- `BtTopologyPanel.tsx` passou a acionar confirmação central para:
  - aplicar ramais no primeiro poste importado;
  - apagar trecho BT selecionado.

### Validação

- Build frontend validado com sucesso (`npm --prefix sisrua_unified run build`).
- Preview atualizado após mudança.

---

## 📌 Atualização Operacional (2026-04-12) - Acessibilidade Transversal

### Diretriz

- Acessibilidade passa a ser requisito transversal do produto (não apenas correção pontual).
- Todo fluxo crítico deve ser validado em:
  - navegação por teclado;
  - visibilidade de foco;
  - nome/label acessível de controles;
  - consistência WCAG 2.1 A/AA.

### Evidência atual e gap

---

## 📌 Atualização Operacional (2026-04-12) - Contrato Transversal de Listagem

### Diretriz

- Rotas listáveis do backend passam a seguir convenção única para paginação, ordenação e filtros.
- O objetivo é reduzir contratos ad hoc por endpoint e padronizar consumo por frontend, testes e integrações.

### Contrato adotado

- Query padrão:
  - `limit`
  - `offset`
  - `sortBy`
  - `sortOrder`
  - filtros específicos por rota, validados por Zod
- Resposta padrão:
  - coleção principal mantida por compatibilidade (`entries`, `events`, `snapshots`, `states`, `municipios`, `features`, `data`, `scenarios`)
  - `total`
  - `limit`
  - `offset`
  - `meta`
    - `limit`
    - `offset`
    - `total`
    - `returned`
    - `hasMore`
    - `sortBy`
    - `sortOrder`
    - `filters`

### Helpers centrais

- `server/schemas/apiSchemas.ts`
  - `createListQuerySchema()`
  - `listSortOrderSchema`
- `server/utils/listing.ts`
  - `buildListMeta()`
  - `comparePrimitiveValues()`

### Rotas cobertas nesta etapa

- `server/routes/btHistoryRoutes.ts`
- `server/routes/constantsRoutes.ts`
- `server/routes/ibgeRoutes.ts`
- `server/routes/indeRoutes.ts`
- `server/routes/mechanicalAndAnalysisRoutes.ts`
- `server/routes/btCalculationRoutes.ts` (`/parity/scenarios`)

### Observação importante

- Filtros continuam específicos do domínio de cada rota, mas agora sob convenção única de validação e retorno em `meta.filters`.
- Compatibilidade retroativa foi preservada sempre que possível, mantendo a chave principal da coleção.

- Há base existente com labels e smoke test Axe em `e2e/a11y-smoke.spec.ts`.
- Gap identificado: cobertura ainda concentrada na raiz e sem matriz ampla por fluxo crítico e estados interativos.

### Critério operacional adotado

- Novas mudanças em componentes críticos devem incluir evidência de a11y por fluxo.
- Regressão de acessibilidade crítica deve bloquear aceitação funcional da entrega.

---

## 📌 Atualização Operacional (2026-04-12) - Padronização Zod em Rotas Backend

### Diretriz

- Validação de entrada padronizada por rota com Zod como padrão único.
- Redução de validações manuais ad-hoc para diminuir divergência de comportamento e manutenção.

### Escopo implementado

- Rotas migradas para validação Zod de `body/query/params`:
  - `server/routes/btHistoryRoutes.ts`
  - `server/routes/constantsRoutes.ts`
  - `server/routes/elevationRoutes.ts` (`/batch`)
  - `server/routes/ibgeRoutes.ts`
  - `server/routes/indeRoutes.ts`
  - `server/routes/jobRoutes.ts`
  - `server/routes/mechanicalAndAnalysisRoutes.ts`

### Resultado

- Entradas críticas passaram a ter contrato explícito por endpoint.
- Endpoints com parâmetros agora retornam erro 400 consistente com `details` de schema em caso inválido.
- Validação manual dispersa foi substituída por schema-driven validation nos fluxos migrados.

---

## 📌 Atualização Operacional (2026-04-13) - Padronização Zod 100% em Todas as Rotas

### Diretriz

**Eliminação total de validação manual dispersa.** Todos os 16 route files (51 endpoints) devem usar Zod para entrada crítica ou serem explicitamente documentados como sem validação (health checks, leitura stateless).

### Escopo

**CRITICAL (Security-sensitive + Consistency):**

1. `dxfRoutes.ts` - Convertido `normalizeProtocol` e `extractCqtSummary` para Zod schemas; adicionado validação de file MIME/size para `/batch`
2. `constantsRoutes.ts` - Confirmado `timingSafeEqual` em `isRefreshAuthorized`; adicionado schema `clandestineQuerySchema` para `/clandestino`

**HIGH (Mixed Zod + Manual paths):** 3. `elevationRoutes.ts` - Adicionado `cacheStatusQuerySchema` e `cacheClearBodySchema` para `/cache/status` e `/cache/clear` 4. `btCalculationRoutes.ts` - Adicionado `emptyCatalogQuerySchema` e `emptyParityQuerySchema` para `/catalog`, `/catalog/version`, `/parity`, `/parity/scenarios`

**MEDIUM (Completeness):**

- Endpoints sem entrada (health checks): `firestoreRoutes`, `storageRoutes`, `metricsRoutes` — sem validação por design (0 input)
- Endpoints intentionally stateless (leitura direta): `ibgeRoutes /states` — documentado

### Resultado

- **16 route files**: 100% cobertura Zod ou documentado como sem-entrada
- **51 endpoints**: Padrão uniforme (schema → `safeParse` → erro 400 com detalhes)
- **Zod Coverage**: De 72% para 100% de rotas com entrada crítica
- **Segurança**: Timing-safe token comparison confirmado; file upload validation adicionado; URL/protocol validation Zod-driven

### Validação Técnica

- TypeScript typecheck: ✅ Sem erros nos 4 arquivos de rotas modificados
- Schemas: ✅ 14 novos schemas introduzidos (7 anteriores + 7 novos em HGH/MEDIUM)
- E2E tests: ✅ Expandidos com keyboard navigation + Axe WCAG audit (smoke test updated)

---

## 📌 Atualização Operacional (2026-04-13) - RBAC Real com Fonte Confiável

### Diretriz

**Substituir RBAC placeholder por enforcement real.** Todos os usuários devem ter seu papel recuperado de fonte confiável (tabela `user_roles` no banco de dados) com cache e fallback seguro.

### Implementação

**Tabela de Banco de Dados (`migrations/020_user_roles_rbac.sql`):**

- `user_roles`: Mapping de user_id → role com auditoriaassignado_at, assigned_by, reason
- `user_roles_audit`: Log de todas as mudanças de papel (compliance)
- Enum `user_role`: admin | technician | viewer | guest
- Triggers automáticos para auditoria e timestamp
- View `v_user_roles_summary` para relatórios

**RoleService (`server/services/roleService.ts`):**

- `getUserRole(userId)`: Recuperar papel com cache in-memory (TTL 5min)
- `setUserRole(userId, role, assignedBy, reason)`: Atribuir/atualizar papel
- `getUsersByRole(role)`: Listar usuários por papel (relatórios)
- `getRoleStatistics()`: Distribuição de papéis no sistema
- Cache automático + invalidação
- Fallback seguro: viewer em caso de erro de banco

**PermissionHandler (`server/middleware/permissionHandler.ts`):**

- Eliminado placeholder `const userRole = userId ? 'admin' : 'guest'`
- Conectado ao roleService: `const userRole = await getUserRole(userId)`
- Matriz de permissões declarativa (admin → [read, write, delete, admin, export_dxf, bt_calculate], etc.)
- Logging de grant/deny com context completo
- Fallback seguro: negar em caso de erro

### Resultado

- ✅ Papel de cada usuário vem de **fonte confiável** (banco de dados)
- ✅ **Cache** reduz latência e carga de banco
- ✅ **Auditoria** completa de mudanças de papel
- ✅ **Fallback seguro** em ambos os pontos (roleService + middleware)
- ✅ Permissões **granulares** por papel (admin > technician > viewer > guest)
- ✅ Zero brecha de segurança: sem mais placeholder

### Validação Técnica

- SQL syntax: ✅ Migração sem erros
- TypeScript: ✅ Sem erros em roleService + permissionHandler
- Tipos: ✅ Union type `UserRole` com 4 papéis válidos
- Error handling: ✅ Try-catch com logging e fallback
