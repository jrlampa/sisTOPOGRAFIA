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
