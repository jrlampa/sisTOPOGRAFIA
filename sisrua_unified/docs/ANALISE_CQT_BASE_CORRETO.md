# Análise Técnica - Planilha CQT BASE CORRETO

> Arquivo: `CQT - BASE - CORRETO.xlsm`  
> Tamanho: 756 KB  
> Formato: Excel Macro-Enabled (.xms)  
> Empresa: Light S.E.S.A. - DDE (Engenharia da Distribuição)  
> Versão: 2.3_S e A

---

## 1. Estrutura da Planilha

A planilha contém **14 abas funcionais** organizadas para cálculo completo de queda de tensão em redes de distribuição de energia elétrica.

### 1.1 Abas Principais

| # | Aba | Dimensão | Função |
|---|-----|----------|--------|
| 1 | **PP e CE** | 253×17 | Programas Prioritários e Custos Estratégicos |
| 2 | **Base de Dados** | 44×37 | Cadastro de projetos e tipologias de rede |
| 3 | **PF e Prestação de Serviço** | 110×20 | Cálculo do ERD (Res. ANEEL 414/2010) |
| 4 | **Ramais** | 80×23 | Ampacidade de condutores de ramais BT |
| 5 | **Distrib. Cargas** | 28×7 | Balanceamento de cargas por poste |
| 6 | **Coeficiente Unitário** | 17×5 | Parâmetros elétricos dos cabos |
| 7 | **FML** | - | Fluxo de Máxima de Linha (template) |
| 8 | **QDT LADO 1** | 268×127 | Queda de Tensão - Lado 1 do transformador |
| 9 | **QDT LADO 2** | 268×127 | Queda de Tensão - Lado 2 do transformador |
| 10 | **ANÁLISE PONTO A PONTO** | - | Análise detalhada (não analisada) |
| 11 | **Curva Disj.** | - | Curvas de disparo de disjuntores |
| 12 | **Curva NH** | - | Curvas de fusíveis NH |
| 13 | **Alocação % de tensão** | - | Alocação percentual de tensão |
| 14 | **Tabela** | - | Dados auxiliares |

---

## 2. Metodologia de Cálculo de Queda de Tensão (CQT)

### 2.1 Visão Geral

A planilha utiliza o **método do ponto a ponto (método do somatório de trechos)** para cálculo de queda de tensão em redes de distribuição BT/MT. O cálculo é feito separadamente para cada lado do transformador (LADO 1 e LADO 2).

### 2.2 Dados de Entrada

#### Parâmetros do Transformador (QDT LADO 1/2)

| Parâmetro | Valor |
|-----------|-------|
| Potência | 40 MVA |
| Impedância (Z%) | 20% |
| Tensão MT | 13.8 kV |
| Tensão BT | 220 V |

#### Parâmetros de Cálculo

| Parâmetro | Linha | Descrição |
|-----------|-------|-----------|
| Impedância Z% | 5 | 3.5% |
| Tensão | 5 | 220 V |
| Taxa de crescimento a.a. | 3 | % ao ano |
| Horizonte (anos) | 4 | Período de projeção |
| Critério de diversificação | 4 | SIM/NÃO |

#### Estrutura de Trechos

| Coluna | Descrição |
|--------|-----------|
| 2 | Trecho do Circuito (TRAF.1, P-2, P-3, ...) |
| 3 | Nº de consumidores no final do trecho |
| 4 | kVA por consumidor |
| 6 | FDIV (Fator de Diversificação) |
| 7 | Nº de fases do trecho (1, 2 ou 3) |
| 9 | Tipo de Trecho (Rede/Ramal) |
| 10-12 | Carga no fim do trecho [kVA] |
| 38 | Cabo de B.T. selecionado |

---

## 3. Parâmetros Elétricos dos Cabos

### 3.1 Coeficientes Unitários (Aba: Coeficiente Unitário)

| Cabo | R (Ω/km) | X (Ω/km) | Coef. Queda |
|------|----------|----------|-------------|
| 33 AA | 1.0903 | 0.4034 | 0.2402 |
| 33 AC | 1.0254 | 0.3419 | 0.2233 |
| 53 AA | 0.7059 | 0.3705 | 0.1647 |
| 53 AC | 0.6456 | 0.3235 | 0.1492 |
| 107 A | 0.3225 | 0.2968 | 0.0906 |
| 107 AC | 0.3250 | 0.2968 | 0.0909 |
| 201 A | 0.1731 | 0.2686 | 0.0660 |
| 201 AC | 0.1731 | 0.2686 | 0.0660 |
| 53 QX | 0.6641 | 0.1311 | 0.1399 |
| 85 QX | 0.4180 | 0.1279 | 0.0903 |
| 107 QX | 0.3313 | 0.1290 | 0.0735 |
| 53 MX | 0.6641 | 0.1311 | 0.1399 |
| 70 MMX | 0.5697 | 0.1260 | 0.1206 |
| 185 MMX | 0.2149 | 0.1178 | 0.0506 |

