# Audit Checklist Completo - 30 itens

## ✅ JÁ IMPLEMENTADO (10 itens)

| # | Item | Arquivo | Status | Prioridade | Commit |
|---|------|---------|--------|------------|--------|
| 2 | Verificação de Segurança em Downloads DXF | `server/index.ts:103-137` | ✅ | P0 | `bd3ce06` |
| 3 | Memory Leak em Polling DXF | `useDxfExport.ts:125-160` | ✅ | P0 | `bd3ce06` |
| 11 | Injeção de CSS via CDN sem Integridade | `MapSelector.tsx:38-50` | ✅ | P0 | `bd3ce06` |
| 19 | Zod Schema Não Utilizado no Frontend | `validation.ts` (novo) | ✅ | P1 | `bd3ce06` |
| 7 | ID de Ramal com Colisão | `useBtCrudHandlers.ts:735,901` | ✅ | P1 | `76c137d` |
| 5 | Dependências de Effect Incompletas | `useMapState.ts:107-127` | ✅ | P1 | `bd3ce06` |
| 12 | Estado de Loading Não Reseta em Erro | `useOsmEngine.ts:55-62` | ✅ | P1 | `76c137d` |
| 4 | Verificação de Integridade em Autosave | `useAutoSave.ts:37-52` | ✅ | P1 | `76c137d` |
| 24 | CORS Permissivo Demais | `server/index.ts:96-113` | ✅ | P1 | `76c137d` |
| 25 | Importação com @ts-ignore | `MapSelector.tsx:38-50` | ✅ | P0 | `bd3ce06` |

---

## 🔲 AINDA NÃO FEITO (20 itens)

### P1 - High Priority

| # | Item | Arquivo | Prioridade | Risco | Esforço |
|---|------|---------|------------|-------|---------|
| 1 | Mutabilidade do Estado Global | `App.tsx:381-384`, `useMapState.ts:68-104` | P1 | Médio: Re-renders desnecessários | Médio |
| 13 | Ausência de Debounce em Coordenadas | `App.tsx:750-764` | P1 | Médio: Spam de eventos | Baixo |
| 14 | Tipos `any` Não Justificados | `MapSelector.tsx:138-152` | P1 | Médio: Perda de type safety | Baixo |
| 15 | Lógica de Negócio Misturada com UI | `useBtCrudHandlers.ts` (1222 linhas) | P1 | Alto: Violação SRP | Alto |
| 16 | Constantes Mágicas Não Tipadas | `useBtCrudHandlers.ts:733` | P1 | Baixo: Manutenibilidade | Baixo |
| 17 | Risco de XSS em downloadBlob | `useBtCrudHandlers.ts:48-58` | P1 | Médio: Segurança | Médio |
| 18 | Tratamento de Erro Genérico | `server/index.ts:169-172` | P1 | Médio: Debugging difícil | Médio |

### P2 - Medium Priority

| # | Item | Arquivo | Prioridade | Risco | Esforço |
|---|------|---------|------------|-------|---------|
| 6 | Prop Drilling Excessivo | `App.tsx:1000-1030` | P2 | Médio: Acoplamento alto | Alto |
| 8 | Verificação de Tipo Runtime Insuficiente | `App.tsx:251-329` | P2 | Médio: Dados malformados | Médio |
| 9 | Cálculo de Distância sem Memoização | `useBtCrudHandlers.ts:134-151` | P2 | Baixo: Performance | Baixo |
| 10 | Validação de Entrada Numérica Inconsistente | `App.tsx:1077-1091` | P2 | Baixo: UX | Baixo |

### P3 - Low Priority

| # | Item | Arquivo | Prioridade | Risco | Esforço |
|---|------|---------|------------|-------|---------|
| 20 | Ausência de Feature Flags | CQT/BT topology | P3 | Baixo: Experimentação | Médio |
| 21 | Testes E2E Crasham com Frequência | `e2e/**` | P3 | Médio: CI/CD | Alto |
| 22 | Logger Expõe Stack Traces | `logger.ts` | P3 | Médio: Segurança | Baixo |
| 23 | Não há Paginação em Histórico BT | `App.tsx:548-560` | P3 | Baixo: Performance | Médio |
| 26 | Comentários em Português/Inglês Misturados | Toda codebase | P3 | Baixo: Consistência | Alto |
| 27 | Versão Hardcoded em Múltiplos Lugares | `server/config.ts:16`, `package.json:4` | P3 | Baixo: Manutenção | Baixo |
| 28 | Nomenclatura Inconsistente (Bt vs BT) | Toda codebase | P3 | Baixo: Consistência | Médio |
| 29 | Documentação Swagger Extensa | `server/swagger.ts` | P3 | Muito baixo: Estilo | Médio |
| 30 | Scripts de Build Duplicados | `package.json:11` | P3 | Baixo: CI/CD | Baixo |

---

## 🎯 PRÓXIMAS AÇÕES (Recomendadas)

### Batch 2 (P1 - Quick Wins)
1. **Item 16** (Constantes Mágicas) - 5 min - Criar arquivo `constants.ts`
2. **Item 14** (Remover `any` types) - 10 min - Mapear tipos em MapSelector
3. **Item 13** (Debounce coordenadas) - 15 min - Wired em `debounce.ts` (já criado)
4. **Item 1** (Mutabilidade) - 20 min - Adicionar Immer ou Object.freeze()

### Batch 3 (P1 - Medium Effort)
5. **Item 18** (Tratamento de Erro) - 25 min - Criar ErrorHandler centralizado
6. **Item 17** (XSS em downloadBlob) - 20 min - Validate filename + DOMPurify
7. **Item 8** (Runtime Type Check) - 30 min - Integrar Zod validation runtime

### Batch 4 (P1 - Heavy Refactoring)
8. **Item 15** (Refatorar useBtCrudHandlers) - 2-3h - Dividir em 3 hooks especializados

---

## Estatísticas
- **Total**: 30 itens
- **Concluído**: 10 (33%) ✅
- **Restante**: 20 (67%) 🔲
  - P1: 7 itens
  - P2: 4 itens  
  - P3: 9 itens
