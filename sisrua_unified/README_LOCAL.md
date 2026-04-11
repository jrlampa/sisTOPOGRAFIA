# SIS RUA Unified - Uso Local (Modo Enterprise)

Guia rápido para uso local do Sis RUA sem Docker, focado em testes manuais e validação antes do release SaaS.

## ⚡ Quick Start (5 minutos)

### 1. Instalação Automática

**Windows (PowerShell):**
```powershell
cd sisrua_unified
npm run setup:local
```

**Linux/Mac:**
```bash
cd sisrua_unified
npm run setup:local:bash
```

### 2. Iniciar Desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## 📋 Pré-Requisitos

| Componente | Versão Mínima | Download |
|------------|---------------|----------|
| Node.js | 22.x | https://nodejs.org |
| Python | 3.9+ | https://python.org |
| Git | Opcional | https://git-scm.com |

---

## 🎯 Modos de Operação

### Modo Desenvolvimento (Nativo)
```bash
npm run dev          # Frontend + Backend simultâneos
npm run server       # Apenas backend (porta 3001)
npm run client       # Apenas frontend (porta 3000)
```

### Modo Docker (Alternativo)
```bash
docker compose up    # Tudo em containers
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz:

```env
# Básico (obrigatório)
NODE_ENV=development
PORT=3001
PYTHON_COMMAND=python3

# Modo Offline (sem GCP/Firestore)
OFFLINE_MODE=true
USE_FIRESTORE=false

# Constants catalog rollout (opcional)
USE_DB_CONSTANTS_CQT=false
USE_DB_CONSTANTS_CLANDESTINO=false
USE_DB_CONSTANTS_CONFIG=false

# Token de proteção para refresh operacional em runtime
# Recomendado em staging/produção.
CONSTANTS_REFRESH_TOKEN=change-me

# GROQ AI (opcional, para busca inteligente)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
```

**Obtenha GROQ_API_KEY gratuita:** https://console.groq.com/keys

---

## 🧪 Testes Rápidos

### Teste 1: Health Check
```bash
curl http://localhost:3001/health
```

**Esperado:**
```json
{
  "status": "online",
  "python": "available"
}
```

### Teste 2: Geração Demo (Offline)
```bash
python py_engine/create_demo_dxf.py --output teste.dxf
```

**Esperado:** Arquivo `teste.dxf` criado e abrível em CAD.

### Teste 2.1: Refresh operacional do catálogo de constantes

Sem token (ambiente não-produtivo, quando token não está configurado):

```bash
curl -X POST http://localhost:3001/api/constants/refresh
```

Com token (staging/produção recomendado):

```bash
curl -X POST http://localhost:3001/api/constants/refresh \
  -H "x-constants-refresh-token: change-me"
```

**Esperado:** resposta com `ok: true`, `refreshedNamespaces` e snapshots atualizados.

### Teste 2.2: Timeline de auditoria de refresh

```bash
curl "http://localhost:3001/api/constants/refresh-events?limit=5"
```

Com token (quando protegido):

```bash
curl "http://localhost:3001/api/constants/refresh-events?limit=5" \
  -H "x-constants-refresh-token: change-me"
```

**Esperado:** lista `events` com `httpStatus`, `actor`, `durationMs` e `createdAt`.

### Teste 3: Geração Via API (Com OSM)
```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -23.55052,
    "lon": -46.63331,
    "radius": 500,
    "mode": "circle",
    "layers": {"buildings": true, "roads": true}
  }'
```

---

## 🗂️ Estrutura de Diretórios

```
sisrua_unified/
├── src/              # Frontend React
├── server/           # Backend Node.js
├── py_engine/        # Motor Python (OSM → DXF)
├── public/dxf/       # DXFs gerados
├── cache/            # Cache local
└── logs/             # Logs de execução
```

---

## 🔧 Troubleshooting

### Python não encontrado
```bash
# Windows
set PYTHON_COMMAND=python

# Linux/Mac
export PYTHON_COMMAND=python3
```

### Erro "module not found"
```bash
# Reinstalar dependências Python
pip install -r py_engine/requirements.txt
```

### Porta em uso
```bash
# Alterar porta no .env
PORT=3002
```

### CORS error
- Verifique se `NODE_ENV=development`
- Confirme que backend está rodando na porta correta

---

## 📊 Arquitetura Local

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Frontend       │      │  Backend        │      │  Python         │
│  React (Vite)   │──────▶  Express        │──────▶  OSM → DXF      │
│  localhost:3000 │      │  localhost:3001 │      │  py_engine/     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
   Navegador              Job Queue              Arquivos DXF
   (UI/UX)               (in-memory)            (public/dxf/)
```

**Características modo local:**
- ✅ Sem dependência de GCP/Firestore
- ✅ Job queue em memória (sem Redis)
- ✅ Cache local em filesystem
- ✅ Geração DXF síncrona (sem Cloud Tasks)

---

## 🎓 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia tudo (frontend + backend) |
| `npm run build` | Build de produção |
| `npm run test:frontend` | Testes unitários frontend |
| `npm run test:backend` | Testes unitários backend |
| `npm run security:check` | Auditoria de segurança |
| `npm run docker:dev` | Modo Docker |

---

## 📚 Documentação Adicional

- **Testes Manuais:** `TESTES_MANUAIS.md`
- **Setup Docker:** `DOCKER_USAGE.md`
- **Guia Completo:** `README.md`
- **Arquitetura:** `ARCHITECTURE.md`

---

## 🚀 Próximos Passos

1. ✅ Execute `npm run setup:local`
2. ✅ Execute `npm run dev`
3. ✅ Siga o `TESTES_MANUAIS.md`
4. ✅ Valide geração de DXF
5. 🎯 **Pronto para uso local!**

---

**Versão:** 1.0  
**Atualizado:** 2026-04-03  
**Status:** ✅ Pronto para testes locais enterprise
