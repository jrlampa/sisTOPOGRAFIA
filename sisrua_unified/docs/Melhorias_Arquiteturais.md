# Plano Estratégico de Melhorias e Implementações

Este documento consolida melhorias arquiteturais e de produto para o SIS RUA Unified, partindo de um princípio importante: a plataforma não "mistura" capacidades; ela **integra** análise topográfica, geração DXF, cálculo BT/CQT, edição operacional e dados geoespaciais em um fluxo técnico único.

O objetivo das propostas abaixo é aumentar três ganhos ao mesmo tempo:

1. **Valor percebido pelo usuário final**
2. **Escalabilidade técnica e operacional**
3. **Clareza de posicionamento do produto como plataforma integrada de engenharia**

---

## Direção Central

Antes de detalhar frontend, backend e banco, vale registrar a direção arquitetural desejada:

1. **Fluxo unificado de estudo técnico:** entrada da área, análise, edição, validação, geração de artefatos, histórico e relatório final devem operar como partes do mesmo processo, e não como módulos percebidos como independentes.
2. **Produto orientado a projetos:** o sistema deve evoluir de ferramenta operacional para plataforma de projetos de engenharia, com contexto persistente, versionamento, auditoria e rastreabilidade.
3. **Thin Frontend / Smart Backend:** manter a interface reativa e clara, enquanto regras, cálculos, consistência e orquestração pesada ficam concentrados no backend e engines especializadas.
4. **Arquitetura voltada à previsibilidade:** jobs longos, filas, validações e históricos precisam ser transparentes para o usuário, com status persistente e recuperação confiável.
5. **Saída técnica + saída executiva:** além do DXF e dos cálculos, o sistema deve produzir síntese operacional e documentação que ajudem tomada de decisão.

---

## 1. Área: Frontend (Interface, UX/UI e Experiência do Operador)

Foco em manter a aplicação leve, com interface integralmente coerente com o **locale ativo**, forte orientação a fluxos reais de operação técnica e menor carga cognitiva para o usuário.

1. **Consolidar o frontend como orquestrador de fluxo:** a interface deve evidenciar que análise topográfica, BT/CQT, DXF e camadas geoespaciais fazem parte do mesmo estudo técnico, com etapas claras e encadeadas.
2. **Evoluir para uma experiência orientada a projetos:** introduzir fluxos de abertura, retomada e duplicação de estudos, com contexto persistente por projeto, ao invés de depender apenas do estado local da sessão.
3. **Templates por caso de uso:** oferecer modelos como `estudo BT`, `clandestino`, `ramais`, `análise topográfica preliminar` e `exportação DXF`, reduzindo fricção inicial e padronizando entrada.
4. **Onboarding guiado e modo demonstrativo:** incluir exemplo carregado, checklist inicial, instruções contextuais e mensagens de validação mais pedagógicas para acelerar adoção por novos usuários.
5. **Code splitting e lazy loading:** particionar módulos densos de mapa, edição e visualizações avançadas para reduzir tempo de carga inicial e melhorar responsividade.
6. **Refatoração por limite de complexidade:** quebrar componentes e telas extensas em microcomponentes e hooks especializados, especialmente áreas críticas da edição BT e do shell principal da aplicação.
7. **Substituir polling por SSE ou WebSockets nos jobs longos:** geração de DXF e processamentos assíncronos devem refletir progresso em tempo real, com feedback contínuo e menor ruído de rede.
8. **Fila visível e previsível para o operador:** exibir status de job, etapa atual, reprocessamento, recuperação de erro e histórico recente com linguagem operacional clara.
9. **PWA resiliente e local-first quando fizer sentido:** preservar preferências, contexto de edição e artefatos leves para reduzir impacto de instabilidade de conectividade.
10. **Design system operacional em pt-BR:** consolidar modais, formulários, feedbacks, banners, toasts e estados vazios em um catálogo consistente, preferencialmente com Storybook.
11. **Validações cada vez mais preventivas:** mover o máximo possível da descoberta de erro para antes do processamento pesado, com feedback inline, mensagens de causa e próxima ação recomendada.
12. **Acessibilidade e legibilidade cartográfica:** revisar contraste, hierarquia visual, foco de teclado e leitura de camadas GIS para reduzir fadiga de uso em rotinas longas.

---

## 2. Área: Backend (Core, Regras, Orquestração e APIs)

Foco na construção de um **Smart Backend** que concentre domínio, consistência e integração entre motores técnicos, sem fragmentar a experiência do usuário.

