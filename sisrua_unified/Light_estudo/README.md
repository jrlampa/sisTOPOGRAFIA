# Light_estudo — Diretório canônico do workbook CQT

Este diretório é a **fonte oficial** dos workbooks de paridade CQT.

## Conteúdo esperado

Coloque aqui os workbooks de referência, e.g.:

```
Light_estudo/CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
Light_estudo/CQTsimplificado_REV0 - Copia - Copia.xlsx
```

Os arquivos **não são versionados** (ver `.gitignore`). Cada membro do time deve obtê-los
pela fonte oficial (Google Drive / SharePoint do projeto) e colocá-los neste diretório.

## Workbooks suportados

| Workbook | Constante TS | Cenários de paridade |
|----------|-------------|----------------------|
| `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx` | `CQT_BASELINE_TARGETS` | ESQ_ATUAL, LINEAR_SIMPLE, BIFURCATION, IDEMPOTENCY, TERMINAL_WITH_RAMAL, LARGE_NETWORK |
| `CQTsimplificado_REV0 - Copia - Copia.xlsx` | `CQT_REV0_BASELINE_TARGETS` | REV0_DB_INDICATORS, REV0_LINEAR, REV0_IDEMPOTENCY |

O workbook REV0 aplica os mesmos parâmetros de DB (transformador 225 kVA, Z%=3,5%,
DEM_ATUAL=101,956 kVA) e valida os indicadores DB!K6/K7/K8/K10 (QT_MTTR) com
os mesmos inputs do workbook de referência.

## Uso

| Script | Comportamento |
|--------|--------------|
| `npm run cqt:workbook-audit` | Audita `Light_estudo/*.xlsx` (ou variável `CQT_WORKBOOK_PATH`) |
| `npm run cqt:parity-check:strict` | Exige auditoria antes de validar paridade |
| `python scripts/audit_cqt_workbook.py` | Audita workbook padrão |
| `python scripts/audit_cqt_workbook.py --all` | Audita **todos** os `.xlsx` em `Light_estudo/` (inclui REV0) |
| `python scripts/audit_cqt_workbook.py --workbook "Light_estudo/CQTsimplificado_REV0 - Copia - Copia.xlsx"` | Audita apenas o workbook REV0 |

## Variável de ambiente

Defina `CQT_WORKBOOK_PATH` para sobrescrever o caminho padrão:

```env
CQT_WORKBOOK_PATH=Light_estudo/CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
```

Se a variável não for definida, o script busca automaticamente:
1. `Light_estudo/*.xlsx` (primeiro arquivo .xlsx encontrado em ordem alfabética)
2. `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx` (raiz do projeto — fallback legado)
