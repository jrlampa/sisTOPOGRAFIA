# CAC - Acessibilidade como Requisito Transversal (WCAG)

## Identificação

- Data: 2026-04-12
- Tipo: Governança de Qualidade (Frontend)
- Escopo: Aplicação web (fluxos críticos)
- Referência técnica atual: e2e/a11y-smoke.spec.ts
- Branch: dev

## Contexto

Existe infraestrutura inicial de acessibilidade (labels e smoke com Axe), porém a cobertura atual não demonstra, de forma ampla, conformidade por fluxo crítico, foco, navegação por teclado e consistência WCAG nos componentes de maior impacto.

## Causa Raiz

1. Verificação de a11y focada em smoke/raiz e regras pontuais.
2. Ausência de matriz transversal por fluxo crítico e estados de interação.
3. Falta de critério uniforme de aceite a11y para componentes críticos.

## Diretriz Aprovada

Acessibilidade passa a ser requisito transversal de produto:

1. Toda feature crítica deve possuir evidência de acessibilidade por fluxo.
2. Ações por teclado e foco visível tornam-se obrigatórias para controles interativos.
3. Conformidade WCAG 2.1 A/AA é referência padrão de implementação e revisão.

## Mudanças Documentais Aplicadas

1. Atualização do RAG (`RAG/MEMORY.md`) com a diretriz transversal e critério operacional.
2. Formalização desta CAC com critérios de aceite e plano de cobertura.

## Matriz de Cobertura Mínima (gate)

1. Fluxos críticos com teste Axe dedicado (não apenas rota raiz).
2. Navegação por teclado validada (Tab, Shift+Tab, Enter, Space, Esc quando aplicável).
3. Foco visível e ordem de foco coerente.
4. Controles com nome acessível (label/aria-label/aria-labelledby conforme contexto).
5. Ausência de violações Axe `serious`/`critical` nos fluxos críticos.

## Componentes/Fluxos Prioritários

1. Mapa e interações BT (edição, exclusão, confirmações críticas).
2. Sidebars e formulários de entrada de dados.
3. Modais críticos e ações destrutivas/sensíveis.
4. Upload/importação e feedback de erro/sucesso.

## Critério de Aceite

1. Cobertura de a11y expandida por fluxo crítico além do smoke inicial.
2. Zero violações `serious`/`critical` nos fluxos críticos cobertos.
3. Evidência de teclado/foco registrada na validação da entrega.

## Riscos Residuais

1. Componentes de terceiros (ex.: mapa Leaflet) podem exigir exceções controladas no Axe.
2. Mudanças visuais de tema podem gerar regressões de contraste.

## Mitigação

1. Revisão obrigatória de a11y em PR para componentes críticos.
2. Ampliação incremental da suíte E2E de acessibilidade por fluxo.
3. Registro explícito de exceções temporárias com plano de eliminação.

## Rollback

- Reverter o commit documental desta CAC no branch `dev`.
