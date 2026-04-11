# Light_estudo — Diretório canônico do workbook CQT

Este diretório é a **fonte oficial** do workbook de paridade CQT.

## Conteúdo esperado

Coloque aqui o workbook de referência, e.g.:

```
Light_estudo/CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
```

O arquivo **não é versionado** (ver `.gitignore`). Cada membro do time deve obtê-lo
pela fonte oficial (Google Drive / SharePoint do projeto) e colocá-lo neste diretório.

## Uso

| Script | Comportamento |
|--------|--------------|
| `npm run cqt:workbook-audit` | Audita `Light_estudo/*.xlsx` (ou variável `CQT_WORKBOOK_PATH`) |
| `npm run cqt:parity-check:strict` | Exige auditoria antes de validar paridade |
| `python scripts/audit_cqt_workbook.py` | Mesmo caminho padrão |

## Variável de ambiente

Defina `CQT_WORKBOOK_PATH` para sobrescrever o caminho padrão:

```env
CQT_WORKBOOK_PATH=Light_estudo/CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx
```

Se a variável não for definida, o script busca automaticamente:
1. `Light_estudo/*.xlsx` (primeiro arquivo .xlsx encontrado)
2. `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx` (raiz do projeto — fallback legado)
