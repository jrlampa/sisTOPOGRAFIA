# Checklist Normativo Executavel

Este checklist converte requisitos tecnicos em validacao automatica com evidencias obrigatorias por criterio.

## Criterios de Paridade

- [x] PAR01: Paridade CQT executada em modo estrito no CI.
- [x] PAR02: Contrato de release-smoke com snapshot validado no CI.
- [x] PAR03: SLO de snapshot (latencia/disponibilidade) com gate de bloqueio de release.

## Criterios de Rastreabilidade

- [x] RAST01: Correlacao operacional com operation_id, projeto_id e ponto_id no pipeline de request/log.
- [x] RAST02: Trilha exportavel para auditoria SIEM com endpoint dedicado.
- [x] RAST03: Flakiness de regressao tratada como confiabilidade via gate CI.
- [x] RAST04: Rollback operacional formalizado para contrato/auth/snapshot com gatilho claro.

## Regra de Bloqueio

- Divergencia entre checklist, politica e evidencias deve falhar CI.
- Qualquer item desmarcado deve falhar CI.
- Evidencia obrigatoria ausente por criterio deve falhar CI.
