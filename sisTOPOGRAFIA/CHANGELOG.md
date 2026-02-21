# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-21

### Changed
- **Zeragem de versionamento**: versão redefinida para `0.1.0` como baseline pré-release
- Corrigidas inconsistências críticas de versão em todo o projeto:
  - `server/swagger.ts`: `1.2.0` → `0.1.0`
  - `server/interfaces/routes/systemRoutes.ts`: `1.2.0` → `0.1.0` (3 ocorrências)
  - `server/index.ts`: `1.2.0` → `0.1.0`
  - `server/tests/api.test.ts`: expectativas atualizadas de `1.2.0` → `0.1.0`
  - `tests/hooks/useFileOperations.test.ts`: fixture corrigida de `3.0.0` → `0.1.0`
- Script `scripts/update-version.sh` ampliado: agora cobre `server/swagger.ts`, `server/interfaces/routes/systemRoutes.ts` e `server/index.ts`
- Script `scripts/check-version.sh` ampliado: agora verifica `server/swagger.ts` e `server/interfaces/routes/systemRoutes.ts`

### Added
- **FASE 22 — Input Validation Hardening**: `analyzePadSchema` Zod adicionado em `server/schemas/apiSchemas.ts`
- Rota `POST /api/analyze-pad` usa Zod (`analyzePadSchema`) em vez de checagem manual
- 30 novos testes unitários de schemas em `server/tests/apiSchemas.test.ts` (191 Node.js total)
- Bug fix em `py_engine/scripts/verify_abnt_standards.py`: layer intermediária corrigida de `sisTOPO_CURVAS_NIVEL_INTERM` para `sisTOPO_TOPOGRAFIA_CURVAS`

---

