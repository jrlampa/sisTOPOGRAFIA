# CQT Parity Report

## Summary

| Metric | Value |
| --- | ---: |
| Scenarios | 3 |
| Complete | 3 |
| Partial | 0 |
| Missing | 0 |
| Compared Cells | 11 |
| Passed Cells | 11 |
| Failed Cells | 0 |

## Scenario: atual

- Reference status: complete
- Reference cells: 7
- Compared: 7
- Passed: 7
- Failed: 0

| Cell | State | Expected | Actual | Abs Diff | Within Tolerance |
| --- | :---: | --- | --- | ---: | :---: |
| RAMAL!AA30 | value | 2.84 | 2.84 | 0 | YES |
| GERAL!P31 | value | 118.69775108855391 | 118.69775108855391 | 0 | YES |
| GERAL!P32 | value | 117.04688712724072 | 117.04688712724072 | 0 | YES |
| DB!K6 | value | 225 | 225 | 0 | YES |
| DB!K7 | value | 101.95599999999999 | 101.95599999999999 | 0 | YES |
| DB!K8 | value | 0.015859822222222222 | 0.015859822222222222 | 0 | YES |
| DB!K10 | value | 0.03415982222222222 | 0.03415982222222222 | 0 | YES |

Critical lineage:
- RAMAL!AA30: RAMAL!AA24 -> RAMAL!X18:X77 -> GERAL!I2 -> DB/lookup reference inputs
- GERAL!P31: GERAL!O31 -> GERAL!C (PONTO) -> ESQ ATUAL table -> DB!K10 (QT_MTTR)
- GERAL!P32: GERAL!O32 -> GERAL!C (PONTO) -> DIR ATUAL table -> DB!K10 (QT_MTTR)
- DB!K6: DB!K6 direct input (TR_ATUAL)
- DB!K7: DB!K7 direct input (DEM_ATUAL)
- DB!K8: DB!K7 -> DB!K6 -> TRAFOS_Z lookup
- DB!K10: DB!K8 -> QT_MT base

## Scenario: proj1

- Reference status: complete
- Reference cells: 2
- Compared: 2
- Passed: 2
- Failed: 0

| Cell | State | Expected | Actual | Abs Diff | Within Tolerance |
| --- | :---: | --- | --- | ---: | :---: |
| GERAL PROJ!P31 | value | 120.83736598928087 | 120.83736598928087 | 0 | YES |
| GERAL PROJ!P32 | value | 120.72752247511889 | 120.72752247511889 | 0 | YES |

Critical lineage:
- GERAL PROJ!P31: GERAL PROJ!O31 -> GERAL PROJ!C (PONTO) -> ESQ PROJ1 table -> DB!K19 (QT_MTTR2)
- GERAL PROJ!P32: GERAL PROJ!O32 -> GERAL PROJ!C (PONTO) -> DIR PROJ1 table -> DB!K19 (QT_MTTR2)

## Scenario: proj2

- Reference status: complete
- Reference cells: 2
- Compared: 2
- Passed: 2
- Failed: 0

| Cell | State | Expected | Actual | Abs Diff | Within Tolerance |
| --- | :---: | --- | --- | ---: | :---: |
| GERAL PROJ2!P31 | value | 118.38572483277098 | 118.38572483277098 | 0 | YES |
| GERAL PROJ2!P32 | value | 118.38572483277098 | 118.38572483277098 | 0 | YES |

Critical lineage:
- GERAL PROJ2!P31: GERAL PROJ2!O31 -> GERAL PROJ2!C (PONTO) -> ESQ PROJ2 table -> DB!K26 (QT_MTTR3)
- GERAL PROJ2!P32: GERAL PROJ2!O32 -> GERAL PROJ2!C (PONTO) -> DIR PROJ2 table -> DB!K26 (QT_MTTR3)
