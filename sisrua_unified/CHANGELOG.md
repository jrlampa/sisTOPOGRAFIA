# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-04-15 (Beta Maduro)

### Status
- **Release Type**: Beta (Preview em produção)
- **Production Ready**: Não — core funcional, muitos erros em outras áreas
- **Core Feature (DXF Generation)**: ✓ Funcional
- **Target**: v1.0.0 quando Tier 1 (Enterprise Go-Live) estiver completo

### Added

- Regras Não Negociáveis formalizadas e propagadas em todo projeto
- CI `enforce-non-negotiables.mjs` com 9 regras de enforcement (R1-R9 + R2b)
- Versionamento único sincronizado entre `VERSION`, `package.json`, `py_engine/constants.py`, `src/hooks/useFileOperations.ts`, `metadata.json`
- Validação automática R2b: garante paridade de versão entre artefatos

### Changed

- Limites de código revisados: Ideal 500 / Soft 750 / Hard Absoluto 1000 linhas (refatoração de 3 componentes pendente)
- Supabase First explicitado como princípio de design
- Versionamento: 1.0.0 (baseline) → 0.9.0 (beta real, reflete estado em preview/teste)

## [1.0.0] - 2026-02-18 (Baseline)

### Added

- Gate de enforcement das regras não negociáveis no CI
- Script `ci:non-negotiables` para validar branch, limites de linhas, 2.5D, mocks, APIs pagas e arquivos Docker/ignore
- Auditoria e correção da política de CORS em produção sem wildcard `*`

### Changed

- Estratégia de fila alinhada ao backend real: Supabase/Postgres como backend primário de jobs
- Regra de otimização formalizada como "mais resultado em menos linhas", com soft limit de 500 linhas e hard limit de 600
- Versionamento sincronizado entre `package.json` e `VERSION`

### Fixed

- Correção de tipagem SQL em `btExportHistoryRepository.ts` para compatibilidade com o driver postgres
- Correção de serialização JSONB em `cloudTasksService.ts`, removendo erros TypeScript pré-existentes
- Remoção de drift no deploy para evitar provisionamento indevido de Cloud Tasks quando o runtime usa Supabase/Postgres

## [1.0.0] - 2026-02-18

### Added

- Centralização do versionamento do projeto
- Arquivo VERSION como fonte única de verdade para a versão
- CHANGELOG.md para rastreamento de mudanças
- Script de atualização automática de versão
- Integração de versão entre frontend, backend e Python engine

### Changed

- Unificação de versões inconsistentes (package.json: 1.0.0, constants.py: 1.5, useFileOperations.ts: 3.0.0)
- Versão padronizada para 1.0.0 como baseline para versionamento semântico

### Fixed

- Inconsistências de versionamento em múltiplos arquivos do projeto
