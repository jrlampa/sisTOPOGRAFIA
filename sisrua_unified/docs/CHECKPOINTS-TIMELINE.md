# CHECKPOINTS & TIMELINE

Este arquivo define os gates obrigatorios para merge em PR. Ele substitui acordo textual por validacao automatica no CI.

## Must Have (Merge Blockers)

- [x] MH01: Backend tests obrigatorios no CI
- [x] MH02: Frontend tests obrigatorios no CI
- [x] MH03: Lint e type check obrigatorios no CI
- [x] MH04: Security audit/SBOM obrigatorio no CI
- [x] MH05: Build verification obrigatorio no CI
- [x] MH06: Parity P0 obrigatoria no CI
- [x] MH07: E2E smoke obrigatorio no CI
- [x] MH08: Quality gate agregador obrigatorio no CI

## Criterios D+5 (Obrigatorios)

- [x] D501: Cada criterio D+5 deve mapear para job real do workflow
- [x] D502: Cada job D+5 deve estar no needs do gate agregador
- [x] D503: Divergencia entre checklist e workflow deve falhar o CI
- [x] D504: Itens desmarcados no checklist devem falhar o CI

## Criterios D+7 (Go Parcial Final com Evidencia Unica)

- [x] D701: Decisao final D+7 (GO_PARCIAL/NO_GO) deve existir em artefato unico versionado
- [x] D702: Artefato unico D+7 deve conter links de execucao e resultados de testes obrigatorios
- [x] D703: Artefato unico D+7 deve conter status de risco residual e plano de monitoramento
- [x] D704: Artefato unico D+7 deve conter assinatura nominal dos owners (Tech Lead, QA, DevOps)

## Timeline

- D+0: Definicao dos checkpoints
- D+1: Implementacao dos jobs
- D+2: Acoplamento ao gate agregador
- D+3: Validacao cruzada checklist x workflow
- D+4: Ajustes de estabilidade
- D+5: Gate obrigatorio em PR para dev/master/main
- D+7: Emissao obrigatoria de decisao final GO parcial via artefato unico validado em CI
