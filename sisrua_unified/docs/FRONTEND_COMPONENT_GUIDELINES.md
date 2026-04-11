# Frontend Component Guidelines

Este guia padroniza a evolução de componentes React para reduzir regressões visuais e inconsistências de tema.

## 1. Contrato de props

- Defina interfaces explícitas para props (evite any).
- Prefira nomes orientados a intenção: onSave, onClose, isLoading, hasError.
- Use callbacks opcionais somente quando o comportamento também for opcional.
- Para objetos grandes, prefira passar fatias mínimas de estado em vez do estado inteiro da tela.

## 2. Estado e derivação

- Mantenha estado local apenas para interação de UI (aberto/fechado, aba ativa, foco).
- Qualquer cálculo derivado de props deve usar useMemo quando impactar renderização.
- Callbacks passados para filhos devem usar useCallback quando o filho depende de identidade estável.
- Evite duplicar fonte de verdade entre estado local e props.

## 3. Tema e tokens visuais

- Não codifique cores de tema diretamente no componente para shell/layout principal.
- Reutilize classes semânticas baseadas em token (app-shell, app-header, app-sidebar, glass-*).
- Novos tokens devem ser adicionados centralmente em src/theme/tokens.ts e referenciados em src/index.css.
- Estados claro/escuro devem ser controlados por ThemeProvider (data-theme + CSS variables).

## 4. Acessibilidade mínima obrigatória

- Todo botão icônico deve ter aria-label.
- Campos de entrada devem ter label visível ou aria-label equivalente.
- Modais devem possuir foco claro no conteúdo e ação explícita de fechamento.
- Evite depender apenas de cor para sinalizar estado crítico/erro.

## 5. Fallback visual

- Componentes assíncronos devem exibir fallback de carregamento legível.
- Estados de erro devem mostrar mensagem objetiva e ação de recuperação.
- Estados vazios devem orientar o próximo passo do usuário.

## 6. Checklist de PR frontend

- Tema claro/escuro validado visualmente na tela alterada.
- Sem warnings novos de hooks relacionados ao componente.
- Build frontend aprovado (npm run build).
- Testes frontend do fluxo alterado aprovados (npm run test:frontend).
