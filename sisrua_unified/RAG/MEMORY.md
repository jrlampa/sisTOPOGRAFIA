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
