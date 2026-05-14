# Operational Runbook — sisTOPOGRAFIA

## 🚨 Resposta a Incidentes P0/P1

### 1. Sistema Indisponível (500 ou Timeout)
- **Verificar:** Logs do Cloud Run / Docker.
- **Causa comum:** Conexão com Supabase ou Redis atingiu o limite de pool.
- **Ação:** `docker compose restart app redis`. Se persistir, verificar status do Supabase.

### 2. Falha na Geração de DXF
- **Logs:** `grep "[pythonBridge] Error" logs/app.log`.
- **Ação:** Limpar cache local `rm -rf py_engine/cache/*`. Verificar se o motor Python está respondendo via `npm run test:backend`.

### 3. Erro no Webhook Stripe
- **Sintoma:** Assinaturas não atualizam após pagamento.
- **Verificar:** `STRIPE_WEBHOOK_SECRET` no environment.
- **Ação:** Usar Stripe CLI para re-enviar eventos: `stripe events resend <id>`.

## 🛠️ Procedimentos de Manutenção

### Backup do Banco de Dados
- Executado automaticamente via Supabase.
- Manual: `supabase db dump`.

### Rotação de Segredos
- Ver `docs/SECRET_ROTATION_GUIDE.md`.

### Limpeza de Cache (Redis)
- Manual: `redis-cli flushall`.

## 📈 Monitoramento
- **Métricas:** Disponíveis em `/metrics` (formato Prometheus).
- **Dashboard Admin:** `/api/admin/saude` e página de Status no frontend.
