# MELHORIAS SUGERIDAS

Data: 12 de Abril de 2026
Versao: 4.0
Status: Backlog consolidado — implementacoes verificadas + 60 sugestoes por area (Frontend, Backend, BD, Metricas, Conformidade, Supply Chain)

---

## Status das 10 Melhorias Originais (Batch 1)

Levantamento realizado diretamente no codigo-fonte em 12/04/2026.

| #   | Melhoria                         | Status       | Evidencia no codigo                                                        |
| --- | -------------------------------- | ------------ | -------------------------------------------------------------------------- |
| 1   | Cache inteligente OSM            | Implementado | `CACHE_TTL_MS` em config.ts, cache de DXF com TTL configuravel             |
| 2   | Logs estruturados com Winston    | Implementado | `server/utils/logger.ts`, winston com timestamp + JSON                     |
| 3   | Fila assincrona para geracao DXF | Implementado | Cloud Tasks via `jobStatusService.ts`, nao usa Bull/Redis                  |
| 4   | Validacao de entrada com Zod     | Parcial      | Zod em config.ts e validation.ts; nao uniforme em todas as rotas           |
| 5   | Rate limiting                    | Implementado | `server/middleware/rateLimiter.ts`, geral + especifico por endpoint        |
| 6   | Testes E2E                       | Parcial      | Playwright configurado (`playwright.config.ts`); cobertura incompleta      |
| 7   | PWA                              | Pendente     | Nenhuma configuracao de service worker ou manifest encontrada              |
| 8   | Analytics/monitoramento          | Parcial      | `requestId` em erros, metricas de job; sem painel/analytics de uso externo |
| 9   | Batch export (CSV → ZIP)         | Pendente     | Nenhuma rota de batch com upload CSV encontrada                            |
| 10  | Documentacao Swagger/OpenAPI     | Implementado | `server/swagger/`, `swagger-ui-express` ativo em `/api-docs`               |

---

---

## Proximas 60 Sugestoes — Batch 2 e Batch 3

### Frontend (10 sugestoes)

| #    | Sugestao                                                                        | Prioridade | Status                                                                                           |
| ---- | ------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| F-01 | Implementar debounce na busca de enderecos para reduzir chamadas de API         | Alta       | Parcial — debounce existe em coordenadas e autosave, mas a busca de endereco OSM ainda nao usa   |
| F-02 | Adicionar validacao visual em tempo real para coordenadas e campos obrigatorios | Alta       | Parcial — Zod em validation.ts, mas feedback visual inline nao uniforme                          |
| F-03 | Criar componente unico de modal de confirmacao para operacoes criticas          | Media      | Pendente — modais de confirmacao estao inline sem componente central reutilizavel                |
| F-04 | Implementar paginacao ou virtualizacao em listas grandes                        | Media      | Implementado — `usePagination` e `PaginationControls` ativos no historico BT                     |
| F-05 | Adicionar modo escuro com persistencia em localStorage                          | Alta       | Implementado — `ThemeProvider`, tema persistido via appState em localStorage                     |
| F-06 | Criar toasts padronizados para sucesso, erro, alerta e informacao               | Alta       | Implementado — `Toast`, `ToastType`, `showToast` em uso amplo                                    |
| F-07 | Implementar atalhos de teclado para acoes frequentes no mapa e editor           | Baixa      | Pendente — aria-labels presentes, mas atalhos de teclado nao foram implementados                 |
| F-08 | Adicionar carregamento com skeleton e indicador de progresso em exportacoes     | Media      | Parcial — `isDownloading`, `jobProgress` e `jobId` disponíveis; skeleton visual nao implementado |
| F-09 | Criar filtro de camadas com busca por nome e salvamento de preferencia          | Media      | Parcial — `FloatingLayerPanel` existe; busca por nome e persistencia nao confirmadas             |
| F-10 | Melhorar acessibilidade com navegacao por teclado e atributos aria              | Media      | Parcial — muitos aria-labels presentes; navegacao por teclado end-to-end nao coberta             |

### Backend (10 sugestoes)