### 3.2 Cálculo da Resistência Corrigida

```
Rca = Rcc_20°C × [1 + α × (T_final - 20)]
```

Onde:
- `α` = 0.00393 (cobre) ou 0.00403 (alumínio)
- `T_final` = 75°C ou 90°C

---

## 4. Fórmulas de Cálculo

### 4.1 Carga Acumulada no Trecho

```
Carga_acumulada = Σ (kVA por consumidor × Nº de consumidores) × FDIV
```

### 4.2 Queda de Tensão no Trecho

#### Método das Impedâncias

```
ΔV_trecho = I × (Rca × cos φ + XL × sen φ) × L
```

#### Método Simplificado (Coeficiente Unitário)

```
ΔV(%) = (Carga_kVA × Coef_Queda × L) / 10
```

### 4.3 Queda de Tensão Acumulada

```
ΔV_acumulada(%) = Σ ΔV_trecho(i)  para i = 1 até n
```

### 4.4 Verificação de Critérios

```
Status = "Ok !" se ΔV_acumulada ≤ Limite_regulamentado
```

---

## 5. Exemplo de Dados Calculados

### 5.1 QDT LADO 1 - Trechos Calculados

| Linha | Trecho | Carga Fim (kVA) | Temp (°C) | Queda Trecho (%) | Queda Acumulada (%) | Status |
|-------|--------|-----------------|-----------|------------------|---------------------|--------|
| 12 | TRAF.1 | 123.00 | 75.04 | 0.1356 | 7.7087 | Ok ! |
| 13 | P-2 | 49.58 | 61.93 | 2.0261 | 9.7348 | Ok ! |
| 14 | P-3 | 26.27 | 46.92 | 0.5782 | 10.3130 | Ok ! |
| 15 | P-4 | 26.27 | 46.92 | 1.3945 | 11.7075 | Ok ! |
| 16 | P-5 | 19.89 | 42.81 | 1.1167 | 12.8242 | Ok ! |
| 17 | P-6 | 6.14 | 33.95 | 0.3339 | 13.1581 | Ok ! |
| 18 | P-7 | 18.66 | 42.02 | 0.8549 | 14.0130 | Ok ! |
| 19 | P-8 | 18.66 | 42.02 | 0.8074 | 14.8204 | Ok ! |
| 20 | P-9 | 18.66 | 42.02 | 0.2137 | 15.0342 | Ok ! |

---

## 6. Base de Dados - Tipologias de Rede

### 6.1 Estrutura (44 linhas × 37 colunas)

Colunas identificadas:
- Identificação: `Programa Prioritário (PP)`, `ID`, `Projeto`, `Natureza da ligação`
- Documentação: `Documento origem`
- Classificações: `PP 01-04`, `PP 15-17`, `PP`, `PP AUXILIAR`, `CE`

### 6.2 Tipologias de Rede Cobertas

| Código | Descrição |
|--------|-----------|
| LN BT Aer | Linha BT Aérea |
| LN BT Sub | Linha BT Subterrânea |
| LN BT Mista | Linha BT Mista |
| AC BT Aer | Aéreo Compacto BT Aéreo |
| AC BT Sub | Aéreo Compacto BT Subterrâneo |
| AC BT Mista | Aéreo Compacto BT Mista |
| LN MT Aer | Linha MT Aérea |
| LN MT Sub | Linha MT Subterrânea |
| LN MT Mista | Linha MT Mista |
| AC MT Aer | Aéreo Compacto MT Aéreo |
| AC MT Sub | Aéreo Compacto MT Subterrâneo |
| AC MT Mista | Aéreo Compacto MT Mista |
| LN Rur | Linha Rural |
| LN BT/MT Aer | Linha BT/MT Aérea |
| LN BT/MT Sub | Linha BT/MT Subterrânea |
| LN BT/MT Mista | Linha BT/MT Mista |

---

## 7. Cálculo do ERD (Encargos de Reserva de Distribuição)

### 7.1 Referência Legal
- **Resolução ANEEL Nº 414/2010**

### 7.2 Parâmetros (Aba: PF e Prestação de Serviço)

