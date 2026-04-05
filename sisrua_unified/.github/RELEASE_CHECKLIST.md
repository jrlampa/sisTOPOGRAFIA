# Release Checklist - Sis RUA Unified

## Pre-Release Verification

### 1. Quality Gates (Automated - CI/CD)
- [ ] Backend tests passing (npm run test:backend)
- [ ] Frontend tests passing (npm run test:frontend)
- [ ] E2E smoke tests passing (npm run test:e2e -- --grep "@smoke")
- [ ] Lint clean (npm run lint)
- [ ] Type check passing (npx tsc --noEmit)
- [ ] Security audit clean (npm run security:audit)
- [ ] Build successful (npm run build)

### 2. Manual Verification
- [ ] Version updated in package.json (se necessário)
- [ ] CHANGELOG.md atualizado com mudanças
- [ ] Variáveis de ambiente verificadas:
  - [ ] CLOUD_RUN_SERVICE_URL
  - [ ] CLOUD_TASKS_OIDC_AUDIENCE
  - [ ] CORS_ORIGINS
  - [ ] GCP_PROJECT
  - [ ] GROQ_API_KEY (secret configurado)

### 3. Security Review
- [ ] CORS restrito em produção (não aceita `*`)
- [ ] Trust proxy habilitado
- [ ] Rate limiting ativo
- [ ] OIDC webhook autenticado
- [ ] Sem secrets hardcoded no código

### 4. Infrastructure
- [ ] Cloud Tasks queue existe
- [ ] Firestore habilitado
- [ ] Service Account com permissões corretas:
  - [ ] roles/cloudtasks.enqueuer
  - [ ] roles/run.invoker
- [ ] Container Registry acessível

### 5. Post-Deploy Verification
- [ ] Health check retorna 200 (`/health`)
- [ ] Endpoint de tasks retorna 401 sem token (OIDC funcionando)
- [ ] CORS bloqueia origens não autorizadas
- [ ] Geração DXF funciona end-to-end
- [ ] Jobs persistem no Firestore
- [ ] Rate limiting ativo

## Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| QA | | | |
| DevOps | | | |

## Release Notes Template

```markdown
## [Versão] - YYYY-MM-DD

### Added
- Feature X
- Feature Y

### Changed
- Improvement Z

### Fixed
- Bug W

### Security
- Security enhancement V
```

## Rollback Procedure

1. Identificar versão anterior estável no Container Registry
2. Executar deploy com imagem anterior:
   ```bash
   gcloud run deploy sisrua-app \
     --image gcr.io/PROJECT/sisrua-app:PREVIOUS_TAG \
     --region southamerica-east1
   ```
3. Verificar health check
4. Notificar stakeholders

## Emergency Contacts

- Tech Lead: [email/phone]
- DevOps: [email/phone]
- On-Call: [email/phone]
