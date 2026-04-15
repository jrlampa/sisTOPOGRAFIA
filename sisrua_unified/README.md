# SIS RUA Unified

Plataforma de engenharia para extração de dados geoespaciais, análise operacional e geração de DXF 2.5D a partir de bases OSM, fluxos técnicos complementares e regras de processamento reproduzíveis.

O projeto combina frontend web, backend de serviços e engine Python para transformar consultas espaciais em artefatos técnicos utilizáveis em análise, documentação e operação.

## Resumo

O sisRUA Unified foi construído para reduzir a distância entre dado geoespacial bruto, validação técnica e entrega final em CAD.

Na prática, isso significa:

- geração padronizada de DXF 2.5D
- processamento assistido por interface web
- backend com validação, filas, observabilidade e segurança
- engine Python especializada em geoprocessamento
- operação Docker-first com caminho claro para ambientes enterprise

## Proposta de Valor

O valor do projeto está em unir produtividade operacional e previsibilidade técnica.

Principais ganhos:

- menos retrabalho entre coleta, análise e entrega
- padronização de saída técnica em ambiente local e conteinerizado
- redução de dependências manuais para gerar artefatos CAD
- rastreabilidade para auditoria, troubleshooting e evolução do sistema
- base preparada para backlog técnico, governança e integrações futuras

## Para Quem É Este Projeto

- engenharia de software: desenvolvimento, manutenção, arquitetura e testes
- times técnicos e operacionais: execução, validação, troubleshooting e geração de artefatos
- liderança técnica: auditoria, maturidade, backlog e roadmap
- produto e operação: entendimento consolidado de capacidades, limitações e prioridades

## Quick Start

### Opção recomendada: Docker

Pré-requisito: Docker instalado.

```bash
docker compose up
```

Acesse:

- aplicação: `http://localhost:8080`

Isso sobe o ambiente completo com frontend, backend e engine Python no fluxo recomendado.

### Opção nativa: Node.js + Python

Pré-requisitos mínimos:

- Node.js 22+
- Python 3.9+

Instalação:

```bash
npm install
pip install -r py_engine/requirements.txt
```

Execução:

```bash
npm run dev
```

Ou no Windows:

```powershell
.\start-dev.ps1
```

Portas padrão:

- frontend: `http://localhost:3000`
- backend: `http://localhost:3001`
- Swagger/OpenAPI: `http://localhost:3001/api-docs`

## Modos de Operação

### Docker-first

Este é o modo prioritário de distribuição e operação.

Benefícios:

- isolamento completo do motor Python
- ambiente reproduzível para equipe e deploy
- menor atrito com dependências locais
- redução de problemas com binários e antivírus

Comandos úteis:

```bash
npm run docker:dev
npm run docker:dev:build
npm run docker:down
npm run docker:logs
```

### Desenvolvimento local

Comandos principais:

```bash
npm run dev
npm run client
npm run server
```

Guia detalhado: [README_LOCAL.md](./README_LOCAL.md)

## Arquitetura

O sistema está organizado em três camadas principais:

- `src/`: frontend React + Vite
- `server/`: backend Node.js + Express
- `py_engine/`: motor Python para processamento geoespacial e geração DXF

No fluxo produtivo, o processamento assíncrono está orientado a Google Cloud Tasks. Em ambiente local, o sistema opera de forma simplificada para acelerar desenvolvimento e validação.

Leitura recomendada:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DOCKER_USAGE.md](./DOCKER_USAGE.md)
- [CLOUD_TASKS_TROUBLESHOOTING.md](./CLOUD_TASKS_TROUBLESHOOTING.md)

## Estrutura do Projeto

```text
sisrua_unified/
├── src/            # frontend React + Vite
├── server/         # backend Express e serviços
├── py_engine/      # engine Python para OSM e DXF
├── tests/          # testes frontend
├── e2e/            # testes end-to-end
├── docs/           # documentação especializada
├── scripts/        # automações e utilitários
├── public/         # assets e artefatos públicos
├── package.json    # scripts e dependências Node.js
└── README_LOCAL.md # guia local detalhado
```

## Segurança e Confiabilidade

O projeto já incorpora práticas importantes de proteção e robustez operacional:

