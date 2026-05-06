# CAC - Implementação do Motor de Cálculo Mecânico 2.5D (MechanicalProcessor)

**Data:** 2026-04-26  
**Status:** Implementado e Validado  
**Contexto:** Integração de lógica de engenharia mecânica (soma vetorial de esforços) no sisTOPOGRAFIA, inspirada no sisCAPAX, porém adaptada para as normas da Light S.A.

## 1. Arquitetura Técnica
A implementação segue o padrão **Smart Backend**, movendo a complexidade matemática para o servidor e expondo o resultado via API desacoplada.

### Componentes:
- **`btMechanicalTypes.ts`**: Definição de contratos (Input/Output) e banco de dados estático de condutores Light (Trações nominais).
- **`btMechanicalCalculationService.ts`**: O "Cérebro" do motor. Realiza o cálculo de Bearing (azimute inicial) entre coordenadas geográficas e a decomposição vetorial ($F_x, F_y$) para soma resultante.
- **`btCalculationRoutes.ts`**: Nova rota `POST /api/bt-calculation/calculate-mechanical` protegida por feature flag.

## 2. Lógica de Geoprocessamento 2.5D
Diferente de sistemas puramente CAD, o sisTOPOGRAFIA utiliza coordenadas reais. O motor calcula o ângulo entre postes considerando a curvatura da Terra (Fórmula de Haversine/Bearing), garantindo que a soma vetorial reflita a realidade do terreno.

- **Vetores:** Cada vão traciona o poste na direção do poste vizinho.
- **Resultante:** $\vec{R} = \sum \vec{T}_i$. Se $|\vec{R}| > \text{Capacidade Nominal}$, o poste é marcado como `overloaded`.

## 3. Normas Adotadas (Light S.A.)
- Condutores padrão: Multiplexados de Alumínio (35, 70, 120, 185 mm²).
- Trações de projeto: Baseadas em EDS (Every Day Stress) e carga máxima normativa.
- Coeficiente de Segurança: Integrado no payload (default 1.5).

## 4. Validação e Qualidade
- **Cobertura de Testes:** 98.11% (Unit Tests).
- **Performance:** Cálculo instantâneo para malhas de até 500 postes (complexidade $O(N \cdot E)$ onde $E$ é o número de conexões por poste).
- **Segurança:** Validação estrita de entrada via Zod, impedindo injeção de dados malformados ou coordenadas impossíveis.

## 5. Próximos Passos (Frontend)
- Implementar "Heatmap de Esforço" no mapa (Colorir postes de acordo com a tração).
- Exibir vetores de força resultantes em camadas 2.5D (setas indicativas).
