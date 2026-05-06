# SIS RUA Unified - Guia de Testes Manuais

Guia passo-a-passo para validação manual do sistema em modo local enterprise.

## 📋 Checklist de Pré-Requisitos

Antes de começar, verifique:

- [ ] Node.js 22+ instalado (`node --version`)
- [ ] Python 3.9+ instalado (`python --version`)
- [ ] Dependências instaladas (`npm run setup:local`)
- [ ] Arquivo `.env` configurado

---

## 🚀 Modo 1: Desenvolvimento Nativo (npm run dev)

### 1.1 Inicialização

```bash
cd sisrua_unified
npm run dev
```

**Verificações:**

- [ ] Frontend inicia sem erros (porta 3000)
- [ ] Backend inicia sem erros (porta 3001)
- [ ] Nenhum erro no console

**Teste de API:**

```bash
curl http://localhost:3001/health
```

**Esperado:**

```json
{
  "status": "online",
  "service": "sisRUA Unified Backend",
  "python": "available"
}
```

### 1.2 Health Check Completo

Execute no navegador ou via curl:

```bash
# Health check
curl http://localhost:3001/health | jq

# Firestore status (deve mostrar modo memory)
curl http://localhost:3001/api/firestore/status | jq
```

**Esperado:**

- `firestore.status.enabled: false`
- `mode: memory`
- Python: available

---

## 🗺️ Modo 2: Geração de DXF (Offline)

### 2.1 Geração Demo (Sem OSM)

**Objetivo:** Testar motor Python sem depender de internet.

```bash
python py_engine/create_demo_dxf.py --output test_demo.dxf
```

**Verificações:**

- [ ] Arquivo `test_demo.dxf` criado
- [ ] Tamanho > 0 bytes
- [ ] Abre no AutoCAD/LibreCAD sem erros

### 2.2 Geração Via API (Com OSM)

**Pré-requisito:** Conexão com internet para buscar OSM.

**Passos:**

1. Abra http://localhost:3000
2. Clique no mapa para selecionar área
3. Defina raio (ex: 500m)
4. Clique em "Generate DXF"

**Verificações:**

- [ ] Job criado (status: queued)
- [ ] Progresso atualiza (0% → 100%)
- [ ] Download automático do .dxf
- [ ] Arquivo abre corretamente em CAD

**Teste via curl:**

```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -23.55052,
    "lon": -46.63331,
    "radius": 500,
    "mode": "circle",
    "polygon": [],
    "layers": {"buildings": true, "roads": true},
    "projection": "utm"
  }'
```

**Esperado:**

```json
{
  "status": "success",
  "url": "http://localhost:3001/downloads/dxf_xxxx.dxf"
}
```

---

## 🔍 Modo 3: Busca de Localização

### 3.1 Busca com Ollama AI (Se serviço ativo)

**Pré-requisito:** Ollama rodando localmente (`http://localhost:11434`)

**Passos:**

1. Na interface, digite: "Avenida Paulista, São Paulo"
2. Clique em "Search"

**Verificações:**

- [ ] Resultado retornado com coordenadas
- [ ] Mapa centraliza na localização
- [ ] UTM calculado corretamente

**Teste via curl:**

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Avenida Paulista, São Paulo"}'
```

### 3.2 Busca sem Ollama (Fallback)

**Pré-requisito:** Ollama não rodando ou indisponível.

**Verificações:**

- [ ] Mensagem informativa sobre serviço não disponível
- [ ] Sistema continua funcionando

---

## 📁 Modo 4: Importação KML

### 4.1 Upload KML Válido

**Preparação:** Crie um arquivo `test.kml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>Test Point</name>
    <Point>
      <coordinates>-46.63331,-23.55052,0</coordinates>
    </Point>
  </Placemark>