1. **Consolidação explícita do domínio integrado:** tratar topografia, BT/CQT, DXF, histórico e relatórios como partes de um mesmo domínio de estudo técnico, e não como serviços isolados sem linguagem comum.
2. **Adoção progressiva de DDD:** organizar camadas de Domínio, Aplicação, Infraestrutura e Apresentação, isolando regra de negócio de adaptadores externos e detalhes de transporte.
3. **Backend orientado a projetos e estudos:** criar agregados e serviços de aplicação para `Projeto`, `Estudo`, `Execução`, `Artefato`, `Relatório` e `Histórico`, facilitando rastreabilidade e governança.
4. **Persistência real de jobs e status:** remover dependências de estado em memória para status críticos, permitindo retomada após reinício, auditoria de execução e visão histórica confiável.
5. **Arquitetura de processamento assíncrono previsível:** jobs de DXF, análises pesadas e auditorias devem ser tratados como primeira classe, com fila, retries, cancelamento e eventos de progresso.
6. **Docker-first para o motor técnico:** manter empacotamento reprodutível do stack Node + Python + dependências específicas, reduzindo variabilidade entre desenvolvimento, validação e produção.
7. **Testes headless dos artefatos técnicos:** validar estruturalmente DXFs, outputs de cálculo e consistência geométrica por rotinas automatizadas que reduzam retrabalho humano.
8. **Garantia geométrica 2.5D e contratos de domínio:** formalizar invariantes do domínio para impedir deriva semântica entre interface, backend e engine Python.
9. **Fallbacks para fontes públicas de dados geoespaciais:** orquestrar provedores como IBGE, INDE e fontes abertas de elevação com circuit breakers, cache e priorização por qualidade/disponibilidade.
10. **Motor híbrido de auditoria e trilha operacional:** registrar mudanças relevantes, execuções críticas, exportações e decisões de processamento de modo auditável e consultável.
11. **APIs voltadas a resultado de negócio:** além de endpoints técnicos isolados, expor contratos que representem jornadas completas, como criar estudo, executar análise, gerar artefato e publicar relatório.
12. **Observabilidade orientada a produto:** medir tempo até primeiro resultado, taxa de falha por etapa, abandono de fluxo, retrabalho e tempo médio de geração por tipo de estudo.
13. **Refatoração dos controladores para orquestração leve:** manter controllers finos, com validação de borda e delegação para serviços coesos, reduzindo acoplamento e risco de regressão.
14. **RAG e LLM apenas como apoio operacional:** se utilizados, devem servir a documentação, diagnóstico e recuperação de contexto, sem competir com o núcleo determinístico do domínio.

---

## 3. Área: Banco de Dados (Persistência, Performance e Governança)

Construção de uma camada íntegra, segura e preparada para sustentar uma plataforma de engenharia com histórico, auditoria e artefatos versionados.

1. **Modelo orientado a projeto e estudo:** persistir entidades que representem cliente, projeto, estudo, execução, artefato gerado, relatório e histórico de revisão.
2. **Persistência auditável de jobs e exportações:** registrar enfileiramento, progresso, conclusão, falhas e reprocessamentos para DXF e demais rotinas assíncronas.
3. **Indexação espacial nativa e eficiente:** evoluir para PostGIS com índices espaciais adequados, viabilizando consultas geográficas de alta performance e menor custo computacional.
4. **Separação entre dado transacional e dado técnico semi-estruturado:** usar modelo relacional para entidades centrais e JSONB quando houver ganho real para atributos variáveis de engenharia.
5. **Versionamento de estudos e snapshots:** suportar histórico de alterações relevantes, comparação entre versões e reprodutibilidade de resultados técnicos.
6. **Transações e atomicidade em fluxos críticos:** garantir consistência em operações que envolvam múltiplas escritas, como geração de estudo, atualização de topologia e publicação de artefatos.
7. **Criptografia e anonimização:** proteger dados sensíveis de usuário, operação e cliente tanto em repouso quanto em dumps de teste e ambientes auxiliares.
8. **Políticas de retenção e limpeza:** expurgar temporários, artefatos órfãos, logs transitórios e resíduos de execuções expiradas sem comprometer rastreabilidade relevante.
9. **Gestão de conexões e pool tuning:** preparar a persistência para execução conteinerizada e workloads assíncronos sem exaustão de conexões.
10. **Estratégia sólida de migrations:** manter evolução de schema versionada, revisável e reproduzível, com validação automatizada em CI.
11. **Read models e CQRS light onde houver ganho real:** separar consultas analíticas e históricos volumosos de operações transacionais críticas, sem complexidade desnecessária.
12. **Testes de integração com banco efêmero:** validar constraints, índices, concorrência e compatibilidade de migrations antes de promover mudanças.

---

## 4. Melhorias de Produto com Impacto Arquitetural

Estas melhorias não são apenas de UX ou negócio; elas têm implicações diretas na arquitetura e ajudam a transformar a base atual em um SaaS mais forte.

1. **Projetos, equipes e permissões:** suportar multiusuário real com papéis, trilhas por usuário e governança de acesso por projeto.
2. **Histórico operacional consultável:** permitir retomada de estudos, comparação de resultados, reabertura e reprocessamento com contexto preservado.
3. **Relatório final além do DXF:** gerar também saída executiva e técnica com resumo, inconsistências, métricas, mapa e anexos.
4. **Templates e padronização por cliente ou operação:** viabilizar presets de parâmetros, layout, regras e exportações por cenário de uso.
5. **Catálogo de artefatos e versões:** reunir DXFs, relatórios, planilhas e snapshots técnicos dentro do mesmo contexto do estudo.
6. **Métricas de adoção e eficiência:** acompanhar tempo de execução, volume processado, erros evitados por validação e taxa de reaproveitamento de templates.
7. **Integrações externas pragmáticas:** evoluir APIs e importações para planilhas, sistemas corporativos, CAD/GIS e fluxos internos da operação.

---

## 5. Priorização Recomendada

Para maximizar impacto sem dispersar esforço, a sequência recomendada é:

1. **Persistência de projetos, estudos e jobs**
2. **Fluxo unificado com templates por caso de uso**
3. **Status em tempo real e histórico confiável de execução**
4. **Relatórios finais e catálogo de artefatos**
5. **Refatoração progressiva de frontend e backend para reduzir acoplamento**
6. **Evolução da base de dados para modelo orientado a projeto + geoespacial robusto**
7. **Colaboração multiusuário, permissões e integrações externas**

---

## Resultado Esperado

Com essa evolução, o SIS RUA Unified deixa de ser percebido apenas como conjunto de ferramentas técnicas e passa a se posicionar de forma mais clara como:

- **plataforma integrada de estudos de engenharia**
- **sistema auditável e reproduzível para operação técnica**
- **ambiente de geração de artefatos com contexto, histórico e governança**
- **SaaS especializado com diferencial na integração entre análise, cálculo, geoespacial e entrega final**
