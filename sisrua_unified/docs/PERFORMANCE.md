# Performance & Load Testing Baseline

Este documento descreve o baseline de performance da plataforma sisTOPOGRAFIA.

## 🚀 Baseline Atual (2026-05-14)

Os testes foram executados utilizando o script `npm run test:load` (autocannon).

### Métricas Alvo
- **Requests/sec:** ≥ 100 req/s (em endpoints leves como `/api/admin/saude`).
- **Latência P99:** ≤ 500ms.
- **Taxa de Erro:** 0% sob carga nominal.

## 🛠️ Como executar o teste

1.  Certifique-se de que o servidor está rodando: `npm run server`.
2.  Execute o baseline:
    ```bash
    npm run test:load
    ```

## 📈 Histórico de Resultados

| Data | Req/sec | Latência Avg | P99 | Erros |
| :--- | :--- | :--- | :--- | :--- |
| 2026-05-14 | 125.4 | 45ms | 180ms | 0 |

## ⚠️ Gargalos Conhecidos

- **Geração de DXF:** Operação CPU-bound bloqueante no worker Python. Requer monitoramento de fila (`jobs`).
- **CQT Complexo:** Topologias com > 200 postes podem elevar a latência de cálculo para > 2s.
