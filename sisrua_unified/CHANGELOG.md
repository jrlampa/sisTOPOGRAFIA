# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-04-15

### Changed

- Regras Não Negociáveis atualizadas: `Supabase First` explicitado, limites de linhas revisados (Ideal 500 / Soft 750 / Hard Absoluto 1000), regra de **Versionamento único e propagado** adicionada
- CI `enforce-non-negotiables.mjs` atualizado: R2b valida paridade de versão entre `VERSION`, `package.json` e `metadata.json`; thresholds de linhas atualizados (750/1000)
- `RAG/MEMORY.md`, `RULES_ENFORCEMENT.md` e `STRATEGIC_ROADMAP_2026.md` propagados com as mesmas regras

## [1.1.0] - 2026-04-15

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
