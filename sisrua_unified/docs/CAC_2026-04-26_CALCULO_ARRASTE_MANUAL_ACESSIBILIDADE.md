# CAC - Cálculo de Arraste Manual (Acessibilidade)

**Data:** 2026-04-26  
**Status:** Implementado e Validado  
**Contexto:** Injeção automática de custos de arraste manual de equipamentos em áreas sem acesso veicular, conforme normas da Light S.A.

## 1. Arquitetura Técnica
A solução foi integrada ao fluxo de cálculo radial BT, garantindo que todo projeto que envolva áreas de restrição veicular receba a imputação de custos correta.

### Componentes:
- **`btAccessibilityTypes.ts`**: Definição de pesos de equipamentos (Trafos de 15 a 150kVA, Postes de 300 a 1000 daN) e fator de custo de arraste manual.
- **`btAccessibilityService.ts`**: Processador que identifica nós com `hasVehicleAccess: false` e calcula o custo baseado na distância informada e no peso do equipamento.
- **Integração**: Acoplado ao `btRadialCalculationService.ts`, retornando os resultados no campo `accessibilityResults`.

## 2. Regras de Negócio (Light S.A.)
- **Fórmula de Custo:** $Custo = Peso_{kg} \times Distancia_{m} \times Fator_{Baremo}$.
- **Pesos de Referência:**
  - Trafo 75kVA: 500kg.
  - Poste 600 daN: 1100kg.
- **Acessibilidade:** Se `hasVehicleAccess` for omitido ou `true`, o custo é zero.

## 3. Validação e Qualidade
- **Cobertura de Testes:** 100% (Unit Tests).
- **Segurança:** Novos campos validados via Zod no `btCalculationRoutes.ts`.
- **Backward Compatibility:** Campos opcionais garantem que payloads antigos continuem funcionando sem erros.

## 4. Próximos Passos (Frontend)
- Adicionar toggle "Acesso Veicular" na interface de edição de postes.
- Exibir "Relatório de Arraste Manual" no resumo financeiro do projeto.
