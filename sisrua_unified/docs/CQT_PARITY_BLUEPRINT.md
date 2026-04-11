# CQT Parity Blueprint (Excel -> Sistema)

## Objetivo
Replicar no sistema os calculos da planilha `CQTsimplificado_BECO DO MATA 7 - PARIDADE_FINAL.xlsx` com paridade de resultado (Excel como fonte de verdade), incluindo os cenarios `atual`, `proj1` e `proj2`.

## Estrutura da Planilha

### Tabelas Estruturadas (ListObjects)
- `DB!CABOS` -> `A1:I26`
- `DB!TRAFOS_Z` -> `M3:N10`
- `DB!TabelaDisjuntores` -> `P1:Q21`
- `DB!TabelaParametros` -> `S1:U7`
- `DB!TabelaCondutoresMeta` -> `W1:Y26`
- `COORDENADAS!Tabela13` -> `C2:E63`
- `RAMAL!Tabela17` -> `A17:Y77`
- `GERAL!GERAL` -> `A8:M51`
- `ESQ ATUAL!Tabela7` -> `A7:Z14`
- `DIR ATUAL!DIR_ATUAL` -> `A7:Z18`
- `GERAL PROJ!GERAL_PROJ` -> `A8:M23`
- `ESQ PROJ1!ESQ_PROJ1` -> `A7:Z12`
- `DIR PROJ1!Tabela71020` -> `A7:Z13`
- `GERAL PROJ2!GERAL_PROJ2` -> `A8:M36`
- `ESQ PROJ2!ESQ_PROJ2` -> `A7:Z17`
- `DIR PROJ2!Tabela71023` -> `A7:Z13`

### Nomes Definidos Relevantes
- `DMDI` -> `RAMAL!$AA$30`
- `DEM_ATUAL` -> `DB!$K$7`
- `TR_ATUAL` -> `DB!$K$6`
- `QT_TR` -> `DB!$K$8`
- `QT_MTTR` -> `DB!$K$10`
- `QT_MTTR2` -> `DB!$K$19`
- `QT_MTTR3` -> `DB!$K$26`
- `TAB_CLAN_DMDI` -> `DB!$A$30:$B$411`
- `AUX_CLAN` -> `DB!$C$30:$F$330`
- `RAMAIS_ATUAL` -> `RAMAL!$A$18:$Y$77`
- `ATUAL_DMDI_MEDIO` -> `RAMAL!$AB$18`
- `ATUAL_DEMANDA_MAXIMA` -> `RAMAL!$AB$8`
- `ATUAL_CARGA_TOTAL` -> `RAMAL!$AB$12`

## Cadeia de Calculo Principal

### 1) Nucleo RAMAL (base de demanda)
A aba `RAMAL` calcula totais por poste e deriva o `DMDI`.

- `Xn` (por linha do ramal): quantidade total do ponto
  - Exemplo: `X18 = SUM(B18:U18)`
- `Vn` (TOTAL PONTO): soma ponderada das colunas de carga
  - Exemplo: `V18 = B18*$B$5 + ... + U18*$U$5`
- `Wn` (KVA): proporcional da carga total
  - Exemplo: `W18 = IFERROR($AA$24*(V18/$W$16),0)`
- `Yn` (KVA2): lookup por total de clientes
  - Exemplo: `Y18 = IFERROR(VLOOKUP(X18,AUX_CLAN,4,),0)`

Calculos agregados criticos:
- `AA24 = IF($AA$22="","",$AA$22*AA$20)`
- `AB34 = GERAL!L2`
- `AB35 = VLOOKUP(AB34,TAB_CLAN_DMDI,2,0)`
- `AA30 (DMDI) = IF(GERAL!I2="SIM",AB35,AA24/SUM(X18:X77))`

Interpretacao:
- Se `GERAL!I2 = "SIM"`, o DMDI vem da curva clandestina (`TAB_CLAN_DMDI`).
- Caso contrario, usa media por clientes (`AA24 / soma de X`).

### 2) GERAL (tronco e acumulacao)
Tabela `GERAL` (A8:M51) com colunas:
- `PONTO, TRECHO, M, X, Y, CLIENTES, CLT ACUMULADO, TOTAL DO TRECHO, ACUMULADA, SNAP, LADO, CONDUTOR, CQT NO PONTO`

Formulas-chave:
- `CLIENTES = VLOOKUP(PONTO,RAMAIS_ATUAL,24,0)`
- `CLT ACUMULADO = SUMIF(GERAL[TRECHO],PONTO,GERAL[CLT ACUMULADO]) + CLIENTES`
- `TOTAL DO TRECHO = VLOOKUP(PONTO,RAMAIS_ATUAL, IF($I$2="SIM",25,23), 0)`
- `ACUMULADA = IF($I$2="SIM", VLOOKUP(CLT ACUMULADO,AUX_CLAN,4,0), SUMIF(...)+TOTAL DO TRECHO)`
- `CQT NO PONTO`:
  - se `LADO="ESQUERDO"` -> busca `ESQ ATUAL` col ETA/CQT
  - se `LADO="DIREITO"` -> busca `DIR ATUAL` col ETA/CQT
  - se `LADO="TRAFO"` -> `127 - 127*QT_MTTR`