| #    | Sugestao                                                                     | Prioridade | Status                                                                                         |
| ---- | ---------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| B-01 | Implementar rate limit por IP e por usuario para proteger endpoints criticos | Alta       | Implementado — `rateLimiter.ts` por IP com janelas configuráveis; por usuario nao implementado |
| B-02 | Adicionar fila assincrona para geracao DXF e tarefas de analise pesada       | Alta       | Implementado — Cloud Tasks; sem Bull/Redis                                                     |
| B-03 | Padronizar validacao de entrada com schema unico em todas as rotas           | Alta       | Parcial — Zod no config e rotas principais; rotas secundarias sem validacao uniforme           |
| B-04 | Implementar retry com backoff exponencial para chamadas externas             | Media      | Parcial — retry simples no pythonBridge; sem backoff exponencial                               |
| B-05 | Adicionar logs estruturados com correlacao por request id                    | Alta       | Implementado — winston JSON + requestId no errorHandler                                        |
| B-06 | Criar endpoint de health check detalhado por dependencia                     | Media      | Implementado — `/health` principal + sub-endpoints Firestore e Storage                         |
| B-07 | Implementar cache de respostas frequentes com TTL configuravel               | Alta       | Implementado — `CACHE_TTL_MS` via config; cache de DXF em memoria                              |
| B-08 | Padronizar paginacao, ordenacao e filtros nas rotas de listagem              | Media      | Parcial — orderBy em alguns servicos; sem padrao API uniforme                                  |
| B-09 | Adicionar compressao gzip para respostas grandes                             | Media      | Pendente — middleware de compressao nao encontrado                                             |
| B-10 | Implementar controle de permissao granular por perfil de usuario             | Alta       | Parcial — autorizacao de storage em rotas; RBAC formal nao implementado                        |

### Banco de dados (10 sugestoes)

| #    | Sugestao                                                                     | Prioridade | Status                                                                                    |
| ---- | ---------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| D-01 | Criar indices compostos para consultas mais frequentes por usuario e data    | Alta       | Parcial — indices em jobs, constants e bt_export_history; outras tabelas sem cobertura    |
| D-02 | Adicionar soft delete com coluna deleted_at em entidades de negocio          | Media      | Pendente — nenhuma migracao com deleted_at encontrada                                     |
| D-03 | Implementar tabela de auditoria para CREATE, UPDATE e DELETE                 | Alta       | Parcial — auditoria apenas em constants_catalog via trigger; demais tabelas sem cobertura |
| D-04 | Criar materialized views para relatorios de alto custo                       | Media      | Parcial — `005_constants_refresh_stats_views.sql` existe; outras areas sem views          |
| D-05 | Particionar tabelas historicas por periodo para manter performance           | Baixa      | Pendente — nenhuma particao encontrada nas migrations                                     |
| D-06 | Adicionar constraints de integridade referencial onde ainda estiver faltando | Alta       | Parcial — FK presentes em algumas tabelas; cobertura nao uniforme                         |
| D-07 | Criar rotina automatica de manutencao (vacuum/analyze) em horarios de baixa  | Media      | Pendente — nenhuma rotina agendada encontrada                                             |
| D-08 | Implementar estrategia de backup incremental com validacao de restore        | Alta       | Pendente — nenhum script ou documentacao de backup incremental                            |
| D-09 | Adicionar indice geoespacial para consultas por area e intersecao            | Alta       | Pendente — sem extensao PostGIS nem indices geoespaciais nas migrations                   |
| D-10 | Criar pipeline de sincronizacao incremental para dados OSM                   | Media      | Pendente — importacao OSM e-to-end e sem pipeline incremental                             |

---

### Metricas de Engenharia & Boas Praticas (10 sugestoes)

| #    | Sugestao                                                                                                                   | Prioridade | Status                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| M-01 | Coletar metricas DORA: Deployment Frequency, Lead Time for Changes, MTTR e Change Failure Rate                             | Alta       | Pendente — sem coleta ou painel de metricas DORA                                                            |
| M-02 | Definir SLO/SLI formais e error budget: disponibilidade >= 99.5%, geracao DXF p95 < 30s, taxa de falhas < 0.5%             | Alta       | Parcial — plano menciona SLO/SLI; sem definicao formal publicada e painel ativo                             |
| M-03 | Integrar analise estatica de qualidade: cobertura >= 80%, complexidade ciclomatica <= 10, debito tecnico mensurado         | Alta       | Parcial — cobertura por pytest/vitest; sem SonarQube ou equivalente integrado ao pipeline                   |
| M-04 | Definir performance budget: LCP < 2.5s, CLS < 0.1, INP < 200ms (Core Web Vitals) com medicao continua no CI              | Media      | Pendente — sem monitoramento de Core Web Vitals nem budget definido                                         |
| M-05 | Monitorar latencia de API por percentil: p50, p95, p99 por endpoint; alertar quando p95 ultrapassar o SLO definido         | Alta       | Parcial — requestId em logs; sem agregacao de latencia por percentil                                        |
| M-06 | Implementar rastreamento distribuido com correlation IDs propagados entre frontend, backend e py_engine                    | Media      | Parcial — requestId em erros; sem propagacao de trace entre camadas                                         |
| M-07 | Estabelecer alertas de confiabilidade: MTTD < 5 min, MTTR < 1h, MTBF > 30 dias, com escalation automatico                 | Alta       | Pendente — sem alertas automaticos nem politica de escalation definida                                      |
| M-08 | Medir metricas de pipeline CI/CD: tempo de build, tempo de teste, taxa de flakiness e frequencia de deploys                | Media      | Pendente — sem coleta de metricas de pipeline                                                               |
| M-09 | Monitorar KPIs de negocio: taxa de sucesso DXF, tempo medio de processamento, jobs por hora, taxa de reuso de cache        | Alta       | Parcial — status de jobs disponivel; sem agregacao de KPIs nem painel de acompanhamento                     |
| M-10 | Adotar supply chain security: SBOM (CycloneDX ou SPDX), auditoria de CVEs e politica formal de atualizacao de dependencias | Alta       | Parcial — requirements.txt e package.json atualizados; sem SBOM formal nem politica de CVE documentada      |

