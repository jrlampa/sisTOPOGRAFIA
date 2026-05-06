# Runbook SRE: Queda de Conexão de APIs

Objetivo: restaurar rapidamente integrações críticas quando APIs externas ficarem indisponíveis ou degradadas.

## 1) Detecção

- Alertas em `5xx_rate`, `timeout_rate` ou `p95_latency` acima do SLO.
- Sintomas no app: falha em geocodificação, elevação, IBGE/INDE, ou geração de análises.
- Verificar `/health` e logs de erro do backend.

## 2) Classificação de Severidade

- **SEV-1**: API crítica indisponível e sem fallback operacional.
- **SEV-2**: degradação com fallback ativo, impacto parcial.
- **SEV-3**: instabilidade intermitente sem impacto relevante no usuário final.

## 3) Ação Imediata (0-15 min)

1. Confirmar escopo (qual API e quais endpoints).
2. Ativar modo degradado/fallback suportado:
   - usar cache local quando disponível;
   - usar fonte secundária (quando existente);
   - limitar chamadas concorrentes para reduzir timeout em cascata.
3. Aplicar circuito de proteção:
   - reduzir `max retries`;
   - aumentar backoff exponencial;
   - evitar retry sem limite.
4. Publicar status interno do incidente (canal de operação).

## 4) Diagnóstico Técnico (15-45 min)

- Verificar:
  - DNS/TLS/Firewall/Proxy;
  - quota/rate-limit no provedor;
  - mudanças recentes de deploy/config;
  - latência de rede e códigos de resposta.
- Coletar evidências:
  - timestamp UTC;
  - request-id/correlation-id;
  - endpoint afetado;
  - amostra de logs.

## 5) Recuperação

1. Restaurar conectividade normal.
2. Reverter parâmetros temporários (timeouts/retries/circuit settings).
3. Validar smoke checks dos fluxos críticos.
4. Encerrar incidente após 30 min de estabilidade.

## 6) Pós-incidente (até D+1)

- Registrar RCA (causa raiz + ações corretivas).
- Atualizar limites/SLO/alertas, se necessário.
- Atualizar este runbook quando houver novo padrão de falha.

## 7) Checklist de Encerramento

- [ ] Incidente classificado e comunicado.
- [ ] Fallback aplicado e removido de forma segura.
- [ ] Evidências anexadas (logs + métricas + timeline).
- [ ] RCA documentado.
- [ ] Ações preventivas criadas no backlog.
