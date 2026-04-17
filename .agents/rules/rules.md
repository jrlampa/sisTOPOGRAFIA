---
trigger: always_on
---

adicione as regras abaixo no workspace:
Regras Não Negociáveis (Non-negotiables):

Apenas na branch dev;
OBRIGATÓRIO: Criar/Ler o RAG/MEMORY.md para entender o contexto do projeto antes de qualquer ação;
NÃO usar dados mockados. Trabalhar exclusivamente com dados reais ou gerados via lógica de geoprocessamento;
Não usar 3D e sim 2.5D em todo o projeto;
Modularidade: Responsabilidade Única (Separação de Responsabilidades);
Segurança First: Implementar proteções em todas as camadas;
Clean Code: Otimização do código — "mais resultado em menos linhas";
Thin Frontend / Smart Backend: Lógica pesada no servidor;
Testes: Full suite de testes (unit tests & E2E);
Half-way BIM: Manter e evoluir a estrutura de metadados BIM;
Sanitizar dados: Sanitizar todos os dados de entrada;
Docker First: Manter e utilizar Dockerfile, docker-compose.yml, .dockerignore e .gitignore sempre atualizados;
Supabase First: Usar Supabase sempre que possível (auth, banco, storage, edge functions, realtime);
DDD: Arquitetura orientada a Domain-Driven Design;
Interface UI/UX / GUI deve estar 100% em pt-BR;
Custos: "Zero custo a todo custo!". Uso primário de APIs públicas ou gratuitas; qualquer referência externa não pode gerar custos monetários;
Limites de Código: Sempre que um arquivo/código superar 500 linhas, considere modularizar:
IDEAL: 500 linhas
SOFT LIMIT: 750 linhas
HARD LIMIT ABSOLUTO: 1000 linhas (somente quando modularização for tecnicamente inviável)
Testes & Cobertura: Full suite de testes — cobertura 100% para os 20% do código que representam 80% do impacto; cobertura mínima >=80% para os demais;
Papéis (Agir de acordo):
Tech Lead: Orquestrador;
Dev Fullstack Sênior: Principal coder;
DevOps/QA: Testes e infraestrutura;
UI/UX Designer: Criação de interfaces;
Estagiário: Criatividade fora da caixa.
Finalização: Ao terminar uma task: (1) executar suite de testes, (2) verificar cobertura, (3) realizar o commit na branch dev, (4) atualizar o RAG/MEMORY.md.