---

### Conformidade, LGPD & Etica (10 sugestoes)

| #    | Sugestao                                                                                                                                  | Prioridade | Status                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| C-01 | Implementar Privacy by Design (LGPD Art. 46): minimizacao de dados coletados e anonimizacao de coordenadas brutas em logs e cache         | Alta       | Pendente — logs incluem coordenadas brutas sem anonimizacao formal                                   |
| C-02 | Nomear Encarregado de Dados (DPO) e publicar canal de contato oficial conforme LGPD Art. 41                                               | Alta       | Pendente — sem referencia a DPO no projeto                                                           |
| C-03 | Elaborar Relatorio de Impacto a Protecao de Dados Pessoais (RIPD/DPIA) conforme LGPD Art. 38                                             | Alta       | Pendente — sem RIPD/DPIA produzido                                                                   |
| C-04 | Definir politica formal de retencao e descarte: logs (90 dias), DXF (180 dias), cache OSM (TTL 7 dias), dados de analise (1 ano)          | Alta       | Parcial — CACHE_TTL_MS definido; demais categorias sem politica formal documentada                   |
| C-05 | Implementar atendimento a direitos do titular: acesso, correcao, portabilidade e exclusao de dados (LGPD Arts. 18-22)                     | Alta       | Pendente — sem endpoints nem fluxo operacional para direitos do titular                              |
| C-06 | Criar procedimento de notificacao de incidentes de seguranca a ANPD e titulares (LGPD Art. 48) com prazo de comunicacao de ate 72h        | Alta       | Pendente — sem procedimento de notificacao formal                                                    |
| C-07 | Adotar codigo de etica baseado em ACM Code of Ethics (2018) e IEEE Code of Ethics: responsabilidade publica, privacidade, nao-maleficencia, honestidade e transparencia — adaptado por papel (engenheiro, operador, gestor) | Media      | Pendente — sem politica de etica formal no projeto                                    |
| C-08 | Garantir acessibilidade digital WCAG 2.1 Nivel AA conforme Lei Brasileira de Inclusao (LBI n. 13.146/2015) e ABNT NBR 17060               | Media      | Parcial — aria-labels presentes; auditoria WCAG 2.1 AA nao realizada                                |
| C-09 | Implementar consentimento explicito e rastreavel para uso de dados de localizacao do usuario (LGPD Art. 7, inciso I)                      | Alta       | Pendente — sem fluxo de consentimento implementado                                                   |
| C-10 | Realizar revisao periodica de seguranca baseada em OWASP Top 10 (2021) com reporte de conformidade semestral e registro de acoes          | Alta       | Parcial — SECURITY_CHECKLIST.md existe; sem processo de revisao periodica formal                     |

---

### Supply Chain, ERP & Lista de Materiais (10 sugestoes)

| #    | Sugestao                                                                                                                                  | Prioridade | Status                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| S-01 | Criar middleware de supply para normalizacao de itens (descricao canonica + atributos: bitola, material, isolacao, tensao, fabricante)  | Alta       | Pendente — nao existe camada unica de normalizacao de materiais                                                                  |
| S-02 | Implementar matching inteligente (NLP + regras deterministicas) para evitar divergencias de orcamento entre fornecedores                  | Alta       | Pendente — sem mecanismo de equivalencia semantica para descricoes tecnicas                                                      |
| S-03 | Construir base de equivalencia tecnica entre fabricantes (WEG, Schneider, Siemens) e distribuidores (Sonepar, Rexel)                    | Alta       | Pendente — sem catalogo de substitutos tecnicos                                                                                  |
| S-04 | Integrar indiretamente via ERP do cliente (TOTVS Protheus, SAP ERP, Omie), evitando acoplamento direto com fornecedor                    | Alta       | Pendente — sem conector ERP padrao                                                                                               |
| S-05 | Automatizar fluxo de procurement: requisicao de compra, envio de cotacao e controle de pedido                                            | Alta       | Pendente — fluxo manual sem orquestracao ponta-a-ponta                                                                           |
| S-06 | Definir estrategia hibrida de integracao: API do ERP quando disponivel; RPA quando nao houver API                                        | Media      | Pendente — sem fallback RPA formal                                                                                               |
| S-07 | Implementar ingestao e conciliacao de XML de NF-e (ponto critico Brasil), vinculando item fiscal ao item tecnico normalizado             | Alta       | Pendente — sem parser/conciliador de NF-e no pipeline                                                                            |
| S-08 | Criar motor de cotacao multi-fornecedor com score ponderado (preco, prazo, homologacao tecnica, historico de entrega, risco de ruptura)  | Media      | Pendente — sem engine de ranking de fornecedores                                                                                 |
| S-09 | Implementar governanca de catalogo (versionamento, aprovacao tecnica, trilha de auditoria e rollback)                                    | Media      | Pendente — sem processo de governanca para alteracoes de equivalencia                                                            |
| S-10 | Definir KPIs de supply chain: acuracia de matching >= 98%, lead time de compra, saving por substituicao, taxa de ruptura, OTIF          | Alta       | Pendente — sem metricas formais de suprimentos                                                                                   |

