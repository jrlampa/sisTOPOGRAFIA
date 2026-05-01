# 🐳 Docker Usage Guide - SIS RUA Unified

Este guia explica como usar Docker para desenvolvimento e produção do SIS RUA Unified.

---

## 📋 Índice

1. [Quick Start](#quick-start)
2. [Comandos Úteis](#comandos-úteis)
3. [Desenvolvimento com Docker](#desenvolvimento-com-docker)
4. [Build e Deploy](#build-e-deploy)
5. [Troubleshooting](#troubleshooting)
6. [Arquitetura Docker](#arquitetura-docker)

---

## Quick Start

### Pré-requisitos

- **Docker** instalado ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose** incluído no Docker Desktop

### Iniciar Aplicação

```bash
# Clone o repositório (se ainda não fez)
git clone https://github.com/jrlampa/myworld.git
cd myworld/sisrua_unified

# Inicie todos os serviços
docker compose up

# Acesse a aplicação
# http://localhost:8080
```

**Pronto!** A aplicação está rodando com:

- ✅ Node.js 22
- ✅ Python 3 + todas as dependências
- ✅ Frontend (React/Vite)
- ✅ Backend (Express)
- ✅ Python Engine (OSMnx + ezdxf)

---

## Comandos Úteis

### Iniciar e Parar

```bash
# Iniciar (modo attached - vê logs no terminal)
docker compose up

# Iniciar em background (detached mode)
docker compose up -d

# Parar containers
docker compose down

# Parar e remover volumes (limpa cache e DXFs gerados)
docker compose down -v
```

### Logs

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs apenas da aplicação
docker compose logs -f app

# Ver últimas 100 linhas de log
docker compose logs --tail=100 app
```

### Rebuild

```bash
# Rebuild da imagem (após mudanças no código)
docker compose build

# Rebuild e restart
docker compose up --build

# Rebuild forçado (ignora cache)
docker compose build --no-cache
```

### Shell Interativo

```bash
# Acessar shell do container
docker compose exec app bash

# Rodar comandos Node.js
docker compose exec app node --version
docker compose exec app npm run test

# Rodar comandos Python
docker compose exec app python3 --version
docker compose exec app python3 py_engine/main.py --help
```

---

## Desenvolvimento com Docker

### Workflow Recomendado

**Opção A: Docker para Ambiente Completo** (Recomendado para novos devs)

```bash
# Inicie uma vez
docker compose up -d

# Faça mudanças no código (src/, server/, py_engine/)
# Rebuild quando necessário
docker compose up --build
```

**Opção B: Nativo para Hot Reload** (Mais rápido para desenvolvimento ativo)

```bash
# Use npm run dev para hot reload instantâneo
npm run dev

# Use Docker apenas para testes de integração
docker compose up --build
```

### Volumes Persistentes

Docker Compose cria volumes para persistir dados:

| Volume              | Propósito                | Localização       |
| ------------------- | ------------------------ | ----------------- |
| `sisrua_dxf_output` | Arquivos DXF gerados     | `/app/public/dxf` |
| `sisrua_cache`      | Cache de requisições OSM | `/app/cache`      |
| `sisrua_redis_data` | Dados Redis (se usado)   | `/data`           |

**Limpar volumes**:

```bash
# Remove todos os volumes (CUIDADO: perde DXFs e cache)
docker compose down -v

# Remove volume específico
docker volume rm sisrua_dxf_output
```

### Variáveis de Ambiente

```bash
# Opção 1: Arquivo .env (recomendado)
cp .env.example .env
# Edite .env com suas configurações
docker compose up
```

---

## Build e Deploy

### Build Local da Imagem Docker

```bash
# Build da imagem production-ready
docker build -t sisrua-unified:latest .

# Testa a imagem localmente
docker run -p 8080:8080 \
  sisrua-unified:latest

# Acesse http://localhost:8080
```

### Multi-Stage Build Strategy

O Dockerfile usa **multi-stage build** para otimização:

```dockerfile
# Stage 1: builder
- Instala TODAS as dependências (dev + prod)
- Compila frontend (Vite)
- Compila backend (TypeScript)
- Cria Python venv isolado

# Stage 2: production
- Runtime mínimo (Node.js + Python)
- Copia APENAS arquivos necessários
- Reusa venv do builder (evita reinstalação)
- Usuário não-root (segurança)
```

**Benefícios**:

- 🚀 Builds 30-40% mais rápidos (reuso de venv)
- 📦 Imagem final menor (~500MB vs ~800MB)
- 🔒 Mais segura (minimal attack surface)

### Deploy para Cloud Run

O deploy é automatizado via GitHub Actions:

```yaml
# .github/workflows/deploy-cloud-run.yml
1. Commit/push para branch main
2. GitHub Actions roda testes e builds
3. Imagem Docker é construída automaticamente
4. Deploy para Google Cloud Run
5. URL do serviço é capturada e configurada
```

**Manual Deploy** (se necessário):

```bash
# Autentique no GCP
gcloud auth login

# Build e push da imagem
gcloud builds submit --tag gcr.io/PROJECT_ID/sisrua-app

# Deploy para Cloud Run
gcloud run deploy sisrua-app \
  --image gcr.io/PROJECT_ID/sisrua-app \
  --region southamerica-east1 \
  --platform managed \
  --allow-unauthenticated
```

---

## Troubleshooting

### ❌ Container não inicia

**Erro**: `Error: Cannot find module...`

```bash
# Rebuild sem cache
docker compose build --no-cache
docker compose up
```

**Erro**: `Port 8080 is already in use`

```bash
# Opção 1: Pare processo usando a porta
lsof -ti:8080 | xargs kill -9  # Linux/Mac
netstat -ano | findstr :8080   # Windows (veja PID e use taskkill)

# Opção 2: Use outra porta
# Edite docker compose.yml:
ports:
  - "8081:8080"  # Usa 8081 no host, 8080 no container
```

### ❌ Python engine falha

**Erro**: `ModuleNotFoundError: No module named 'osmnx'`

```bash
# Rebuild da imagem (Python venv pode estar corrompido)
docker compose down
docker compose build --no-cache
docker compose up
```

### ❌ DXF gerado vazio ou com erro

```bash
# Veja logs detalhados do Python engine
docker compose logs -f app | grep -i "python\|dxf\|error"

# Teste Python engine diretamente
docker compose exec app python3 py_engine/main.py \
  --lat -23.566390 \
  --lon -46.656081 \
  --radius 500 \
  --output /app/public/dxf/test.dxf
```

### ❌ Imagem Docker muito grande

```bash
# Verifique tamanho da imagem
docker images | grep sisrua

# Limpe imagens antigas
docker system prune -a

# Otimize .dockerignore
# Adicione em .dockerignore:
node_modules
dist
cache
*.log
test_files
```

### ❌ Build lento

**Solução 1: Use BuildKit** (cache mais inteligente)

```bash
# Habilite BuildKit
export DOCKER_BUILDKIT=1
docker compose build

# Ou permanentemente (Linux/Mac)
echo 'export DOCKER_BUILDKIT=1' >> ~/.bashrc
```

**Solução 2: Cache de layers**

```bash
# Certifique-se de não usar --no-cache desnecessariamente
docker compose build  # Usa cache (rápido)
docker compose build --no-cache  # Sem cache (lento, use apenas se necessário)
```

---

## Arquitetura Docker

### Isolamento Python vs .exe

**Antigo (Problemático)**:

- ❌ PyInstaller compila `sisrua_engine.exe`
- ❌ Antivírus bloqueia executável
- ❌ Windows-only
- ❌ ~150-300MB + dependências do SO

**Atual (Enterprise)**:

- ✅ Python roda diretamente no container
- ✅ Zero falsos positivos de antivírus
- ✅ Cross-platform (Linux, Mac, Windows)
- ✅ Isolado do sistema operacional do host

### pythonBridge.ts - Estratégia de Execução

```typescript
// PRODUÇÃO (Docker/Cloud Run):
if (process.env.NODE_ENV === "production") {
  command = "python"; // SEMPRE usa Python
  args = [scriptPath];
}
// DESENVOLVIMENTO (Windows):
else {
  // Usa .exe se existir, senão Python
  command = fs.existsSync(exePath) ? exePath : "python";
}
```

**Conclusão**: `.exe` é OPCIONAL e usado apenas em desenvolvimento Windows. Produção SEMPRE usa Python em container Docker.

### Comparação de Abordagens

| Aspecto        | Binário .exe             | Docker Container            |
| -------------- | ------------------------ | --------------------------- |
| Isolamento     | ❌ Roda no SO host       | ✅ Completamente isolado    |
| Segurança      | ⚠️ Antivírus flags       | ✅ Containerizado           |
| Portabilidade  | ❌ Windows-only          | ✅ Multiplataforma          |
| Escalabilidade | ❌ Manual                | ✅ Auto-scaling (Cloud Run) |
| Deploy         | ❌ Manual                | ✅ CI/CD automatizado       |
| Dependências   | ❌ Requer Python no host | ✅ Self-contained           |

---

## 📚 Recursos Adicionais

- **Dockerfile**: [sisrua_unified/Dockerfile](./Dockerfile)
- **docker compose.yml**: [sisrua_unified/docker compose.yml](./docker compose.yml)
- **Arquitetura**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Avaliação Docker**: [/DOCKER_EVALUATION.md](../DOCKER_EVALUATION.md)

---

## 🆘 Suporte

Se encontrar problemas:

1. **Verifique logs**: `docker compose logs -f app`
2. **Health check**: `curl http://localhost:8080/health`
3. **Rebuild**: `docker compose build --no-cache`
4. **Issues**: [GitHub Issues](https://github.com/jrlampa/myworld/issues)

---

**Última atualização**: 2026-02-18  
**Versão Docker**: 24.0+  
**Versão Docker Compose**: 2.0+
