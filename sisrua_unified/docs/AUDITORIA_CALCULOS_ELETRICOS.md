# Auditoria dos Cálculos Elétricos (SisRUA Unified)

## 📌 Contexto
Este relatório analisa o modelo de cálculo dos parâmetros elétricos contido na planilha legado `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx` com o intuito de estruturar e sanear a migração desses cálculos (Demanda, kVA Acumulado e Queda de Tensão - CQT) para o motor do SisRUA Unified (Python/Node.js).

---

## ⚡ 1. Cálculo da Demanda por Ponto (Poste)
**Como é feito no Excel:**
A demanda individual de cada poste é puxada da aba de levantamento (ou planilha de consumidores `RAMAIS_ATUAL`) usando um simples PROCV/VLOOKUP baseado no ID do poste (`PONTO`). Há um cálculo indireto quando a opção de "Clandestinos" (`AUX_CLAN`) está ativada.

**Como identificar Acúmulo de Clientes:**
```excel
=SUMIF(GERAL_PROJ[TRECHO], GERAL_PROJ[[#This Row],[PONTO]], GERAL_PROJ[CLT ACUMULADO]) + GERAL_PROJ[[#This Row],[CLIENTES]]
```

**⚠️ Análise Crítica / Riscos Ambientais:**
- **Recrudescimento de Arvores:** No Excel, a soma de jusante para montante via `SUMIF` assume implicitamente que a planilha está adequadamente ordenada de jusante para montante (Bottom-Up) ou que o recalculo consiga varrer ciclicamente sem cair em referências circulares. Em redes muito ramificadas ou longas, isso quebra com facilidade.
- **Fator de Diversidade Cego:** O uso de `VLOOKUP` na tabela de fator de diversidade / demanda em função do acúmulo de clientes (`AUX_CLAN`) exige valores inteiros contíguos de clientes ou aproximações via `TRUE` lockup.
- **Sugestão de Correção (DDD & Arquitetura):** No SisRUA Unified (Thin Frontend / Smart Backend), a topologia BT deve ser montada estritamente como um **DAG (Directed Acyclic Graph)**, possivelmente gerenciada via `osmnx` ou `networkx` no Python. A demanda agregada de clientes e a tabela de equivalência de kVA devem ser varridas recursivamente do fim para o trafo (DFS invertido - *Depth-First Search*), aplicando o fator de demanda por degrau, assim o `kVA` nunca é apenas somado de forma linear (exceto em casos puramente indutivos sem diversidade).

---

## ⚡ 2. Cálculo do kVA Acumulado (Acumulada)
**Como é feito no Excel:**
```excel
=IFERROR(IF($I$2="SIM", VLOOKUP(...), SUMIF(GERAL_PROJ[TRECHO], GERAL_PROJ[[#This Row],[PONTO]], GERAL_PROJ[ACUMULADA]) + GERAL_PROJ[[#This Row],[TOTAL DO TRECHO]]),"")
```

**⚠️ Análise Crítica / Riscos:**
- As "Somas Condicionais" (`SUMIF`) são extremamente limitadas. O kVA não se soma simplesmente de forma escalar em redes reais (devido à defasagem fasorial — soma vetorial). Porém, pelas normas de distribuição (Light S.A.), para BT a soma escalar do kVA diversificado é aceitável como aproximação.
- **Sugestão de Correção:** Na implementação pelo backend, criar um serviço (`mechanicalAndAnalysisRoutes` ou via engine em Python) em que o objeto POSTE tenha uma propriedade `.upstream` e `.downstream`. O acumulado de um trecho `[P_n, P_n+1]` deverá ser rigorosamente igual à Demanda(P_n+1) + Acumulado(Todos os Downstreams de P_n+1). O motor em Python calcula isso em `O(V+E)` e exporta estaticamente em propriedades para o frontend consumir. 

---