</kml>
```

**Passos:**

1. Interface > "Import KML"
2. Selecione o arquivo

**Verificações:**

- [ ] Polígono/ponto exibido no mapa
- [ ] Sistema permite gerar DXF a partir do KML

---

## 🐳 Modo 5: Docker (Opcional)

### 5.1 Docker Compose

```bash
docker compose up
```

**Verificações:**

- [ ] Container inicia sem erros
- [ ] http://localhost:8080 acessível
- [ ] Geração de DXF funciona

---

## 🧪 Testes de Stress e Edge Cases

### 6.1 Geração Múltipla

Execute 5 gerações simultâneas:

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/dxf \
    -H "Content-Type: application/json" \
    -d '{"lat": -23.55052, "lon": -46.63331, "radius": 100, "mode": "circle", "polygon": [], "layers": {}}' &
done
wait
```

**Verificações:**

- [ ] Todas as requisições completam
- [ ] Nenhum crash
- [ ] Jobs processados corretamente

### 6.2 Validação de Erros

**Cenários:**

1. **Coordenadas inválidas:**

```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat": 999, "lon": 999, "radius": 500}'
```

**Esperado:** Erro 400 com mensagem clara

2. **Raio muito grande:**

```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.55052, "lon": -46.63331, "radius": 50000}'
```

**Esperado:** Erro ou warning sobre limite

### 6.3 Cache

**Teste de cache:**

```bash
# Primeira requisição (lenta)
time curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.55052, "lon": -46.63331, "radius": 500, "mode": "circle"}'

# Segunda requisição (rápida - cache hit)
time curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.55052, "lon": -46.63331, "radius": 500, "mode": "circle"}'
```

**Verificações:**

- [ ] Segunda requisição retorna "cached"
- [ ] Tempo de resposta menor

---

## ✅ Checklist Final

Marcar todos antes de release:

### Funcionalidades Core

- [ ] Setup local completa em < 5 minutos
- [ ] `npm run dev` funciona sem erros
- [ ] Health check retorna "online"
- [ ] Geração demo DXF funciona (sem internet)
- [ ] Geração OSM→DXF funciona (com internet)
- [ ] Busca AI funciona (com Ollama ativo)
- [ ] Importação KML funciona
- [ ] Download de DXF funciona

### Robustez

- [ ] Sistema funciona sem Ollama (modo offline)
- [ ] Sistema funciona sem Firestore/GCP
- [ ] Tratamento de erros adequado
- [ ] Logs informativos em todos os cenários
- [ ] Nenhum crash em uso normal

### Performance

- [ ] Primeira geração < 30 segundos
- [ ] Cache hit < 2 segundos
- [ ] UI responsiva durante processamento
- [ ] Memória estável (sem leaks)

### UX

- [ ] Mensagens de erro claras
- [ ] Feedback visual durante processamento
- [ ] Progresso mostrado corretamente
- [ ] Download automático funciona

---

## 🐛 Troubleshooting

### Problema: Python não encontrado

**Solução:**

```bash
# Windows
set PYTHON_COMMAND=python

# Linux/Mac
export PYTHON_COMMAND=python3
```

### Problema: Erro de CORS

**Verificar:**

- Backend está rodando na porta correta
- `NODE_ENV=development` no .env

### Problema: DXF não abre no CAD

**Verificar:**

- Arquivo não está vazio
- Formato é DXF R2018 ou compatível
- Testar com LibreCAD (gratuito) antes do AutoCAD

### Problema: OSM timeout

**Solução:**

- Reduzir raio da área
- Verificar conexão com internet
- Verificar status do serviço OSM

---

## 📝 Registro de Testes

| Data | Versão | Tester | Resultado         | Observações |
| ---- | ------ | ------ | ----------------- | ----------- |
|      |        |        | ⬜ Pass / ⬜ Fail |             |

---

## 🎯 Critérios de Aceitação

O sistema está **PRONTO** quando:

1. ✅ Setup local funciona em máquina limpa
2. ✅ Todos os testes acima passam
3. ✅ Nenhum erro crítico nos logs
4. ✅ DXF gerado abre em 2+ visualizadores diferentes
5. ✅ Documentação clara para usuário não-técnico

---

**Última atualização:** 2026-04-03  
**Versão do documento:** 1.0
