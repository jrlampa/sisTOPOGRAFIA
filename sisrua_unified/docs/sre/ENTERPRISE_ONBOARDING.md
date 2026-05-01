# Pacote de Homologação Enterprise — sisTOPOGRAFIA

> **Roadmap Item 122 [T1] — Pacote de Homologação Enterprise**
>
> Este documento contém todos os requisitos técnicos e procedimentos necessários
> para instalação, homologação e operação do sisTOPOGRAFIA em ambiente corporativo
> restritivo. Deve ser entregue ao time de infraestrutura e segurança do cliente
> antes do início do processo de homologação.

**Versão:** 1.0.0
**Data de emissão:** 2026-04-14
**Revisão programada:** 2026-07-14 (trimestral ou a cada release major)
**Proprietário:** Tech Lead + SRE
**Audiência:** Time de infraestrutura, segurança e TI do cliente enterprise

---

## Sumário

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Requisitos de Rede — Portas e Protocolos](#2-requisitos-de-rede--portas-e-protocolos)
3. [Domínios Externos Acessados](#3-domínios-externos-acessados)
4. [Requisitos de Infraestrutura (CPU / RAM / Storage)](#4-requisitos-de-infraestrutura-cpu--ram--storage)
5. [Configuração de Proxy Corporativo](#5-configuração-de-proxy-corporativo)
6. [Checklist de Segurança](#6-checklist-de-segurança)
7. [Variáveis de Ambiente](#7-variáveis-de-ambiente)
8. [Health Check e Endpoints de Monitoramento](#8-health-check-e-endpoints-de-monitoramento)
9. [IPs do Cloud Run para Allowlist](#9-ips-do-cloud-run-para-allowlist)
10. [Checklist de Homologação](#10-checklist-de-homologação)
11. [Suporte e Escalação](#11-suporte-e-escalação)

---

## 1. Visão Geral da Arquitetura

O sisTOPOGRAFIA opera como uma aplicação SaaS hospedada no Google Cloud Platform,
região `southamerica-east1` (São Paulo). O cliente acessa o sistema via browser ou
integração de API — **não há instalação de software on-premises**.

```
┌─────────────────────────────────────────────────────────────────────┐
│ REDE CORPORATIVA DO CLIENTE                                          │
│                                                                     │
│  ┌──────────┐     HTTPS 443     ┌─────────────────────────────┐    │
│  │ Browser  │ ─────────────────►│                             │    │
│  │ do       │                   │   Google Cloud Run          │    │
│  │ Usuário  │                   │   sisrua-app                │    │
│  └──────────┘                   │   southamerica-east1        │    │
│                                 │                             │    │
│  ┌──────────┐     HTTPS 443     │   ┌───────────────────┐    │    │
│  │Integração│ ─────────────────►│   │ Express + Python  │    │    │
│  │ API      │                   │   │ Engine            │    │    │
│  │ (REST)   │                   │   └───────────────────┘    │    │
│  └──────────┘                   └──────────┬──────────────────┘    │
│                                            │                        │
└────────────────────────────────────────────│────────────────────────┘
                                             │ HTTPS (saída da nuvem)
                         ┌───────────────────┼──────────────────────┐
                         │                   │                       │
                    ┌────▼───┐         ┌─────▼──┐         ┌────────▼──┐
                    │Supabase│         │  IBGE  │         │  OSM/INDE │
                    │(banco) │         │  API   │         │ TOPODATA  │
                    └────────┘         └────────┘         └───────────┘
```

**Modelo de implantação:** SaaS multi-tenant (ou instância dedicada para clientes
enterprise com contrato específico).

**Não há:**

- Agentes instalados na máquina do cliente.
- Acesso VPN à rede interna do cliente.
- Acesso a Active Directory / LDAP do cliente (a menos que SSO/SAML seja configurado).

---

## 2. Requisitos de Rede — Portas e Protocolos

### 2.1 Tráfego de Entrada (Cliente → sisTOPOGRAFIA)

| Porta   | Protocolo      | Uso                                                               | Obrigatório? |
| ------- | -------------- | ----------------------------------------------------------------- | ------------ |
| **443** | HTTPS/TLS 1.2+ | Toda comunicação com a plataforma (API + Frontend)                | **Sim**      |
| 80      | HTTP           | Redirecionamento automático para HTTPS (sem dados em texto claro) | Recomendado  |

Nenhuma outra porta de entrada é necessária. O sistema **não** aceita tráfego em
portas não-padrão.

### 2.2 Tráfego de Saída (sisTOPOGRAFIA → APIs Externas)

Este tráfego ocorre **dentro da nuvem** (Cloud Run → internet). O cliente não
precisa abrir portas de saída em seu firewall — apenas a porta 443 para o domínio
principal do sisTOPOGRAFIA.

Para clientes com **inspeção de tráfego SSL/TLS** (deep packet inspection):

| Destino                               | Porta    | Protocolo  |
| ------------------------------------- | -------- | ---------- |
| `*.run.app` (Cloud Run)               | 443      | HTTPS      |
| `servicodados.ibge.gov.br`            | 443      | HTTPS      |
| `geoservicos.inde.gov.br`             | 443      | HTTPS      |
| `nominatim.openstreetmap.org`         | 443      | HTTPS      |
| `overpass-api.de`                     | 443      | HTTPS      |
| `www.dsr.inpe.br`                     | 80 / 443 | HTTP/HTTPS |
| `supabase.co` e `*.supabase.co`       | 443      | HTTPS      |
| `googleapis.com` e `*.googleapis.com` | 443      | HTTPS      |

### 2.3 Certificados TLS

- A plataforma usa certificados gerenciados pelo Google Cloud (Let's Encrypt via
  Google-managed SSL).
- TLS mínimo: **TLS 1.2**. Recomendado: TLS 1.3.
- Cipher suites: ECDHE-RSA-AES128-GCM-SHA256, ECDHE-RSA-AES256-GCM-SHA384 e
  superiores. RC4 e 3DES não são suportados.

---

## 3. Domínios Externos Acessados

### 3.1 Domínio Principal da Plataforma

| Domínio                    | Finalidade                                                         |
| -------------------------- | ------------------------------------------------------------------ |
| `<URL_DO_CLIENTE>.run.app` | URL principal do serviço (ou domínio personalizado se configurado) |

### 3.2 APIs Externas de Dados Geográficos

O sisTOPOGRAFIA consome as seguintes APIs públicas para geração de mapas e cálculos.
Todas as chamadas partem **do servidor na nuvem**, não do browser do usuário.

| Domínio                       | Organização              | Dado fornecido                           | Protocolo | Timeout configurado |
| ----------------------------- | ------------------------ | ---------------------------------------- | --------- | ------------------- |
| `servicodados.ibge.gov.br`    | IBGE — Gov. Federal      | Malhas territoriais, municípios, estados | HTTPS     | 10 s                |
| `geoservicos.inde.gov.br`     | INDE — Gov. Federal      | WFS/WMS dados geoespaciais oficiais      | HTTPS     | 10 s                |
| `nominatim.openstreetmap.org` | OpenStreetMap Foundation | Geocoding de endereços                   | HTTPS     | 10 s                |
| `overpass-api.de`             | OpenStreetMap Community  | Features geográficas OSM                 | HTTPS     | 10 s                |
| `www.dsr.inpe.br`             | INPE — Gov. Federal      | Elevação TOPODATA (MDE 30 m)             | HTTP      | 15 s                |
| `tile.openstreetmap.org`      | OpenStreetMap Foundation | Tiles de mapa para visualização          | HTTPS     | 5 s                 |

> **Privacidade:** Apenas coordenadas geográficas do projeto são enviadas às APIs
> externas. Nenhum dado identificável de usuário é transmitido a terceiros.

### 3.3 Infraestrutura Google Cloud

| Domínio               | Finalidade                                                   |
| --------------------- | ------------------------------------------------------------ |
| `*.googleapis.com`    | Google Cloud APIs (Cloud Run, Cloud Tasks, Secret Manager)   |
| `*.run.app`           | Endpoints Cloud Run                                          |
| `*.pkg.dev`           | Google Artifact Registry (imagens Docker — apenas no deploy) |
| `accounts.google.com` | Autenticação de serviço (Workload Identity)                  |

### 3.4 Supabase (Banco de Dados)

| Domínio                        | Finalidade                                              |
| ------------------------------ | ------------------------------------------------------- |
| `*.supabase.co`                | API e conexão PostgreSQL (dados de usuários e projetos) |
| `db.<PROJECT_REF>.supabase.co` | Conexão direta ao banco (porta 5432 / 6543 pgBouncer)   |

> Supabase opera na AWS us-east-1. Para clientes com restrição de soberania de
> dados, consultar opção de instância dedicada ou self-hosted.

---

## 4. Requisitos de Infraestrutura (CPU / RAM / Storage)

### 4.1 Lado Servidor (Cloud Run — gerenciado pelo time sisTOPOGRAFIA)

| Recurso                | Configuração atual    | Mínimo recomendado | Notas                                         |
| ---------------------- | --------------------- | ------------------ | --------------------------------------------- |
| **CPU**                | 2 vCPU por instância  | 1 vCPU             | 2 vCPU para geração DXF concorrente           |
| **RAM**                | 1024 Mi por instância | 512 Mi             | 1024 Mi mínimo para processamento geoespacial |
| **Timeout de request** | 300 s (5 min)         | 60 s               | DXF pode levar até 120 s                      |
| **Auto-scaling**       | 0 – 10 instâncias     | 0 – 3 (básico)     | min=1 recomendado para SLA enterprise         |
| **Storage efêmero**    | 512 Mi                | 256 Mi             | Arquivos DXF temporários                      |

### 4.2 Lado Cliente (Browser do Usuário)

| Requisito                     | Mínimo                                        | Recomendado              |
| ----------------------------- | --------------------------------------------- | ------------------------ |
| **Navegador**                 | Chrome 90+, Firefox 88+, Edge 90+, Safari 14+ | Chrome 120+ ou Edge 120+ |
| **RAM disponível no browser** | 2 GB                                          | 4 GB                     |
| **Largura de banda**          | 10 Mbps                                       | 50 Mbps                  |
| **Resolução de tela**         | 1280 × 720                                    | 1920 × 1080              |
| **JavaScript**                | Habilitado (obrigatório)                      | —                        |
| **Cookies**                   | Habilitados (sessão)                          | —                        |
| **WebGL**                     | Necessário para visualização 3D do mapa       | —                        |

> **IE 11 e versões anteriores:** Não suportados. O sistema usa React 18 + Vite
> com ES2020 target mínimo.

### 4.3 Integrações via API REST (Clientes Técnicos)

| Requisito                     | Valor                                                    |
| ----------------------------- | -------------------------------------------------------- |
| Protocolo                     | HTTPS (TLS 1.2+)                                         |
| Formato de dados              | JSON (application/json)                                  |
| Autenticação                  | Bearer token (JWT) no header `Authorization`             |
| Rate limit padrão             | 100 requisições / 15 min (geral); 10 req/h (geração DXF) |
| Tamanho máximo de body        | 1 MB (configurável)                                      |
| Timeout recomendado (cliente) | 180 s para endpoints DXF; 10 s para demais               |

---

## 5. Configuração de Proxy Corporativo

### 5.1 Proxy no Browser (Usuário Final)

Se o cliente usa proxy corporativo para saída de internet, o browser deve ter o
proxy configurado para permitir tráfego HTTPS para o domínio da plataforma.

**Whitelist mínima para PAC file / proxy WPAD:**

```javascript
// Trecho para PAC file corporativo
function FindProxyForURL(url, host) {
  // sisTOPOGRAFIA — acesso direto (sem inspeção SSL)
  if (shExpMatch(host, "*.run.app")) return "DIRECT";
  if (shExpMatch(host, "<dominio-personalizado>")) return "DIRECT";
  // ... restante das regras corporativas
}
```

### 5.2 Proxy nas Variáveis de Ambiente do Servidor

Se o Cloud Run precisar usar proxy corporativo para acessar APIs externas
(cenário incomum em SaaS, mas possível em implantações de VPC privada):

```bash
# Configurar no Cloud Run via secrets ou env vars:
HTTP_PROXY=http://proxy.empresa.com.br:8080
HTTPS_PROXY=http://proxy.empresa.com.br:8080
NO_PROXY=localhost,127.0.0.1,metadata.google.internal,*.googleapis.com

# Para o runtime Python (requests / osmnx):
# Estes valores são lidos automaticamente pelas libs Python
```

> **Nota:** A maioria das implantações SaaS na GCP não requer proxy de saída.
> Usar apenas se a arquitetura de rede corporativa do cliente exigir.

### 5.3 Inspeção SSL/TLS Corporativa (Deep Packet Inspection)

Se o cliente usa DPI com re-assinatura de certificados:

1. O certificado CA corporativo deve ser adicionado ao truststore do container
   (arquivo `Dockerfile` — variável `CUSTOM_CA_CERT`).
2. Alternativa: adicionar os domínios do sisTOPOGRAFIA à bypass list do DPI.
3. Recomendamos a opção de bypass — DPI em APIs de mapas pode interferir no
   carregamento de tiles e dados geográficos binários.

**Domínios para bypass do DPI:**

```
*.run.app
servicodados.ibge.gov.br
geoservicos.inde.gov.br
nominatim.openstreetmap.org
overpass-api.de
www.dsr.inpe.br
*.supabase.co
*.googleapis.com
```

---

## 6. Checklist de Segurança

### 6.1 Checklist de Firewall

```
[ ] 6.1.1  Porta 443 (HTTPS) liberada para o domínio da plataforma (saída do browser)
[ ] 6.1.2  Redirecionamento HTTP→HTTPS verificado (porta 80 pode ser bloqueada)
[ ] 6.1.3  Domínios externos da seção 3.2 adicionados à allowlist (se aplicável)
[ ] 6.1.4  Nenhuma regra de bloqueio por geolocalização para os IPs do Cloud Run
[ ] 6.1.5  Rate limiting do WAF corporativo não interfere com uploads de lote (até 50 MB)
[ ] 6.1.6  Timeout do proxy/firewall ≥ 300 s para o domínio da plataforma
           (requisições DXF podem durar até 120 s)
[ ] 6.1.7  WebSocket não bloqueado (futuras funcionalidades de tempo real)
```

### 6.2 Checklist de Antivírus / EDR

```
[ ] 6.2.1  Downloads de arquivos .dxf do domínio da plataforma não bloqueados pelo antivírus
[ ] 6.2.2  Domínio da plataforma na lista de sites confiáveis do antivírus/EDR
[ ] 6.2.3  Verificar que o antivírus não faz man-in-the-middle no certificado TLS
           da plataforma (ver seção 5.3 sobre DPI)
[ ] 6.2.4  Extensões de browser (ex: antivírus browser plugin) não interferem com
           o carregamento do mapa interativo
```

### 6.3 Checklist de Gestão de Acesso

```
[ ] 6.3.1  Usuários criados com roles apropriados (admin / operador / visualizador)
[ ] 6.3.2  MFA habilitado para todas as contas com acesso a dados de projetos
[ ] 6.3.3  Política de senha forte aplicada (mínimo 12 caracteres, letras + números + símbolo)
[ ] 6.3.4  Sessões configuradas com timeout de inatividade (recomendado: 8 horas)
[ ] 6.3.5  Lista de usuários com acesso revisada trimestralmente
[ ] 6.3.6  Contas de usuários desligados desativadas em até 24 horas
```

### 6.4 Checklist de Conformidade LGPD

```
[ ] 6.4.1  DPO do cliente identificado e informado ao sisTOPOGRAFIA
[ ] 6.4.2  Contrato de tratamento de dados (DPA) assinado entre as partes
[ ] 6.4.3  Base legal para tratamento dos dados identificada e documentada
[ ] 6.4.4  Usuários informados sobre o tratamento de dados (política de privacidade)
[ ] 6.4.5  Processo de exclusão de dados de titulares (direito ao esquecimento) testado
[ ] 6.4.6  Canal de comunicação com DPO sisTOPOGRAFIA registrado: dpo@<dominio>
```

---

## 7. Variáveis de Ambiente

### 7.1 Variáveis Obrigatórias para Operação

| Variável               | Descrição                 | Exemplo                           | Sensível? |
| ---------------------- | ------------------------- | --------------------------------- | --------- |
| `NODE_ENV`             | Ambiente de execução      | `production`                      | Não       |
| `PORT`                 | Porta do servidor HTTP    | `8080`                            | Não       |
| `GCP_PROJECT`          | ID do projeto GCP         | `sisrua-producao`                 | Não       |
| `CLOUD_TASKS_LOCATION` | Região do Cloud Tasks     | `southamerica-east1`              | Não       |
| `CLOUD_TASKS_QUEUE`    | Nome da fila de tarefas   | `sisrua-queue`                    | Não       |
| `CLOUD_RUN_BASE_URL`   | URL pública do serviço    | `https://sisrua-app-xxxx.run.app` | Não       |
| `DATABASE_URL`         | URL de conexão PostgreSQL | `postgresql://user:pass@host/db`  | **Sim**   |

### 7.2 Variáveis Opcionais com Impacto em Segurança

| Variável                    | Descrição                      | Padrão                   | Sensível? |
| --------------------------- | ------------------------------ | ------------------------ | --------- |
| `METRICS_TOKEN`             | Token para proteger `/metrics` | (sem auth)               | **Sim**   |
| `METRICS_ENABLED`           | Habilitar endpoint Prometheus  | `true`                   | Não       |
| `RATE_LIMIT_GENERAL_MAX`    | Max requisições por janela     | `100`                    | Não       |
| `RATE_LIMIT_DXF_MAX`        | Max gerações DXF por hora      | `10`                     | Não       |
| `PYTHON_PROCESS_TIMEOUT_MS` | Timeout do worker Python       | `300000` (5 min)         | Não       |
| `DXF_WORKER_CONCURRENCY`    | Workers DXF simultâneos        | `2`                      | Não       |
| `LOG_LEVEL`                 | Nível de log                   | `info`                   | Não       |
| `TRUST_PROXY`               | Configuração de proxy reverso  | (auto)                   | Não       |
| `USE_SUPABASE_JOBS`         | Persistir jobs no banco        | `true` (se DATABASE_URL) | Não       |

### 7.3 Variáveis de Constantes CQT (Banco de Dados)

| Variável                       | Descrição                                | Padrão  |
| ------------------------------ | ---------------------------------------- | ------- |
| `USE_DB_CONSTANTS_CQT`         | Usar tabelas CQT do banco                | `false` |
| `USE_DB_CONSTANTS_CLANDESTINO` | Usar tabelas clandestino do banco        | `false` |
| `USE_DB_CONSTANTS_CONFIG`      | Usar configurações operacionais do banco | `false` |

### 7.4 Boas Práticas de Gestão de Secrets

```
[ ] Todas as variáveis marcadas como "Sensível?" devem ser armazenadas em
    Google Secret Manager — NUNCA como variáveis de ambiente em texto claro.
[ ] Rotação de DATABASE_URL e METRICS_TOKEN a cada 90 dias.
[ ] Auditoria de acesso aos secrets via Cloud Audit Logs.
```

---

## 8. Health Check e Endpoints de Monitoramento

### 8.1 Endpoint de Health Check

| Endpoint  | Método | Autenticação | Resposta esperada                               |
| --------- | ------ | ------------ | ----------------------------------------------- |
| `/health` | GET    | Nenhuma      | HTTP 200 com JSON `{ "status": "online", ... }` |

**Exemplo de resposta:**

```json
{
  "status": "online",
  "version": "1.2.0",
  "uptime": 86400,
  "timestamp": "2026-04-14T10:00:00.000Z",
  "services": {
    "database": "ok",
    "cache": "ok",
    "python_engine": "ok"
  }
}
```

**Uso para monitoramento externo:**

```bash
# Probe básico (curl)
curl -sf "https://<URL>/health" | jq '.status'

# Probe com timeout
curl -sf --max-time 10 "https://<URL>/health" && echo "OK" || echo "FAIL"

# Para ferramentas de monitoramento (UptimeRobot, Pingdom, etc.):
# URL: https://<URL>/health
# Método: GET
# Tipo: HTTP(S)
# Intervalo: 60 s
# Timeout: 10 s
# Critério de sucesso: HTTP 200 + corpo contém "online"
```

### 8.2 Endpoint de Métricas Prometheus

| Endpoint   | Método | Autenticação                                  | Formato                |
| ---------- | ------ | --------------------------------------------- | ---------------------- |
| `/metrics` | GET    | Bearer token (se `METRICS_TOKEN` configurado) | Prometheus text format |

```bash
# Consultar métricas (com autenticação)
curl -H "Authorization: Bearer $METRICS_TOKEN" \
  "https://<URL>/metrics"

# Exemplo de configuração Prometheus scrape_config:
# scrape_configs:
#   - job_name: 'sisrua'
#     scheme: https
#     metrics_path: /metrics
#     bearer_token: '<METRICS_TOKEN>'
#     static_configs:
#       - targets: ['<URL_SEM_HTTPS>']
```

### 8.3 Endpoint da API REST

| Endpoint                 | Descrição                                  |
| ------------------------ | ------------------------------------------ |
| `/api-docs`              | Documentação interativa Swagger            |
| `/api/health`            | Health check da API (idêntico a `/health`) |
| `POST /api/dxf/generate` | Geração de DXF (autenticado)               |
| `POST /api/bt/calculate` | Cálculo BT/CQT (autenticado)               |
| `GET /api/jobs/:id`      | Status de job assíncrono                   |
| `GET /api/ibge/states`   | Lista de estados IBGE                      |
| `GET /api/osm/search`    | Busca de endereços OSM                     |

### 8.4 Checklist de Validação dos Endpoints

```bash
# Validação completa de conectividade (executar do ambiente do cliente):

echo "=== Teste 1: Health Check ==="
curl -sf --max-time 10 "https://<URL>/health" | jq .

echo "=== Teste 2: Swagger disponível ==="
curl -sf --max-time 5 "https://<URL>/api-docs" -o /dev/null -w "HTTP %{http_code}\n"

echo "=== Teste 3: Métricas (com token) ==="
curl -sf --max-time 5 \
  -H "Authorization: Bearer $METRICS_TOKEN" \
  "https://<URL>/metrics" | head -5

echo "=== Teste 4: IBGE API (proxy de dados) ==="
curl -sf --max-time 15 \
  "https://<URL>/api/ibge/states" | jq '.length'

echo "=== Teste 5: Latência baseline ==="
curl -o /dev/null -s -w "Connect: %{time_connect}s | Total: %{time_total}s\n" \
  "https://<URL>/health"
```

---

## 9. IPs do Cloud Run para Allowlist

### 9.1 Importante: IPs Dinâmicos

O Google Cloud Run usa endereços IP dinâmicos e compartilhados entre clientes da GCP.
**Não é possível manter uma lista fixa de IPs de saída do Cloud Run** para allowlist.

### 9.2 Opções para Clientes com Restrição de IP

**Opção A — Allowlist por Domínio (recomendada)**

Configurar o firewall para permitir tráfego baseado em domínio (SNI/FQDN) em vez de IP:

```
Domínio: <URL_DO_SERVICO>.run.app  (ou domínio personalizado configurado)
Porta: 443
Protocolo: HTTPS
```

**Opção B — Static Outbound IP via Cloud NAT (disponível para contratos enterprise)**

Para clientes que exigem IPs fixos para allowlist nos sistemas que o sisTOPOGRAFIA
acessa (ex.: banco de dados on-premises do cliente):

```bash
# Configuração de Cloud NAT com IP estático (realizada pela equipe SRE sisTOPOGRAFIA)
# 1. Criar IP estático regional:
gcloud compute addresses create sisrua-nat-ip \
  --region southamerica-east1

# 2. Configurar Cloud NAT no VPC do Cloud Run
# (requer VPC Connector — solicitar ao time SRE)

# O IP estático resultante é então fornecido ao cliente para allowlist.
```

> **Solicitar IP estático:** abrir ticket de suporte enterprise com justificativa.
> Há custo adicional de infraestrutura para esta configuração.

### 9.3 Ranges de IP do Google Cloud (para configurações de firewall L3)

Se o firewall do cliente opera apenas com regras de IP (não por domínio), os ranges
oficiais da GCP podem ser obtidos em:

```bash
# Download dos ranges de IP do Google Cloud:
curl -s "https://www.gstatic.com/ipranges/cloud.json" | \
  jq '.prefixes[] | select(.scope=="southamerica-east1") | .ipv4Prefix' 2>/dev/null

# Ou a lista completa: https://www.gstatic.com/ipranges/cloud.json
# Filtrar por "scope": "southamerica-east1"
```

> **Atenção:** Estes ranges mudam periodicamente. Usar regras baseadas em domínio
> é sempre preferível a regras baseadas em IP para serviços cloud.

---

## 10. Checklist de Homologação

### Fase 1 — Pré-Requisitos (antes da entrega do ambiente)

```
[ ] 10.1.1  Contrato enterprise assinado com SLA, DPA e NDA
[ ] 10.1.2  URL do ambiente de homologação fornecida ao cliente
[ ] 10.1.3  Credenciais de acesso para usuários de teste entregues
[ ] 10.1.4  Este documento (ENTERPRISE_ONBOARDING.md) entregue ao time de TI do cliente
[ ] 10.1.5  Checklist de segurança (seção 6) preenchido e validado com TI do cliente
[ ] 10.1.6  DPA assinado (LGPD — tratamento de dados pessoais)
[ ] 10.1.7  Firewall/proxy configurados conforme seção 2 e 3
```

### Fase 2 — Validação Técnica (executar com time de TI do cliente)

```
[ ] 10.2.1  Health check respondendo HTTP 200 do ambiente do cliente
[ ] 10.2.2  Latência de /health < 500 ms (da rede do cliente)
[ ] 10.2.3  Download de arquivo .dxf de teste realizado com sucesso
[ ] 10.2.4  Cálculo BT de exemplo executado com resultado correto (paridade CQT aprovada)
[ ] 10.2.5  Upload de arquivo batch CSV funcionando (≤ 50 MB)
[ ] 10.2.6  Acesso à documentação Swagger (/api-docs) disponível
[ ] 10.2.7  Autenticação com conta de usuário de produção funcionando
[ ] 10.2.8  MFA testado e funcionando para todos os usuários administradores
```

### Fase 3 — Validação de Segurança

```
[ ] 10.3.1  Teste de penetração básico (varredura de portas — apenas porta 443 acessível)
[ ] 10.3.2  Verificar que /metrics retorna 401 sem token (se METRICS_TOKEN configurado)
[ ] 10.3.3  Verificar que requisições com token inválido retornam 401 (não 500)
[ ] 10.3.4  Verificar rate limiting ativo (testar com > 100 req/15min)
[ ] 10.3.5  Verificar que dados de outros clientes não são acessíveis (isolamento de tenant)
[ ] 10.3.6  Teste de injeção básica nos campos de coordenadas (rejeita lat/lon inválidos)
[ ] 10.3.7  Cabeçalhos de segurança presentes (HSTS, X-Content-Type-Options, CSP)
```

### Fase 4 — Validação Operacional

```
[ ] 10.4.1  Probe de monitoramento externo configurado no UptimeRobot/Grafana do cliente
[ ] 10.4.2  Dashboard de SLA compartilhado e acessível
[ ] 10.4.3  Processo de notificação de incidentes testado (e-mail de alerta recebido)
[ ] 10.4.4  Janela de manutenção domingo 02:00–04:00 BRT documentada para o cliente
[ ] 10.4.5  Canal de escalação on-call testado
[ ] 10.4.6  Relatório mensal de SLA — primeiro exemplar enviado e validado
[ ] 10.4.7  Processo de abertura de claim de SLA explicado ao account manager do cliente
```

### Fase 5 — Aceite e Go-Live

```
[ ] 10.5.1  Todas as fases anteriores concluídas e assinadas
[ ] 10.5.2  Termo de aceite de homologação assinado pelo responsável técnico do cliente
[ ] 10.5.3  Data de go-live definida e comunicada
[ ] 10.5.4  Treinamento da equipe do cliente realizado (ou agendado)
[ ] 10.5.5  Documentação de suporte entregue (FAQ, guia de uso, contatos de suporte)
[ ] 10.5.6  Ambiente de staging mantido separado do produção
```

---

## 11. Suporte e Escalação

### 11.1 Níveis de Suporte

| Nível                  | Canal                       | Horário                 | Tempo de resposta |
| ---------------------- | --------------------------- | ----------------------- | ----------------- |
| **Suporte Padrão**     | E-mail: `suporte@<dominio>` | Seg–Sex 08:00–18:00 BRT | 4 horas úteis     |
| **Suporte Enterprise** | E-mail + WhatsApp Business  | Seg–Sex 07:00–22:00 BRT | 1 hora útil       |
| **On-Call P1**         | Telefone direto / PagerDuty | 24 × 7                  | 15 minutos        |

### 11.2 Informações para Abertura de Chamado

Sempre incluir nos chamados:

```
1. Nome da empresa e número do contrato
2. Usuário afetado (e-mail)
3. Horário do ocorrido (com fuso BRT)
4. Descrição do problema
5. Passos para reproduzir (se aplicável)
6. Screenshots ou logs de erro (sem dados sensíveis)
7. Impacto estimado (quantos usuários / projetos afetados)
```

### 11.3 Documentação de Referência

| Documento                   | Localização                              |
| --------------------------- | ---------------------------------------- |
| Este documento              | `docs/sre/ENTERPRISE_ONBOARDING.md`      |
| SLOs e métricas             | `docs/sre/SLO_DEFINITIONS.md`            |
| Contrato de SLA             | `docs/sre/SLA_CONTRATOS.md`              |
| Runbooks operacionais       | `docs/sre/RUNBOOKS.md`                   |
| Playbook LGPD               | `docs/sre/INCIDENT_PLAYBOOK_LGPD.md`     |
| Arquitetura do sistema      | `docs/ARCHITECTURE.md`                   |
| APIs brasileiras integradas | `docs/APIS_BRASILEIRAS_IMPLEMENTADAS.md` |
| Changelog                   | `CHANGELOG.md`                           |

---

_Documento mantido pelo time de SRE. Atualizar a cada release major ou mudança de infraestrutura._
_Última atualização: 2026-04-14_
