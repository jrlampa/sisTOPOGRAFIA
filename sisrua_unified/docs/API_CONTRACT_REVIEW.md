# Checklist de Revisão de Contratos de API

Qualquer mudança que altere o comportamento HTTP (status code, payload, headers) nos domínios de **Autenticação** e **Faturamento** deve seguir este checklist antes de ser aprovada.

## 📋 Checklist Obrigatório

- [ ] **Sincronização de Testes**: Se o status code ou o payload mudou, os testes em `server/tests/*Contract.test.ts` foram atualizados na mesma entrega?
- [ ] **Compatibilidade pt-BR**: O payload de erro contém obrigatoriamente o campo `erro` com mensagem em português?
- [ ] **Resiliência E2E**: A mudança foi validada localmente com `npm run test:e2e` para garantir que o frontend não quebrou?
- [ ] **Documentação**: O arquivo `docs/CONTRACTS.md` foi atualizado para refletir a nova realidade do endpoint?
- [ ] **Padrão de Auth**:
    - Sem credenciais: Retorna **401 Unauthorized**.
    - Com credenciais mas sem permissão: Retorna **403 Forbidden**.

## 🛑 O que NÃO fazer

- Alterar nomes de campos existentes sem manter retrocompatibilidade ou atualizar todos os consumidores.
- Remover o campo `erro` em favor apenas do `error` (violando o mandato do projeto).
- Introduzir dependências de UI (classes CSS) em mensagens de erro que o teste E2E precisa validar.

## 🚀 Como Validar Localmente

```bash
# Executar testes de contrato
npm run test:contract

# Executar testes E2E críticos
npm run test:e2e -- e2e/auth-login.spec.ts e2e/billing.spec.ts
```
