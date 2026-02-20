# SIS RUA Unified - Sistema de Exportação OSM para DXF

Sistema completo de extração de dados do OpenStreetMap e geração de arquivos DXF 2.5D para AutoCAD, com suporte a análise espacial e coordenadas UTM absolutas.

## 🐳 Arquitetura Docker-First (Enterprise)

**Este projeto usa Docker como método PRIMARY de distribuição**, isolando completamente o motor Python e eliminando dependências de binários .exe.

### Por que Docker?
- ✅ **Isolamento completo** - Python roda em container, não no SO do usuário
- ✅ **Zero dependências** - Não precisa instalar Node.js ou Python
- ✅ **Sem antivírus** - Nenhum falso positivo com executáveis
- ✅ **Multiplataforma** - Roda em Windows, Linux e Mac
- ✅ **Enterprise-ready** - Deploy automatizado para Cloud Run

### Quick Start
```bash
# Pré-requisito: Docker instalado
docker compose up

# Acesse: http://localhost:8080
```

**Pronto!** Todo o ambiente está configurado automaticamente. 🚀

📖 **Guia completo**: [DOCKER_USAGE.md](./DOCKER_USAGE.md)

## 🔒 Segurança

**Com Docker (Recomendado)**: Antivírus NÃO é problema! Python roda em container isolado.