| Parâmetro | Valor |
|-----------|-------|
| Subgrupo Tarifário | BT |
| K | 1152.25 |
| TUSD Fio B | R$ 18,00 |
| WACC | 7.5% |
| Parcela B | R$ 2.110.930.981,07 |
| O&M | R$ 737.245.854,58 |
| Fator 'a' | 0.3493 |
| Taxa deprec. (d) | 3.81% |
| FRC | 0.1208 |
| Taxa (i) | 11.36% |
| Vida útil (n) | 26.25 anos |

---

## 8. Ramais - Ampacidade

### 8.1 Condutores Fora de Padrão

| Seção (mm²) | Carregamento (A) | Cabo de Rede |
|-------------|------------------|--------------|
| 5 (CC) | 66 | 33 AA |
| 8 (CC) | 88 | 33 AC |
| 13 (CC) | 116 | 53 AA |
| 21 (CC) | 151 | 53 AC |

### 8.2 Parâmetros Elétricos dos Ramais

| Seção | R (Ω) | X (Ω) | Comercial | Residencial | Misto |
|-------|-------|-------|-----------|-------------|-------|
| 33 AA | 1.0903 | 0.4034 | 1.1393 | 1.1617 | 1.1571 |
| 33 AC | 1.0254 | 0.3419 | 1.0517 | 1.0809 | 1.0719 |
| 53 AA | 0.7059 | 0.3705 | 0.7952 | 0.7863 | 0.7968 |
| 53 AC | 0.6456 | 0.3235 | 0.7192 | 0.7143 | 0.7221 |

### 8.3 Fatores de Potência

| Tipo | cos φ | sen φ |
|------|-------|-------|
| - | 1.0 | 0.0 |
| Comercial | 0.85 | 0.5268 |
| Residencial | 0.90 | 0.4359 |
| Misto | 0.95 | 0.3122 |

---

## 9. Distribuição de Cargas

### 9.1 Estrutura (28 linhas × 7 colunas)

| Parâmetro | Valor |
|-----------|-------|
| Corrente Máxima | 1073.53 A |
| Fator de Temperatura | 1.2 |
| Demanda Corrigida | 483.09 |
| Demanda Máxima | 483.09 |

### 9.2 Balanceamento

- **Lado 1**: Poste 1 a Poste 22 (até 22 postes)
- **Lado 2**: Poste 1 a Poste 22 (até 22 postes)
- Carga distribuída simetricamente ou conforme demanda real

---

## 10. Fluxo do Cálculo

```
┌─────────────────────────────────────────────────────────────┐
│                    ENTRADA DE DADOS                        │
├─────────────────────────────────────────────────────────────┤
│  • Distrib. Cargas (carga por poste)                       │
│  • Ramais (configuração dos ramais)                        │
│  • QDT LADO 1/2 (trechos do circuito)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              CÁLCULO POR TRECHO (iterativo)                │
├─────────────────────────────────────────────────────────────┤
│  1. Determina carga acumulada                               │
│  2. Seleciona cabo e parâmetros elétricos                 │
│  3. Calcula Rca e XL do trecho                              │
│  4. Calcula queda de tensão do trecho                       │
│  5. Acumula queda total                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICAÇÃO                             │
├─────────────────────────────────────────────────────────────┤
│  • Compara com limite regulamentado                         │
│  • Marca "Ok !" ou identifica violação                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      CENÁRIOS                              │
├─────────────────────────────────────────────────────────────┤
│  • Sem crescimento da carga                                 │
│  • Com crescimento da carga (projeção futura)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Fórmula Matemática Completa

A queda de tensão é calculada pela **fórmula do circuito monofásico equivalente**:

```
ΔV(%) = Σ [ (P_i × R_i + Q_i × X_i) × L_i ] × 100 / V²
```

Onde:
- `P_i` = Potência ativa no trecho i (kW)
- `Q_i` = Potência reativa no trecho i (kVAr)
- `R_i` = Resistência unitária do cabo no trecho i (Ω/km)
- `X_i` = Reatância unitária do cabo no trecho i (Ω/km)
- `L_i` = Comprimento do trecho i (km)
- `V` = Tensão nominal (V)

O cálculo é **iterativo trecho a trecho**, acumulando as cargas e as quedas desde o transformador até o ponto mais desfavorável do circuito.

---

## 12. Notas Técnicas

1. **Versão**: 2.3_S e A (2012)
2. **Empresa**: Light S.E.S.A.
3. **Departamento**: DDE - Engenharia da Distribuição
4. **Padrão**: ANEEL Res. 414/2010
5. **Método**: Cálculo de Queda de Tensão (CQT) - Método do Ponto a Ponto

---

*Documento gerado em: Abril/2026*
*Análise técnica da planilha CQT - BASE - CORRETO.xlsm*