### 3) Ramos ESQ/DIR (queda de tensao, corrente e protecao)
As tabelas `ESQ ATUAL` e `DIR ATUAL` seguem mesma logica (com referencias de tabela diferentes):
- `KVA PONTO`: se ponto RAMAL usa `DMDI`, senao busca em `GERAL`
- `ACUMULADA`: para RAMAL usa `KVA PONTO`, senao busca acumulada no `GERAL`
- `CONDUTOR`: vem do `GERAL`
- `Ib`: calculada por fase/ETA
- `In`: lookup em `TabelaDisjuntores`
- `Iz`: lookup em `CABOS`
- `PROTECAO = IF(AND(Ib<=In, In<=Iz),"OK","VERIFICAR")`
- `QT-PONTO` e `QT %`: calculo de queda por trecho com resistencia corrigida por temperatura

Formula estrutural de queda (resumo):
- `QT-PONTO ~ fator_fase * ACUMULADA * sqrt(R^2 + Xcabo^2) * M * tensao + termo_MTTR`

Mapeamentos de saida por lado:
- `GERAL!P31 = VLOOKUP("RAMAL", ESQ_ATUAL, col_eta_cqt, 0)`
- `GERAL!P32 = VLOOKUP("RAMAL", DIR_ATUAL, col_eta_cqt, 0)`

Valores observados (arquivo atual):
- `GERAL!P31 = 118.69775108855391`
- `GERAL!P32 = 117.04688712724072`

### 4) DB (indicadores sinteticos)
- `K6 (TR_ATUAL) = GERAL!O3`
- `K7 (DEM_ATUAL) = GERAL!I9`
- `K8 (QT_TR) = (DEM_ATUAL/TR_ATUAL) * VLOOKUP(TR_ATUAL,TRAFOS_Z,2,0)`
- `K10 (QT_MTTR) = QT_MT + QT_TR`

Valores observados:
- `DB!K6 = 225`
- `DB!K7 = 101.95599999999999`
- `DB!K8 = 0.015859822222222222`
- `DB!K10 = 0.03415982222222222`

### 5) Projecoes (PROJ1/PROJ2)
As abas `GERAL PROJ`, `ESQ PROJ1`, `DIR PROJ1`, `GERAL PROJ2`, `ESQ PROJ2`, `DIR PROJ2` replicam a logica do atual com:
- tabelas de lado especificas (`ESQ_PROJ1`, `Tabela71020`, `ESQ_PROJ2`, `Tabela71023`)
- mesmos padroes de `KVA PONTO`, `ACUMULADA`, `Ib/In/Iz`, `PROTECAO`

Exemplo de saidas:
- `GERAL PROJ!P31 = 120.83736598928087`
- `GERAL PROJ!P32 = 120.72752247511889`

## Regras de Paridade (importante)
- Considerar `"SIM"` textual exatamente como no Excel para chavear caminhos clandestino/nao clandestino.
- Manter semantica de erro do Excel (`IFERROR`) e defaults para 0 ou string vazia conforme formula.
- Preservar arredondamentos implicitos de IEEE-754 (nao forcar arredondamento prematuro).
- Tratar VLOOKUP aproximado (`TRUE`) de forma distinta de exato (`0/FALSE`).
- Priorizar reproduzir comportamento do workbook, mesmo quando houver formula aparentemente "estranha".

## Especificacao de Implementacao (proposta)

### Entradas minimas no sistema
- Matriz RAMAL por poste (colunas equivalentes `B:U`)
- Parametros de carga (linha 5 da RAMAL e parametros de `DB`)
- Topologia de trechos (`PONTO`, `TRECHO`, `M`, lado, condutor)
- Coordenadas por ponto (equivalente `COORD`)
- Tabelas auxiliares:
  - `AUX_CLAN`, `TAB_CLAN_DMDI`
  - `CABOS`, `TabelaDisjuntores`, `TRAFOS_Z`

### Modulos recomendados
- `cqt/lookup.ts` (VLOOKUP exato/aproximado, SUMIF)
- `cqt/ramal.ts` (calculo X/V/W/Y, AA24, AB35, AA30)
- `cqt/geral.ts` (CLT acumulado, acumulada, CQT no ponto)
- `cqt/branches.ts` (ESQ/DIR atual/proj, Ib/In/Iz, protecao, QT)
- `cqt/db.ts` (K6, K7, K8, K10 e derivados)
- `cqt/parity-tests.spec.ts` (fixtures espelho da planilha)

## Plano de Validacao
1. Montar fixture JSON com os dados do arquivo atual (tabelas e parametros).
2. Rodar calculo no sistema para `atual`, `proj1`, `proj2`.
3. Comparar celulas-chave com tolerancia baixa (`1e-9`) para campos numericos.
4. Validar especificamente:
   - `DMDI (RAMAL!AA30)`
   - `GERAL!P31/P32`
   - `DB!K6/K7/K8/K10`
5. Registrar diffs por celula em relatorio de paridade.

## Riscos Tecnicos
- Dependencia de ranges nomeados incompletos (`RAMAIS_PROJ1/2` vazios no workbook atual).
- Ambiguidade em tabelas com nomes gerados automaticamente (`Tabela71020`, `Tabela71023`).
- Diferencas entre formulas com string vazia e nulo podem alterar encadeamentos de lookup.

## Proximo Passo Imediato
Implementar o modulo de motor CQT com primeiro alvo de paridade: `RAMAL (AA30) -> GERAL (P31/P32) -> DB (K6/K7/K8/K10)`, depois expandir para `PROJ1/PROJ2`.