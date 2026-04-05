# Matriz Go/No-Go - Release Sis RUA Unified

## Data da Avaliação: ___________

---

## 1. Segurança (P0 - Blocker)

| Critério | Status | Evidência | Owner |
|----------|--------|-----------|-------|
| Webhook autenticado (OIDC) | ⬜ | Endpoint `/api/tasks/process-dxf` rejeita sem token | Backend |
| CORS restrito em produção | ⬜ | `Access-Control-Allow-Origin` não é `*` | Backend |
| Rate limiting ativo | ⬜ | Teste de carga mostra limitação por IP | Backend |
| Secrets não hardcoded | ⬜ | Nenhum secret encontrado no código | Security |
| Trust proxy configurado | ⬜ | `req.ip` mostra IP real do cliente | DevOps |

**Status Segurança:** ⬜ PASS / ⬜ FAIL

---

## 2. Arquitetura (P0 - Blocker)

| Critério | Status | Evidência | Owner |
|----------|--------|-----------|-------|
| Cloud Tasks operacional | ⬜ | Tasks são criadas e processadas | Backend |
| Jobs persistem no Firestore | ⬜ | Jobs sobrevivem a restart do serviço | Backend |
| Idempotência funcionando | ⬜ | Job duplicado não gera 2 DXFs | Backend |
| Retry com backoff | ⬜ | Falhas são retentadas automaticamente | Backend |
| Graceful shutdown | ⬜ | SIGTERM salva jobs pendentes | Backend |

**Status Arquitetura:** ⬜ PASS / ⬜ FAIL

---

## 3. Qualidade (P1 - Critical)

| Critério | Status | Evidência | Owner |
|----------|--------|-----------|-------|
| Backend tests passing | ⬜ | CI: `npm run test:backend` verde | QA |
| Frontend tests passing | ⬜ | CI: `npm run test:frontend` verde | QA |
| E2E smoke tests passing | ⬜ | CI: `npm run test:e2e -- --grep @smoke` verde | QA |
| Lint clean | ⬜ | CI: `npm run lint` sem erros | QA |
| Type check passing | ⬜ | CI: `tsc --noEmit` sem erros | QA |
| Security audit clean | ⬜ | CI: `npm audit` sem vulnerabilidades críticas | Security |
| Code coverage > 70% | ⬜ | Relatório de cobertura no CI | QA |

**Status Qualidade:** ⬜ PASS / ⬜ FAIL

---

## 4. Operação (P1 - Critical)

| Critério | Status | Evidência | Owner |
|----------|--------|-----------|-------|
| Health check funcionando | ⬜ | `/health` retorna 200 com dados válidos | DevOps |
| Logs estruturados | ⬜ | Winston logger com formato JSON | DevOps |
| Métricas disponíveis | ⬜ | Endpoint `/api/queue/stats` retorna estatísticas | DevOps |
| Alertas configurados | ⬜ | Cloud Monitoring alertas ativos (se aplicável) | DevOps |
| Documentação de runbook | ⬜ | Procedimentos de troubleshooting documentados | DevOps |

**Status Operação:** ⬜ PASS / ⬜ FAIL

---

## 5. Produto (P1 - Critical)

| Critério | Status | Evidência | Owner |
|----------|--------|-----------|-------|
| Fluxo DXF completo | ⬜ | Do upload de KML ao download de DXF funciona | QA |
| Geração de DXF sem erro | ⬜ | 3/3 gerações de teste bem-sucedidas | QA |
| Cache funcionando | ⬜ | Segunda geração usa cache (mais rápida) | Backend |
| Progresso em tempo real | ⬜ | WebSocket entrega progresso ao frontend | Backend |
| Componente de elevação funcional | ⬜ | Perfil de terreno é exibido corretamente | Frontend |

**Status Produto:** ⬜ PASS / ⬜ FAIL

---

## Decisão Final

| Área | Status |
|------|--------|
| Segurança | ⬜ GO / ⬜ NO-GO |
| Arquitetura | ⬜ GO / ⬜ NO-GO |
| Qualidade | ⬜ GO / ⬜ NO-GO |
| Operação | ⬜ GO / ⬜ NO-GO |
| Produto | ⬜ GO / ⬜ NO-GO |

### 🎯 DECISÃO: ⬜ **GO** / ⬜ **NO-GO**

---

## Assinaturas

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| Tech Lead | | | |
| QA Lead | | | |
| DevOps Lead | | | |
| Product Owner | | | |

---

## Notas da Reunião

```
[Espaco para anotacoes durante a reuniao Go/No-Go]



```

---

## Ações Pós-Decisão

### Se GO:
- [ ] Tag de release criada
- [ ] Deploy em produção executado
- [ ] Smoke tests pós-deploy realizados
- [ ] Comunicação de release enviada

### Se NO-GO:
- [ ] Itens bloqueadores documentados
- [ ] Plano de correção definido
- [ ] Nova data de Go/No-Go agendada
- [ ] Stakeholders notificados

---

## Evidências de Teste

### Screenshots/Requisições:

**1. Health Check:**
```bash
curl https://[SERVICE_URL]/health
```
Resultado esperado: `{"status":"online",...}`

**2. CORS Restrito:**
```bash
curl -H "Origin: https://evil.com" https://[SERVICE_URL]/api/dxf
```
Resultado esperado: Erro de CORS

**3. OIDC Webhook:**
```bash
curl -X POST https://[SERVICE_URL]/api/tasks/process-dxf -d '{}'
```
Resultado esperado: `401 Unauthorized`

**4. Geração DXF:**
```bash
curl -X POST https://[SERVICE_URL]/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat":-23.5505,"lon":-46.6333,"radius":500}'
```
Resultado esperado: `202 Accepted` com jobId

---

## Histórico de Versões

| Versão | Data | Decisão | Observações |
|--------|------|---------|-------------|
| v1.0.0 | | | Release inicial Sis RUA Unified |

