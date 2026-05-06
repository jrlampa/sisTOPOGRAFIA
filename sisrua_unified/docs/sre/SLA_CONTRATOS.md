# SLA Contratos — sisTOPOGRAFIA (sisRUA Unified)

> **Roadmap Item 114 [T1] — SLO/SLA por Fluxo Crítico Contratual**
>
> Este documento define os Acordos de Nível de Serviço (SLA) contratuais do
> sisTOPOGRAFIA para clientes enterprise. Os valores aqui definidos são a base
> para cláusulas contratuais formais. Toda alteração deve ser aprovada pelo
> Tech Lead e pela equipe jurídica antes de comunicada ao cliente.

**Versão:** 1.0.0
**Data de emissão:** 2026-04-14
**Revisão programada:** 2026-07-14 (trimestral)
**Proprietário:** Tech Lead + Jurídico
**Aplicação:** Clientes com contrato enterprise ativo

---

## Sumário

1. [Definições e Escopo](#1-definições-e-escopo)
2. [Compromissos de Nível de Serviço](#2-compromissos-de-nível-de-serviço)
3. [Janela de Manutenção Programada](#3-janela-de-manutenção-programada)
4. [Metodologia de Medição](#4-metodologia-de-medição)
5. [Penalidades por Violação de SLA](#5-penalidades-por-violação-de-sla)
6. [Processo de Reclamação (Claim)](#6-processo-de-reclamação-claim)
7. [Relatórios Mensais de SLA](#7-relatórios-mensais-de-sla)
8. [Exclusões e Limitações de Responsabilidade](#8-exclusões-e-limitações-de-responsabilidade)
9. [Hierarquia de Documentos](#9-hierarquia-de-documentos)

---

## 1. Definições e Escopo

### Definições

| Termo                  | Definição                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Serviço**            | A plataforma sisTOPOGRAFIA (sisRUA Unified) acessada via URL contratada.                                      |
| **Disponibilidade**    | Porcentagem de minutos em um mês calendario em que o Serviço responde ao health check com HTTP 200 em ≤ 10 s. |
| **Mês de referência**  | Período de 1º ao último dia do mês calendário no fuso BRT (UTC-3).                                            |
| **Incidente de SLA**   | Qualquer período contínuo de indisponibilidade ou degradação que viole os targets desta seção.                |
| **Crédito de Serviço** | Desconto aplicado na fatura do mês subsequente ao mês em que ocorreu a violação.                              |
| **Tempo de Resposta**  | Latência medida do servidor (não inclui latência de rede do cliente).                                         |
| **Geração DXF**        | Processo completo desde a submissão da requisição até a disponibilidade do arquivo `.dxf` para download.      |

### Escopo de Aplicação

Este SLA aplica-se a:

- Todos os endpoints da API REST documentados no Swagger (`/api-docs`).
- Processo de geração de arquivos DXF via `POST /api/dxf/generate`.
- Cálculos BT/CQT via `POST /api/bt/calculate`.
- Endpoint de health check `GET /health`.

Este SLA **não** se aplica a:

- Ambientes de desenvolvimento e staging.
- Funcionalidades em versão beta (marcadas na documentação).
- Uso acima dos limites de rate limit documentados.
- Degradação causada exclusivamente por APIs externas públicas (IBGE, INDE, OSM, TOPODATA)
  quando o fallback foi corretamente ativado.

---

## 2. Compromissos de Nível de Serviço

### 2.1 Disponibilidade Mensal

| Indicador                  | Compromisso                     | Medição                                 |
| -------------------------- | ------------------------------- | --------------------------------------- |
| **Disponibilidade mensal** | **≥ 99,5 %** por mês calendário | Probe externo `GET /health` a cada 60 s |

**Cálculo:**

```
Disponibilidade (%) = ((Total_min_mês − min_indisponível) / Total_min_mês) × 100

Exemplo (fevereiro 2026 — 28 dias):
  Total: 40.320 min
  Budget de indisponibilidade: 40.320 × 0,5% = 201,6 min ≈ 3 h 21 min
```

**Tabela de disponibilidade e tempo máximo offline por mês:**

| Disponibilidade | Máx. offline/mês (31 dias) | Máx. offline/mês (28 dias) |
| --------------- | -------------------------- | -------------------------- |
| 99,5 %          | 222 min (3h 42min)         | 201 min (3h 21min)         |
| 99,0 %          | 446 min (7h 26min)         | 403 min (6h 43min)         |
| 98,0 %          | 893 min (14h 53min)        | 806 min (13h 26min)        |

---

### 2.2 Tempo Máximo de Geração DXF

| Indicador             | Compromisso                    | Medição                                                  |
| --------------------- | ------------------------------ | -------------------------------------------------------- |
| **Geração DXF — p95** | **≤ 120 s** por mês calendário | Percentil 95 de `sisrua_dxf_generation_duration_seconds` |

- O prazo é medido do instante de criação da tarefa na fila até a disponibilidade
  do arquivo para download (tempo end-to-end, incluindo fila + processamento Python).
- Requisições com tamanho de área > limite documentado (raio máximo: 5.000 m por padrão)
  estão excluídas do SLA de latência.

---

### 2.3 Tempo de Resposta da API

| Indicador          | Compromisso                  | Medição                                                |
| ------------------ | ---------------------------- | ------------------------------------------------------ |
| **API REST — p95** | **≤ 2 s** por mês calendário | Percentil 95 de `sisrua_http_request_duration_seconds` |

- Mede exclusivamente o tempo de processamento no servidor (não inclui rede do cliente).
- Aplica-se a todos os endpoints exceto `/api/dxf/generate` (coberto pelo SLA 2.2).
- Requisições que atingem o rate limiter (`HTTP 429`) não são contadas.

---

### 2.4 Sumário dos Compromissos Contratuais

| #      | Indicador              | Compromisso | Penalidade por violação |
| ------ | ---------------------- | ----------- | ----------------------- |
| SLA-01 | Disponibilidade mensal | ≥ 99,5 %    | Ver seção 5             |
| SLA-02 | Geração DXF p95        | ≤ 120 s     | Ver seção 5             |
| SLA-03 | API REST p95           | ≤ 2 s       | Ver seção 5             |

---

## 3. Janela de Manutenção Programada

### 3.1 Manutenção Recorrente

| Parâmetro              | Valor                                                        |
| ---------------------- | ------------------------------------------------------------ |
| **Horário**            | Todo domingo, 02:00–04:00 BRT (UTC-3)                        |
| **Duração máxima**     | 2 horas                                                      |
| **Frequência**         | Semanal (podendo ser cancelada quando não houver manutenção) |
| **Notificação prévia** | Mínimo 48 horas antes, via e-mail e status page              |

Períodos de manutenção programada dentro dessa janela são **excluídos** do cálculo
de disponibilidade contratual.

### 3.2 Manutenção Não Programada (Emergencial)

Quando uma manutenção emergencial for necessária fora da janela programada:

| Parâmetro          | Valor                                                               |
| ------------------ | ------------------------------------------------------------------- |
| **Notificação**    | Mínimo 2 horas antes (quando possível)                              |
| **Canal**          | E-mail + status page + canal `#status-clientes`                     |
| **Limite mensal**  | Máximo 1 manutenção emergencial por mês fora da janela              |
| **Cômputo no SLA** | As primeiras 4 horas de manutenção emergencial são excluídas do SLA |

### 3.3 Procedimento de Comunicação

```
[Template de notificação de manutenção]

Assunto: [sisRUA] Manutenção Programada — <data> <horário>

Prezado(a) <nome do cliente>,

Informamos que o sistema sisTOPOGRAFIA passará por manutenção programada:

  Data:    <dia da semana>, <DD/MM/YYYY>
  Horário: 02:00 – 04:00 BRT (UTC-3)
  Impacto: [descrição do impacto esperado: indisponibilidade total / parcial / apenas X funcionalidade]

Ações recomendadas:
  - Evitar geração de DXFs entre 01:50 e 04:10 BRT
  - Jobs submetidos antes da manutenção serão processados após o término

Atualizações em tempo real: <URL status page>

Em caso de dúvidas: <e-mail suporte>

Atenciosamente,
Equipe sisTOPOGRAFIA
```

---

## 4. Metodologia de Medição

### 4.1 Disponibilidade (SLA-01)

- **Ferramenta:** Probe externo configurado pelo time SRE (UptimeRobot, Grafana
  Synthetic Monitoring ou equivalente).
- **URL monitorada:** `GET https://<URL_DO_CLIENTE>/health`
- **Frequência:** A cada 60 segundos.
- **Critério de disponibilidade:** HTTP 200 recebido em ≤ 10 s.
- **Critério de indisponibilidade:** ≥ 2 probes consecutivas sem resposta válida.
- **Fonte de verdade:** Logs da ferramenta de probe, disponíveis mediante solicitação.

### 4.2 Latências (SLA-02 e SLA-03)

- **Fonte:** Métricas Prometheus exportadas pelo endpoint `/metrics`.
- **Métrica DXF:** `histogram_quantile(0.95, rate(sisrua_dxf_generation_duration_seconds_bucket[30d]))`
- **Métrica API:** `histogram_quantile(0.95, rate(sisrua_http_request_duration_seconds_bucket[30d]))`
- **Janela:** Mês calendário completo (00:00 do dia 1 até 23:59 do último dia, BRT).
- **Disponibilidade dos dados:** Dashboard Grafana compartilhado com o cliente ou
  exportação CSV enviada junto ao relatório mensal.

### 4.3 Auditoria de Dados

O cliente pode solicitar, a qualquer momento, a exportação dos dados brutos de
métricas referentes ao mês corrente. O prazo de atendimento é de 5 dias úteis.

---

## 5. Penalidades por Violação de SLA

### 5.1 Tabela de Créditos — SLA-01 (Disponibilidade)

| Disponibilidade mensal efetiva | Crédito sobre a mensalidade |
| ------------------------------ | --------------------------- |
| ≥ 99,5 %                       | 0 % (dentro do SLA)         |
| 99,0 % – 99,49 %               | 10 %                        |
| 98,0 % – 98,99 %               | 20 %                        |
| 95,0 % – 97,99 %               | 30 %                        |
| < 95,0 %                       | 50 %                        |

### 5.2 Tabela de Créditos — SLA-02 (Geração DXF p95)

| p95 latência mensal | Crédito sobre a mensalidade |
| ------------------- | --------------------------- |
| ≤ 120 s             | 0 % (dentro do SLA)         |
| 120 s – 179 s       | 5 %                         |
| 180 s – 299 s       | 15 %                        |
| ≥ 300 s             | 25 %                        |

### 5.3 Tabela de Créditos — SLA-03 (API REST p95)

| p95 latência mensal | Crédito sobre a mensalidade |
| ------------------- | --------------------------- |
| ≤ 2 s               | 0 % (dentro do SLA)         |
| 2 s – 4 s           | 5 %                         |
| 4 s – 9 s           | 10 %                        |
| ≥ 10 s              | 20 %                        |

### 5.4 Acumulação de Créditos

- Os créditos de SLA-01, SLA-02 e SLA-03 são **cumulativos**, limitados ao total
  de **50 %** da mensalidade referente ao mês com violação.
- Créditos são aplicados automaticamente na fatura do mês subsequente.
- Créditos não são convertidos em dinheiro; aplicam-se apenas como desconto em fatura.
- O acúmulo de créditos > 30 % em **3 meses consecutivos** confere ao cliente o
  direito de rescisão contratual sem multa.

### 5.5 Incidentes Críticos (P1)

Independente dos créditos de SLA, incidentes classificados como P1
(indisponibilidade total > 4 horas consecutivas) implicam:

1. Relatório de pós-mortem (RCA) entregue em até 5 dias úteis.
2. Reunião de revisão com o cliente em até 10 dias úteis.
3. Plano de ação preventiva documentado e com prazos comprometidos.

---

## 6. Processo de Reclamação (Claim)

### 6.1 Prazo para Abertura

O cliente deve abrir um claim de SLA em até **15 dias corridos** após o encerramento
do mês em que a violação ocorreu.

### 6.2 Canal de Abertura

Claims devem ser enviados para:

- **E-mail:** `sla-claim@<dominio-sisrua>` _(substituir pelo e-mail real)_
- **Assunto:** `[SLA CLAIM] <Nome do cliente> — <Mês/Ano>`
- **Cópia:** Account Manager do cliente

### 6.3 Informações Obrigatórias no Claim

```
1. Nome da empresa e número do contrato
2. Mês de referência da violação
3. SLA(s) alegadamente violado(s): SLA-01 / SLA-02 / SLA-03
4. Descrição do impacto observado (com horários, se possível)
5. Evidências do lado do cliente (screenshots, logs de erro, jobs impactados)
```

### 6.4 Prazo de Resposta

| Etapa                                | Prazo                                 |
| ------------------------------------ | ------------------------------------- |
| Acuse de recebimento                 | 2 dias úteis                          |
| Análise e posicionamento inicial     | 5 dias úteis                          |
| Resolução (aprovação ou contestação) | 10 dias úteis                         |
| Aplicação do crédito (se aprovado)   | Na fatura do mês seguinte à aprovação |

### 6.5 Contestação

Se o cliente discordar da resolução, pode solicitar arbitragem técnica com apresentação
dos dados de métricas de ambas as partes. O prazo para contestação é de 10 dias após
o posicionamento da equipe sisTOPOGRAFIA.

---

## 7. Relatórios Mensais de SLA

### 7.1 Conteúdo do Relatório

Todo relatório mensal de SLA, enviado até o **5º dia útil do mês seguinte**, deve incluir:

```
[Relatório Mensal de SLA — sisTOPOGRAFIA]
Cliente: <Nome>
Período: MM/YYYY (1º a último dia do mês, BRT)

────────────────────────────────────────────────
SLA-01 — DISPONIBILIDADE
  Target:            99,5 %
  Resultado:         X,XX %
  Minutos offline:   YY min
  Status:            ✓ Cumprido / ✗ Violado
  Incidentes:        N (lista com data, duração, causa)

SLA-02 — GERAÇÃO DXF (p95)
  Target:            ≤ 120 s
  Resultado:         XX,X s (p95)
  Total de jobs:     N
  Jobs fora do SLA:  N (X,X %)
  Status:            ✓ Cumprido / ✗ Violado

SLA-03 — API REST (p95)
  Target:            ≤ 2 s
  Resultado:         X,XX s (p95)
  Total de requests: N
  Status:            ✓ Cumprido / ✗ Violado

────────────────────────────────────────────────
MANUTENÇÕES REALIZADAS
  Programadas:  N (dentro da janela domingo 02:00–04:00)
  Emergenciais: N

CRÉDITOS APLICÁVEIS
  SLA-01: X %
  SLA-02: X %
  SLA-03: X %
  TOTAL:  X % da mensalidade de MM/YYYY

OBSERVAÇÕES
  [Detalhamento de incidentes, ações preventivas, etc.]
────────────────────────────────────────────────
```

### 7.2 Formato e Entrega

- Formato: PDF e planilha CSV com dados brutos.
- Canal: E-mail para contato técnico e financeiro cadastrados no contrato.
- Retenção: Dados brutos mantidos por 24 meses para fins de auditoria.

### 7.3 Dashboard de SLA em Tempo Real

Clientes enterprise têm acesso a um dashboard Grafana somente-leitura com:

- Uptime atual (janela 30 dias rolling).
- Gráfico de disponibilidade diária.
- p95 de latência DXF e API (janela 7 dias e 30 dias).
- Status dos circuit breakers de APIs externas.
- Error budget restante por SLO.

URL: `https://monitoring.<dominio-sisrua>/d/sla-client?org=<ID>` _(configurar por cliente)_

---

## 8. Exclusões e Limitações de Responsabilidade

### 8.1 Eventos Excluídos do Cômputo de SLA

Os seguintes eventos **não** são computados como indisponibilidade ou degradação
para fins deste SLA:

1. **Janelas de manutenção programada** (domingo 02:00–04:00 BRT) comunicadas
   com ≥ 48 h de antecedência.
2. **Manutenção emergencial** (até 4 h mensais), comunicada previamente quando possível.
3. **Força maior:** interrupções de energia, desastres naturais, pandemias, ataques
   cibernéticos de terceiros de larga escala (DDoS), conforme definição legal brasileira.
4. **Incidentes na infraestrutura Google Cloud** com RCA público publicado pelo Google.
5. **Degradação de APIs externas** (IBGE, INDE, OSM, TOPODATA) quando o fallback
   do sistema foi corretamente ativado e o cliente recebeu resposta com flag de aviso.
6. **Abuso / uso fora dos limites contratuais:** requisições acima do volume
   contratado, ataques originados do cliente, uso não autorizado.
7. **Falhas causadas por configurações do cliente** (proxy, firewall, DNS).

### 8.2 Limitação de Responsabilidade

A responsabilidade máxima acumulada por violações de SLA em um único mês
calendário é limitada a **50 %** do valor da mensalidade daquele mês.

A responsabilidade total acumulada em qualquer período de 12 meses consecutivos
não excederá o equivalente a **3 mensalidades** do contrato vigente.

Danos consequenciais, lucros cessantes, danos morais ou outros danos indiretos
não são cobertos por este SLA, sujeito ao disposto no contrato principal.

---

## 9. Hierarquia de Documentos

Em caso de conflito, a ordem de precedência é:

1. **Contrato comercial assinado** (prevalece sobre todos os demais).
2. **Adendos e aditivos contratuais** datados e assinados pelas partes.
3. **Este documento (SLA_CONTRATOS.md)**, incorporado por referência ao contrato.
4. **`SLO_DEFINITIONS.md`** — definições técnicas dos indicadores.
5. **`RUNBOOKS.md`** — procedimentos operacionais internos.

---

_Documento sujeito a revisão trimestral ou mediante alteração de infraestrutura._
_Versão em vigor a partir de: 2026-04-14_
_Próxima revisão programada: 2026-07-14_