- validação rigorosa de entrada
- sanitização de parâmetros sensíveis
- logs estruturados
- rate limiting e políticas de acesso
- execução Docker com usuário não-root
- trilha de testes e auditoria técnica

Referências:

- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)
- [SECURITY_ANTIVIRUS_GUIDE.md](./SECURITY_ANTIVIRUS_GUIDE.md)
- [RULES_ENFORCEMENT.md](./RULES_ENFORCEMENT.md)

## Testes e Qualidade

Principais comandos:

```bash
npm run test
npm run test:frontend
npm run test:frontend:risk
npm run test:backend
npm run test:e2e
npm run test:metrics
npm run coverage:policy
npm run a11y:smoke
npm run build
```

Metas de cobertura da suíte:

- Críticos (20%): 100% (medido em `coverage/frontend-risk/coverage-summary.json`)
- Restantes: >=80% (medido em `coverage/backend/coverage-summary.json`)

Comandos complementares:

```bash
npm run lint
npm run typecheck:frontend
npm run typecheck:backend
npm run security:check
```

## Documentação Estratégica

Este README é a entrada canônica da documentação do projeto.

Para leitura orientada, use esta trilha:

1. [README_LOCAL.md](./README_LOCAL.md)
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
3. [DOCKER_USAGE.md](./DOCKER_USAGE.md)
4. [TESTES_MANUAIS.md](./TESTES_MANUAIS.md)
5. [docs/MELHORIAS_SUGERIDAS.md](./docs/MELHORIAS_SUGERIDAS.md)

Documentos de apoio importantes:

### Operação e arquitetura

- [README_LOCAL.md](./README_LOCAL.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DOCKER_USAGE.md](./DOCKER_USAGE.md)
- [CLOUD_TASKS_TROUBLESHOOTING.md](./CLOUD_TASKS_TROUBLESHOOTING.md)

### Backlog, auditoria e direcionamento

- [docs/MELHORIAS_SUGERIDAS.md](./docs/MELHORIAS_SUGERIDAS.md)
- [docs/AUDIT_REPORT.md](./docs/AUDIT_REPORT.md)
- [docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)
- [docs/GANHOS_TECNICOS.md](./docs/GANHOS_TECNICOS.md)

### Paridade e workbook

- [docs/CQT_PARITY_BLUEPRINT.md](./docs/CQT_PARITY_BLUEPRINT.md)
- [docs/CQT_PARITY_REPORT.md](./docs/CQT_PARITY_REPORT.md)
- [docs/CQT_WORKBOOK_AUDIT.md](./docs/CQT_WORKBOOK_AUDIT.md)
- [docs/CQT_PARITY_EXPECTED_OVERRIDES.json](./docs/CQT_PARITY_EXPECTED_OVERRIDES.json)

### APIs e integrações brasileiras

- [docs/ANALISE_APIS_BRASILEIRAS.md](./docs/ANALISE_APIS_BRASILEIRAS.md)
- [docs/APIS_BRASILEIRAS_IMPLEMENTADAS.md](./docs/APIS_BRASILEIRAS_IMPLEMENTADAS.md)
- [docs/RESUMO_APIS_BRASILEIRAS.md](./docs/RESUMO_APIS_BRASILEIRAS.md)

### Segurança, governança e versionamento

- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)
- [VERSIONING.md](./VERSIONING.md)
- [RULES_ENFORCEMENT.md](./RULES_ENFORCEMENT.md)

## Roadmap e Evolução

O projeto já possui um backlog técnico estruturado e documentos de auditoria para suportar evolução contínua. Isso inclui frentes como:

- melhorias de UX e acessibilidade
- endurecimento de backend e observabilidade
- qualidade documental e governança
- trilhas de paridade com workbook de referência
- integração com APIs e dados nacionais

Para visão consolidada dos próximos passos:

- [docs/MELHORIAS_SUGERIDAS.md](./docs/MELHORIAS_SUGERIDAS.md)

## Posicionamento Final

O sisRUA Unified não é apenas uma interface sobre mapas. Ele está sendo consolidado como uma plataforma técnica com foco em previsibilidade operacional, escalabilidade de engenharia e entregas utilizáveis no contexto real de projeto, análise e documentação.

Este README existe para refletir essa maturidade com clareza, consistência e utilidade prática.

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
