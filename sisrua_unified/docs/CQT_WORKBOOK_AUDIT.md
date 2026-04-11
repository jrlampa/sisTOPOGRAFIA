# CQT Workbook Audit

This project now includes a structural audit for CQT workbooks to detect hidden technical risks before updating parity baselines.

## Why

The audit focuses on risks that can silently break parity:

- formulas with literal `#REF!`
- cached Excel errors (`#REF!`, `#DIV/0!`, `#VALUE!`, etc.)
- formulas linked to external workbooks
- visible formulas depending on hidden columns

## Commands

- Generate JSON report using the default workbook:

```bash
npm run cqt:workbook-audit
```

- Fail in CI when critical structural flags are detected:

```bash
npm run cqt:workbook-audit:check
```

- Run parity-check with workbook audit precondition (single quality gate):

```bash
npm run cqt:parity-check:strict
```

- Audit a specific workbook path:

```bash
python scripts/audit_cqt_workbook.py --workbook "C:/path/to/workbook.xlsm" --stdout
```

- Use strict parity-check with a specific workbook path:

```bash
tsx scripts/generate-cqt-parity-report.ts --check --require-workbook-audit --workbook "C:/path/to/workbook.xlsm"
```

## Output

Default report path:

- `docs/CQT_WORKBOOK_AUDIT.json`

Main sections:

- `summary`: global counts (formulas, hidden rows/cols, errors, external refs)
- `risk`: risk level, score, critical/warning flags, check failure status
- `recommendations`: actionable mitigations
- `sheets`: per-sheet structural stats
- `samples`: concrete formula/error samples for quick triage

## Check Rule

`--check` returns non-zero when critical flags are present:

- `formula_ref_literal`
- `cached_ref_errors`

Warnings still appear in the JSON but do not fail by themselves.