## ⚡ 3. CQT - Queda de Tensão
**Como é feito no Excel:**
A equação raiz encontrada:
```excel
Fator Relativo: IF(FASE="MONO", 6, IF(FASE="BIF", 2, 1))
Correção de Temperatura (R_CORR): (VLOOKUP_R_20 / VLOOKUP_Massa) * (1 + Alfa * (Temp - 20))
CQT Parcial (%): 
K_Fase * ACUMULADA * (SQRT(R_CORR^2 + X^2) / ((V_base^2)/100)) * COMPRIMENTO_M * 127/100
```

**Análise Teórica de Paridade:**
1. A constante fasorial `K_Fase` de 6 para Mono (F-N), 2 para Bifásico (F-F) e 1 para Trifásico está **estruturalmente correta** mediante formulação clássica onde $\Delta V_{3\phi}(\%) = 100 \cdot \frac{S \cdot Z \cdot L}{V_{LL}^2}$ considerando tensões $127V / 220V$.
2. Magnitude da Impedância usando a hipotenusa ($SQRT(R^2+X^2)$) em vez de decomposição geométrica de carga ($R\cos(\phi) + X\sin(\phi)$): Isso define uma carga com ângulo de fator de potência exatamente coincidente ao ângulo da linha, o que produz a **Queda de Tensão Máxima Possível**. É um critério conservador seguro, muito utilizado na Light S.A, provando que as bases da Engenharia neste legado eram corretas.

**⚠️ Análise Crítica / Riscos:**
- O multiplicador final extra `* 127/100` acoplado com `(($P$7^2)/100)` resulta em flutuações e hardcodings silenciosos dependentes das células de base `$P$7`.
- **Sugestão de Correção (Implementação no App):** 
Em Node ou Python, abstrair isso em um `CalculatorService` (SRP/Clean Code):
```python
def calculate_cqt(k_fase: int, kva_acumulado: float, r_corr: float, x: float, length_m: float, v_base: float) -> float:
    # Retirar hardcodings 127/100 e acoplar aos parâmetros explícitos do trafo
    z_magnitude = math.sqrt(r_corr**2 + x**2)
    volts_drop = k_fase * kva_acumulado * z_magnitude * (length_m / 1000.0) # km normalization
    # Ajustar para percentual real de acordo com as especificações da concessionária
    cqt_percent = (volts_drop / v_base) * 100
    return cqt_percent
```

---

## 🛡️ Parecer Final do Auditor Sênior

1. **Paridade com "Cálculo de Demanda Light":** As bases físicas estão fiéis ao procedimento normativo padrão, mas sua implantação em planilhas é suja, repetitiva ($VLOOKUP$ reescritos em colunas A através de Z), e engessa manutenções. 
2. **Arquitetura Alvo:** No SisRUA, isto NÃO deve ser resolvido no TypeScript/Frontend. Conforme regras do sistema (*Thin Frontend / Smart Backend*), toda estruturação geométrica (os postes no mapa via Leaflet) passará os cabos (arestas) via payload para o Python.
3. **Fluxo Sistêmico Sugerido:** 
   - Usuário desenha topologia no Leaflet.
   - Frontend dispara POST para `/api/analysis/bt-topology` definindo qual poste é o Trafo (Root).
   - O Python Engine transforma o GeoJSON num *Grafo Direcionado Aresta-Pólo*.
   - A função varre para cima calculando `.downstream_clients` $\rightarrow$ Converte em DEMANDA kVA por poste via interpolação de tabela.
   - A função varre de volta (do trafo para a ponta) acumulando o `%CQT` somando os trechos, identificando pontos onde $\%CQT > 5\%$ para marcação de `status: "reprovado"`.
   - O Frontend renderiza as labels dos postes condicionalmente usando a propriedade `.accumulated_cqt`.

Ao implementar dessa maneira, eliminaremos 100% dos erros sistemáticos causados por desconexão topológica (comum em Excel). O algoritmo será autoajustável e tolerante a geometrias irregulares.
