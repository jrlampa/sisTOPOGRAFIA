# sisRUA Unified — Regras de Produção (Fase 1)

### Roadmap 2026: Fase de Produção (Q2 2026)

1.  **Estabilização & Produção (Prioridade Máxima — Tech Lead Evaluation April 2026)**:
    *   **P1.1 Persistência de Jobs**: Migrar de `in-memory` para `Supabase/Postgres` via `USE_SUPABASE_JOBS=true`. **Não lançar sem persistência.**
    *   **P1.2 Error Taxonomy**: Implementar Error Handler Global com códigos de erro padronizados (`ErrorCode`).
    *   **P1.3 Validação de Input**: Adicionar `express-validator` em todos os endpoints de escrita (POST/PUT/PATCH).
    *   **P1.4 Graceful Shutdown**: Implementar handlers de `SIGTERM` para drenagem de fila e fechamento limpo de conexões.
    *   **P1.5 Observabilidade**: Adicionar Correlation IDs em todos os logs (Node.js e Python) para rastreabilidade fim-a-fim.

---

### Regras Não Negociáveis (Non-negotiables)

*   **Apenas na branch dev**; commits diretos em `master` são proibidos.
*   **OBRIGATÓRIO**: Criar/Ler o `RAG/MEMORY.md` + `CAC.md` + `TECH_LEAD_INDEX.md` antes de qualquer ação.
*   **NÃO usar dados mockados** em produção.
*   **Modularidade (SRP)**: Arquivos > 500 linhas devem ser considerados para refatoração.
*   **Segurança First**: Sanitização obrigatória via Zod/express-validator.
*   **Supabase First**: Usar Supabase para persistência de jobs e banco de dados.
*   **SIGTERM Ready**: Sinais de encerramento devem ser tratados (drenagem de 25s).
*   **Logging Estruturado**: JSON logs com `request_id`.
*   **Finalização**: (1) Testes, (2) Cobertura, (3) Commit dev, (4) Atualizar RAG.