---

## Prioridades para Proxima Sprint

Alta prioridade imediata (P0):

1. F-01 — Debounce na busca de enderecos (complementar o que existe)
2. F-02 — Validacao visual inline em todos os campos obrigatorios
3. B-03 — Schema Zod uniforme em todas as rotas
4. B-04 — Retry com backoff exponencial nas chamadas externas
5. B-09 — Compressao gzip
6. D-03 — Auditoria de CREATE/UPDATE/DELETE nas tabelas de negocio
7. D-08 — Estrategia de backup incremental com validacao
8. D-09 — Indice geoespacial (PostGIS)
9. C-01 — Privacy by Design: anonimizacao de coordenadas em logs (LGPD Art. 46)
10. C-03 — RIPD/DPIA (LGPD Art. 38)
11. C-04 — Politica formal de retencao e descarte de dados
12. C-05 — Atendimento a direitos do titular (LGPD Arts. 18-22)
13. C-06 — Procedimento de notificacao a ANPD (LGPD Art. 48, 72h)
14. M-07 — Alertas de confiabilidade (MTTD/MTTR/MTBF)
15. M-09 — KPIs de negocio: taxa de sucesso DXF e reuso de cache
16. M-10 — SBOM formal e politica de gestao de CVEs
17. S-01 — Middleware de supply com normalizacao canonica de itens
18. S-02 — Matching inteligente NLP + regras tecnicas
19. S-04 — Integracao indireta via ERP do cliente (TOTVS/SAP/Omie)
20. S-05 — Automacao de requisicao, cotacao e controle de pedido
21. S-07 — Leitura e conciliacao de XML de NF-e
22. S-10 — KPIs de supply chain e metas operacionais

Media prioridade (P1):

1. F-03 — Componente global de confirmacao
2. F-08 — Skeleton visual em exportacoes
3. F-09 — Filtro de camadas com busca e persistencia
4. B-08 — Paginacao/ordenacao padronizada nas rotas
5. B-10 — RBAC por perfil de usuario
6. D-01 — Indices compostos em todas as tabelas de negocio
7. D-04 — Materialized views para relatorios
8. D-10 — Pipeline OSM incremental
9. C-02 — Nomear DPO e publicar canal de contato (LGPD Art. 41)
10. C-07 — Codigo de etica corporativo (ACM/IEEE adaptado)
11. C-09 — Consentimento explicito para dados de localizacao
12. C-10 — Revisao periodica OWASP Top 10 semestral
13. M-01 — Metricas DORA (Deployment Frequency, Lead Time, MTTR, CFR)
14. M-02 — SLO/SLI formais e error budget publicados
15. M-03 — Analise estatica de qualidade integrada ao pipeline
16. M-05 — Latencia de API por percentil (p50/p95/p99)
17. S-03 — Base de equivalencia tecnica WEG/Schneider/Siemens + distribuidores
18. S-06 — Estrategia hibrida API ERP + fallback RPA
19. S-08 — Motor de cotacao multi-fornecedor com score ponderado
20. S-09 — Governanca de catalogo com auditoria e rollback

Baixa prioridade / backlog (P2):

1. F-07 — Atalhos de teclado
2. F-10 — Acessibilidade end-to-end
3. D-02 — Soft delete
4. D-05 — Particionamento de tabelas historicas
5. D-07 — Rotina de vacuum/analyze
6. C-08 — Auditoria WCAG 2.1 AA (LBI n. 13.146/2015)
7. M-04 — Performance budget Core Web Vitals com medicao continua
8. M-06 — Rastreamento distribuido ponta-a-ponta
9. M-08 — Metricas de pipeline CI/CD automatizadas