**Sem Docker**: Se preferir instalação nativa e seu antivírus bloquear, veja:
- 📖 [SECURITY_ANTIVIRUS_GUIDE.md](./SECURITY_ANTIVIRUS_GUIDE.md) - Mitigação de problemas
- 📋 [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - Checklist de segurança

O projeto implementa várias medidas de segurança:
- ✅ Validação rigorosa de entrada em todos os endpoints
- ✅ Sanitização de argumentos de linha de comando
- ✅ Logging completo de todas as operações
- ✅ Usuário não-root em containers Docker
- ✅ Rate limiting e CORS configurados
- ✅ Sem executáveis commitados no repositório

## 📁 Estrutura do Projeto

```
sisTOPOGRAFIA/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/          # Componentes React
│   │   ├── Dashboard.tsx
│   │   ├── MapSelector.tsx
│   │   ├── SettingsModal.tsx
│   │   └── ...
│   ├── hooks/              # Custom React Hooks
│   │   ├── useOsmEngine.ts
│   │   ├── useDxfExport.ts
│   │   ├── useFileOperations.ts
│   │   └── ...
│   ├── services/           # API clients
│   │   ├── osmService.ts
│   │   ├── dxfService.ts
│   │   └── ...
│   ├── utils/              # Utilitários
│   │   ├── logger.ts
│   │   ├── kmlParser.ts
│   │   └── ...
│   ├── App.tsx             # Componente principal
│   ├── index.tsx           # Entry point
│   ├── types.ts            # Type definitions
│   └── constants.ts        # Constantes
│
├── server/                  # Backend Node.js (Express)
│   ├── services/           # Serviços backend
│   ├── index.ts            # Servidor Express
│   └── pythonBridge.ts     # Bridge para Python
│
├── py_engine/              # Motor Python (OSMnx + ezdxf)
│   ├── main.py             # Entry point Python
│   ├── controller.py       # Orquestração
│   ├── osmnx_client.py     # Cliente OSM
│   ├── dxf_generator.py    # Geração DXF
│   ├── constants.py        # Constantes Python
│   └── utils/              # Utilitários Python
│
├── tests/                   # Testes automatizados
│   ├── setup.ts            # Configuração Vitest
│   ├── hooks/              # Testes de hooks
│   ├── utils/              # Testes de utilities
│   └── constants.test.ts
│
├── public/                  # Assets estáticos
│   ├── dxf/                # DXFs gerados
│   └── theme-override.css
│
├── test_files/             # Arquivos de teste (DXF, CSV)
├── docs/                   # Documentação
│   ├── AUDIT_REPORT.md     # Relatório de auditoria
│   └── README.md           # Docs antigas
├── scripts/                # Scripts utilitários
│   ├── audit_dxf.py
│   ├── test_fix.py
│   └── ...
│
├── cache/                  # Cache de requisições
├── build/                  # Build artifacts
├── dist/                   # Distribution files
│
├── index.html              # HTML principal
├── package.json            # Dependências Node
├── tsconfig.json           # Config TypeScript
├── vite.config.ts          # Config Vite
└── start-dev.ps1           # Script de inicialização
```

## 🚀 Como Usar

### 🐳 Quick Start com Docker (Mais Fácil)

**Requisito**: Docker instalado ([Get Docker](https://docs.docker.com/get-docker/))

```bash
# 1. Clone o repositório
git clone https://github.com/jrlampa/myworld.git
cd myworld/sisTOPOGRAFIA

# 2. (Opcional) Configure variáveis de ambiente
cp .env.example .env
# Edite .env e adicione sua GROQ_API_KEY

# 3. Inicie a aplicação
docker compose up

# 4. Acesse no navegador
# http://localhost:8080
```

**Pronto!** Todo o ambiente (Node.js, Python, dependências) está configurado automaticamente.

### 💻 Instalação Nativa (Node.js + Python)

Se preferir rodar sem Docker:

```bash
npm install
pip install -r py_engine/requirements.txt
```

### Desenvolvimento

#### Opção 1: Docker Compose (Recomendado - Setup Automático)
```bash
# Inicia tudo com um comando (Node.js + Python + Frontend + Backend)
docker compose up

# Ou em background
docker compose up -d

# Acesse a aplicação
# http://localhost:8080
```

**Vantagens**:
- ✅ Zero configuração manual de Python/Node.js
- ✅ Ambiente isolado e reproduzível
- ✅ Ideal para onboarding de novos devs

#### Opção 2: Desenvolvimento Nativo (Node.js + Python instalados)
```bash
# Start all services (frontend + backend)
npm run dev

# Or use the PowerShell launcher (Windows)
.\start-dev.ps1
```

O launcher [start-dev.ps1](start-dev.ps1) inicia automaticamente:
- **Frontend** (Vite): http://localhost:3000
- **Backend** (Express): http://localhost:3001
- **Swagger API Docs**: http://localhost:3001/api-docs

**Pré-requisitos**:
- **Node.js 22+** e **Python 3.9+** instalados
- Dependências instaladas:
  ```bash
  npm install
  pip install -r py_engine/requirements.txt
  ```

### ℹ️ Nota sobre Job Queue

**PRODUÇÃO (Cloud Run)**: Usa **Google Cloud Tasks** (serverless, sem Redis)  
**DESENVOLVIMENTO LOCAL**: Redis é **OPCIONAL** e não utilizado atualmente

Se quiser testar com Redis (futuro):
```bash
# Inicia app + Redis
docker compose --profile with-redis up
```

📖 **Detalhes**: Ver [ARCHITECTURE.md](./ARCHITECTURE.md) - Task Processing Strategy

#### Troubleshooting Cloud Tasks
Se você encontrar erros relacionados ao Cloud Tasks (ex: "Queue not found"):
- 📖 Ver [CLOUD_TASKS_TROUBLESHOOTING.md](./CLOUD_TASKS_TROUBLESHOOTING.md) para soluções completas
- 🔧 Executar: `./scripts/setup-cloud-tasks-queue.sh` para criar a fila manualmente

### Segurança e Auditoria

```bash
# Executar auditoria de segurança completa
npm run security:check

# Ou usar scripts dedicados:

# Windows (PowerShell)
.\scripts\security_scan.ps1

# Linux/Mac
./scripts/security_scan.sh

# Python only
python scripts/security_audit.py
```

**O que é verificado**:
- ✅ Vulnerabilidades em dependências Node.js (npm audit)
- ✅ Vulnerabilidades em dependências Python (pip-audit)
- ✅ Problemas de segurança no código Python (Bandit)
- ✅ Configurações de segurança (.gitignore, secrets)

### Testes

#### Testes Backend (Jest)
Testa serviços Node.js, cache, parsing CSV, e endpoints da API:
```bash
npm run test:backend
```

**Cobertura inclui:**
- `server/tests/api.test.ts` - Endpoints HTTP (health check, search)
- `server/tests/cacheService.test.ts` - Cache com TTL e hashing SHA-256
- `server/tests/batchService.test.ts` - Parsing e validação de CSV
- `server/tests/elevationService.test.ts` - Cálculos de distância
- `server/tests/geocodingService.test.ts` - Parsing de coordenadas

📊 **Relatório de cobertura**: `coverage/backend/index.html`

#### Testes Frontend (Vitest)
Testa hooks React, utilitários, e componentes:
```bash
npm run test:frontend
```

**Cobertura inclui:**
- `tests/hooks/` - Custom hooks (useDxfExport, useSearch, useElevationProfile, etc.)
- `tests/utils/` - Funções utilitárias
- `tests/constants.test.ts` - Validação de constantes

📊 **Relatório de cobertura**: `coverage/index.html`

#### Testes End-to-End (Playwright)
Testa fluxos completos de usuário no navegador:
```bash
# Inicie o dev server primeiro
npm run dev

# Em outro terminal, execute os testes E2E
npm run test:e2e            # Modo headless
npm run test:e2e:ui         # Modo interativo (UI)
npm run test:e2e:headed     # Modo com navegador visível
```

**Cenários testados:**
- Geração de DXF com cache e polling assíncrono
- Upload de CSV em lote com tracking de múltiplos jobs
- Busca de coordenadas e validação de UI
- Transições de status de jobs (queued → active → completed)

📊 **Relatório de testes**: `npx playwright show-report`

**Pré-requisitos para E2E:**
- ✅ Dev server rodando (`npm run dev`)
- ✅ Redis container ativo (para testar job queue)
- ✅ Python configurado (para geração de DXF)

#### Executar Todos os Testes
```bash
npm run test:all
```
Executa backend → frontend → E2E em sequência.

**Observação**: Testes E2E requerem que o dev server esteja rodando. Os outros testes (backend/frontend) podem ser executados independentemente.

### Build
```bash
npm run build
```

## 🎯 Funcionalidades

- ✅ Busca de localização com AI (GROQ) e UTM
- ✅ Seleção de área (círculo/polígono)
- ✅ Importação KML
- ✅ Exportação DXF com coordenadas UTM absolutas
- ✅ Análise espacial automatizada
- ✅ Perfis de elevação
- ✅ Sistema de camadas configurável
- ✅ Undo/Redo
- ✅ Salvamentos de projeto

## 📊 Coordenadas

O sistema suporta dois modos de projeção:

- **UTM (Absoluto)**: Coordenadas UTM reais compatíveis com Google Earth, GPS e GIS profissionais
- **Local (Relativo)**: Coordenadas centradas em (0,0) para desenhos CAD tradicionais

## 🧪 Testes

- **32 testes** frontend (100% passando)
- Vitest + React Testing Library
- Cobertura de código com V8

## 📝 Licença

Proprietary

## 📌 Versionamento

Este projeto segue [Semantic Versioning (SemVer)](https://semver.org/). Para atualizar a versão do projeto:

```bash
# Linux/Mac
./scripts/update-version.sh 1.1.0

# Windows
.\scripts\update-version.ps1 1.1.0
```

📖 **Guia completo**: [VERSIONING.md](./VERSIONING.md)
