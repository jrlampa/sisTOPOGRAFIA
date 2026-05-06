# Playbook de Incidentes Regulatórios (LGPD) — sisTOPOGRAFIA

> **Roadmap Item 39 [T1] — Playbook de Incidentes Regulatórios**
>
> Este playbook define os procedimentos a seguir em caso de incidente de segurança
> que envolva dados pessoais, em conformidade com a Lei Geral de Proteção de Dados
> (Lei nº 13.709/2018 — LGPD) e as Resoluções da ANPD, especialmente o prazo de
> **72 horas** para comunicação de incidentes relevantes previsto no Art. 48 da LGPD.

**Versão:** 1.0.0
**Data de emissão:** 2026-04-14
**Revisão programada:** 2026-07-14 (semestral mínimo)
**Proprietário:** DPO (Encarregado de Proteção de Dados)
**Classificação:** Uso interno — confidencial

---

## Sumário

1. [Bases Legais e Referências Normativas](#1-bases-legais-e-referências-normativas)
2. [Tipos de Incidente e Critérios de Severidade](#2-tipos-de-incidente-e-critérios-de-severidade)
3. [Fluxo Geral de Resposta a Incidentes](#3-fluxo-geral-de-resposta-a-incidentes)
4. [Processo de Notificação à ANPD](#4-processo-de-notificação-à-anpd)
5. [Template de Comunicação à ANPD](#5-template-de-comunicação-à-anpd)
6. [Template de Notificação aos Titulares Afetados](#6-template-de-notificação-aos-titulares-afetados)
7. [Processo de Contenção e Remediação](#7-processo-de-contenção-e-remediação)
8. [Trilha de Evidências para Auditoria](#8-trilha-de-evidências-para-auditoria)
9. [Contatos Essenciais](#9-contatos-essenciais)
10. [Apêndice: Categorização de Dados Pessoais no Sistema](#10-apêndice-categorização-de-dados-pessoais-no-sistema)

---

## 1. Bases Legais e Referências Normativas

| Norma                     | Artigo/Resolução | Obrigação                                                                                                                      |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| LGPD — Lei nº 13.709/2018 | Art. 48          | Comunicar à ANPD incidente que possa acarretar risco ou dano relevante em prazo razoável (ANPD fixou 72 h para casos críticos) |
| LGPD                      | Art. 48, § 1º    | Informar: natureza dos dados, titulares afetados, medidas técnicas e de segurança adotadas, riscos, medidas tomadas            |
| LGPD                      | Art. 46          | Adotar medidas de segurança técnicas e administrativas                                                                         |
| LGPD                      | Art. 41          | Indicar Encarregado (DPO) com dados de contato públicos                                                                        |
| Resolução ANPD nº 4/2023  | Art. 5º          | Prazo de 72 h a partir do conhecimento do incidente para notificação preliminar                                                |
| Resolução ANPD nº 4/2023  | Art. 6º          | Conteúdo mínimo da comunicação preliminar                                                                                      |
| Resolução ANPD nº 4/2023  | Art. 7º          | Complementação em até 30 dias                                                                                                  |

> **Atenção:** O prazo de 72 horas conta a partir do **momento em que o agente de
> tratamento toma conhecimento** do incidente — não da data em que ele ocorreu.

---

## 2. Tipos de Incidente e Critérios de Severidade

### 2.1 Classificação de Incidentes

| Tipo       | Descrição                                      | Exemplo no sisTOPOGRAFIA                                                                  |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Tipo A** | Acesso não autorizado a dados pessoais         | Credenciais de banco expostas; acesso à tabela de usuários por ator não autorizado        |
| **Tipo B** | Vazamento/exfiltração de dados pessoais        | Dump de usuários publicado externamente; API endpoint retornando dados de outros usuários |
| **Tipo C** | Alteração indevida de dados pessoais           | Dados de localização ou projetos modificados sem autorização do titular                   |
| **Tipo D** | Destruição/perda de dados pessoais             | Deleção acidental de dados sem backup; corrupção de banco                                 |
| **Tipo E** | Indisponibilidade prolongada de dados pessoais | Ransomware; falha de infraestrutura sem RTO atendido                                      |
| **Tipo F** | Uso indevido por insider                       | Acesso de funcionário a dados além de suas permissões RBAC                                |

### 2.2 Critérios de Severidade LGPD

| Severidade          | Critérios                                                                                                                                   | Notificação ANPD                                    | Notificação Titulares |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------- |
| **SEV-1 (Crítico)** | > 500 titulares afetados; OU dados sensíveis expostos (localização precisa, dados financeiros, saúde); OU acesso por ator externo malicioso | **72 horas** (obrigatória)                          | Imediata / 72 horas   |
| **SEV-2 (Alto)**    | 50–500 titulares; OU dados pessoais comuns com potencial de dano real                                                                       | **72 horas** (provável obrigação — avaliar com DPO) | 72 horas              |
| **SEV-3 (Médio)**   | < 50 titulares; dados não sensíveis; baixo risco de dano                                                                                    | 7 dias (avaliar com DPO)                            | Caso a caso           |
| **SEV-4 (Baixo)**   | Sem dados pessoais comprometidos; incidente técnico sem impacto a titulares                                                                 | Não obrigatória (registrar internamente)            | Não aplicável         |

> **Dúvida sobre severidade?** Tratar como SEV-1 até avaliação do DPO. É melhor
> notificar desnecessariamente do que deixar de notificar.

### 2.3 Dados Pessoais Processados pelo sisTOPOGRAFIA

| Categoria                | Dados                                               | Sensibilidade                                                                                |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Identificação de usuário | E-mail, nome, ID de conta                           | Pessoal comum                                                                                |
| Localização geográfica   | Coordenadas GPS dos projetos                        | **Potencialmente sensível** (Art. 11 LGPD — pode inferir localização de residência/trabalho) |
| Dados operacionais       | Histórico de projetos DXF, parâmetros de cálculo BT | Pessoal comum                                                                                |
| Logs de acesso           | IP, timestamps de sessão                            | Pessoal comum                                                                                |
| Dados de autenticação    | Hash de senha (nunca em texto claro), tokens JWT    | Pessoal — alto impacto se comprometido                                                       |

---

## 3. Fluxo Geral de Resposta a Incidentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 1 — DETECÇÃO E TRIAGEM                                  [0–2 horas] │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Qualquer membro da equipe detecta/reporta suspeita de incidente      │
│  2. Acionar o responsável de segurança (on-call SRE)                     │
│  3. Abrir ticket de incidente LGPD no sistema interno                    │
│  4. Fazer triagem inicial: há dados pessoais envolvidos? (S/N)           │
│     → Não: seguir runbook técnico (RUNBOOKS.md)                          │
│     → Sim: continuar este playbook                                       │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 2 — AVALIAÇÃO INICIAL                                   [2–6 horas] │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Notificar DPO imediatamente (telefonema + e-mail)                    │
│  2. DPO classifica severidade (SEV-1 a SEV-4)                            │
│  3. Ativar time de resposta conforme severidade:                         │
│     SEV-1/2: DPO + Tech Lead + Jurídico + CEO                            │
│     SEV-3/4: DPO + Tech Lead                                             │
│  4. Iniciar coleta de evidências (NUNCA apagar logs)                     │
│  5. Isolar sistemas afetados se necessário (ver seção 7)                 │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 3 — CONTENÇÃO                                           [6–24 horas] │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Aplicar medidas de contenção (revogar credenciais, isolar serviço)   │
│  2. Determinar escopo exato: quais dados? Quantos titulares? Período?    │
│  3. Documentar todas as ações com timestamps                             │
│  4. Para SEV-1: iniciar preparação da notificação ANPD (prazo 72h)       │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 4 — NOTIFICAÇÃO                                     [24–72 horas]   │
├─────────────────────────────────────────────────────────────────────────┤
│  SEV-1/2: Notificar ANPD (até 72h) — ver seção 4 e 5                     │
│  SEV-1/2: Notificar titulares afetados — ver seção 6                     │
│  Todos: Registrar no Registro de Incidentes interno                      │
└─────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 5 — REMEDIAÇÃO E ENCERRAMENTO                       [após 72 horas] │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Aplicar correções técnicas definitivas                               │
│  2. Testes de regressão de segurança                                     │
│  3. Relatório complementar à ANPD (até 30 dias — se SEV-1/2)            │
│  4. RCA interno com lições aprendidas                                    │
│  5. Encerrar ticket de incidente                                         │
│  6. Atualizar DPIA/ROPA se necessário                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Cronômetro de 72 Horas

```
T+0h   → Momento de tomada de conhecimento do incidente
T+2h   → DPO notificado e triagem concluída
T+6h   → Contenção inicial aplicada, escopo preliminar estimado
T+24h  → Escopo confirmado, template ANPD em preparação
T+48h  → Revisão jurídica da comunicação ANPD
T+72h  → ⏰ PRAZO MÁXIMO para envio à ANPD (SEV-1)
T+72h  → ⏰ PRAZO MÁXIMO para notificação inicial aos titulares (SEV-1)
```

---

## 4. Processo de Notificação à ANPD

### 4.1 Portal de Comunicação

A comunicação deve ser realizada pelo portal oficial da ANPD:

- **URL:** https://www.gov.br/anpd/pt-br/comunicacao-de-incidente-de-seguranca
- **Acesso:** Via certificado digital (e-CNPJ ou e-CPF do responsável legal)
- **Formulário:** "Comunicação de Incidente de Segurança com Dados Pessoais"

### 4.2 Informações Obrigatórias (Art. 48 LGPD + Res. ANPD 4/2023)

**Comunicação Preliminar (até 72 horas):**

| Campo                         | Descrição                                       |
| ----------------------------- | ----------------------------------------------- |
| Dados do agente de tratamento | CNPJ, Razão Social, dados do DPO                |
| Natureza do incidente         | Tipo (acesso, vazamento, alteração, destruição) |
| Dados afetados                | Categorias de dados e titulares envolvidos      |
| Número de titulares           | Estimativa (pode ser atualizado depois)         |
| Momento do incidente          | Data/hora de ocorrência e de conhecimento       |
| Provável causa                | Hipótese de causa raiz (pode ser preliminar)    |
| Consequências prováveis       | Riscos aos titulares                            |
| Medidas adotadas              | O que foi feito para conter e mitigar           |

**Complementação (até 30 dias após a comunicação preliminar):**

- Confirmação ou atualização de todos os campos acima.
- Análise de risco completa (DPIA do incidente).
- Medidas técnicas e organizacionais implementadas definitivamente.
- Resultado das notificações aos titulares.

### 4.3 Decisão de Notificar

```
O incidente envolve dados pessoais?
├─ NÃO → Registrar internamente; não há obrigação LGPD
└─ SIM → Continuar avaliação

O incidente pode acarretar RISCO OU DANO relevante aos titulares?
Critérios de risco relevante:
  - Discriminação
  - Dano financeiro
  - Dano à reputação
  - Fraude ou roubo de identidade
  - Exposição de localização física
  - Perda de controle sobre dados pessoais
├─ NÃO → Registrar internamente; avaliar com DPO se comunicação é prudente
└─ SIM → Notificar ANPD obrigatoriamente
```

---

## 5. Template de Comunicação à ANPD

```
════════════════════════════════════════════════════════════════════════
COMUNICAÇÃO DE INCIDENTE DE SEGURANÇA — LGPD ART. 48
Notificação Preliminar
════════════════════════════════════════════════════════════════════════

DATA DE ENVIO: DD/MM/AAAA HH:MM (BRT)
PROTOCOLO INTERNO: INC-LGPD-AAAA-NNN

────────────────────────────────────────────────────────────────────────
PARTE I — IDENTIFICAÇÃO DO AGENTE DE TRATAMENTO
────────────────────────────────────────────────────────────────────────

Razão Social:        [RAZÃO SOCIAL DA EMPRESA]
CNPJ:                [XX.XXX.XXX/0001-XX]
Endereço:            [RUA, Nº, CIDADE-UF, CEP]
Setor de atuação:    Tecnologia / Geoprocessamento / Engenharia

Encarregado (DPO):
  Nome:              [NOME DO DPO]
  E-mail:            [dpo@empresa.com.br]
  Telefone:          [+55 XX XXXXX-XXXX]

Representante legal para este incidente:
  Nome:              [NOME]
  Cargo:             [CARGO]
  E-mail:            [email@empresa.com.br]

────────────────────────────────────────────────────────────────────────
PARTE II — DESCRIÇÃO DO INCIDENTE
────────────────────────────────────────────────────────────────────────

Tipo de incidente:
  [  ] Acesso não autorizado
  [  ] Divulgação/vazamento indevido
  [  ] Alteração não autorizada
  [  ] Destruição/perda
  [  ] Outro: _______________

Data/hora de ocorrência (estimada):   DD/MM/AAAA HH:MM (BRT)
Data/hora de conhecimento:            DD/MM/AAAA HH:MM (BRT)
Descoberta por:                       [ex: monitoramento automático / comunicação de terceiro]

Descrição do incidente:
  [Descrição objetiva e técnica do ocorrido. Exemplo:
   "Em DD/MM/AAAA às HH:MM, foi detectado acesso não autorizado ao banco de dados
   PostgreSQL da plataforma sisTOPOGRAFIA, via credencial comprometida. O acesso
   permitiu leitura da tabela 'users' e 'projects'. Não foram identificadas
   alterações ou deleções de dados."]

Causa provável (preliminar):
  [Exemplo: "Comprometimento de credencial de serviço via phishing. Investigação
   em andamento para confirmação."]

────────────────────────────────────────────────────────────────────────
PARTE III — DADOS PESSOAIS AFETADOS
────────────────────────────────────────────────────────────────────────

Categorias de dados afetados:
  [  ] Dados de identificação (nome, e-mail, CPF)
  [  ] Dados de localização geográfica
  [  ] Dados de autenticação (senhas hash, tokens)
  [  ] Histórico de projetos e coordenadas georreferenciadas
  [  ] Logs de acesso (IP, timestamps)
  [  ] Outros: _______________

Número estimado de titulares afetados:   [NÚMERO ou "Em apuração"]
Perfil dos titulares:                    [Ex: usuários cadastrados da plataforma;
                                          clientes enterprise; funcionários]

Dados sensíveis envolvidos (Art. 11 LGPD)?
  [  ] Sim — categorias: _______________
  [  ] Não
  [  ] Em investigação

────────────────────────────────────────────────────────────────────────
PARTE IV — CONSEQUÊNCIAS E RISCOS
────────────────────────────────────────────────────────────────────────

Consequências prováveis para os titulares:
  [Descrever riscos concretos. Exemplo: "Risco de uso indevido de e-mails para
   spam/phishing; risco de correlação de localização geográfica de projetos com
   endereços residenciais de clientes."]

Avaliação de risco (preliminar):
  [  ] Alto — danos graves ou irreversíveis possíveis
  [  ] Médio — danos reversíveis ou com baixa probabilidade de materializção
  [  ] Baixo — risco residual mínimo

────────────────────────────────────────────────────────────────────────
PARTE V — MEDIDAS ADOTADAS
────────────────────────────────────────────────────────────────────────

Medidas de contenção imediatas (já implementadas):
  1. [Ex: Revogação das credenciais comprometidas às HH:MM de DD/MM/AAAA]
  2. [Ex: Isolamento do serviço afetado]
  3. [Ex: Ativação do registro completo de auditoria]

Medidas de remediação em andamento:
  1. [Ex: Análise forense para determinar escopo completo]
  2. [Ex: Rotação de todas as credenciais de serviço]
  3. [Ex: Revisão das políticas de controle de acesso]

Os titulares foram/serão notificados?
  [  ] Sim — data prevista: DD/MM/AAAA
  [  ] Não — justificativa: _______________
  [  ] Em avaliação

────────────────────────────────────────────────────────────────────────
PARTE VI — DECLARAÇÃO
────────────────────────────────────────────────────────────────────────

Declaro, sob as penas da lei, que as informações acima são verdadeiras
ao melhor do meu conhecimento na data deste envio, e que a organização
se compromete a:

1. Complementar esta comunicação em até 30 dias com informações adicionais.
2. Cooperar com a ANPD em eventuais solicitações de informação.
3. Notificar os titulares afetados conforme determinação da ANPD.

[NOME DO REPRESENTANTE LEGAL / DPO]
[CARGO]
[DATA E ASSINATURA DIGITAL]

════════════════════════════════════════════════════════════════════════
```

---

## 6. Template de Notificação aos Titulares Afetados

```
────────────────────────────────────────────────────────────────────────
NOTIFICAÇÃO DE INCIDENTE DE SEGURANÇA — LGPD
────────────────────────────────────────────────────────────────────────

Assunto: [IMPORTANTE] Aviso de Segurança — sisTOPOGRAFIA

Prezado(a) [NOME DO TITULAR ou "Usuário(a)"],

Comunicamos que identificamos um incidente de segurança que pode ter
afetado seus dados pessoais na plataforma sisTOPOGRAFIA.

■ O QUE ACONTECEU?
[Descrever o incidente de forma clara e não técnica.
Exemplo: "Em [data], identificamos um acesso não autorizado ao nosso
sistema que pode ter exposto algumas informações de contas de usuários,
incluindo endereços de e-mail e coordenadas geográficas de projetos
cadastrados."]

■ QUAIS DADOS PODEM TER SIDO AFETADOS?
[  ] Seu endereço de e-mail cadastrado
[  ] Dados de localização geográfica de seus projetos
[  ] Seu histórico de projetos na plataforma
[  ] Outros: [especificar]

Informamos que senhas nunca são armazenadas em texto claro em nosso
sistema — apenas hashes criptográficos são mantidos.

■ O QUE FIZEMOS?
Assim que identificamos o incidente, tomamos as seguintes medidas:
1. [Medida de contenção 1]
2. [Medida de contenção 2]
3. Notificamos a Autoridade Nacional de Proteção de Dados (ANPD)
   conforme exige a Lei Geral de Proteção de Dados (LGPD).

■ O QUE VOCÊ DEVE FAZER?
Por precaução, recomendamos:
1. Alterar sua senha na plataforma sisTOPOGRAFIA imediatamente.
   → Acesse: <URL> → "Minha conta" → "Alterar senha"
2. Ativar a autenticação em dois fatores (2FA) se disponível.
3. Estar atento(a) a e-mails suspeitos ou tentativas de phishing que
   mencionem seus dados ou projetos.
4. Se identificar uso indevido dos seus dados, contate-nos imediatamente.

■ SEUS DIREITOS (LGPD — Art. 18)
Você tem direito a:
- Confirmar a existência de tratamento dos seus dados
- Acessar seus dados pessoais
- Solicitar a correção de dados incompletos ou desatualizados
- Solicitar a eliminação dos seus dados

Para exercer seus direitos: [dpo@empresa.com.br]

■ FALE CONOSCO
DPO (Encarregado de Proteção de Dados): [dpo@empresa.com.br]
Suporte: [suporte@empresa.com.br]
Telefone: [+55 XX XXXXX-XXXX]
Horário de atendimento: Segunda a sexta, 08:00–18:00 BRT

Lamentamos sinceramente qualquer transtorno causado por este incidente
e reafirmamos nosso compromisso com a proteção dos seus dados pessoais.

Atenciosamente,
[NOME DO DPO]
Encarregado de Proteção de Dados — sisTOPOGRAFIA
[Data]
────────────────────────────────────────────────────────────────────────
```

---

## 7. Processo de Contenção e Remediação

### 7.1 Ações de Contenção Imediata

**Para incidente de acesso não autorizado:**

```bash
# 1. Revogar credenciais suspeitas (Supabase)
# Via painel Supabase → Settings → API → Invalidar anon/service_role key
# Gerar novas chaves imediatamente

# 2. Revogar tokens JWT ativos (se possível)
# Incrementar JWT secret para invalidar todos os tokens em circulação:
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars JWT_SECRET=$(openssl rand -hex 32)

# 3. Ativar registro de auditoria ampliado
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars LOG_LEVEL=debug \
  --set-env-vars AUDIT_MODE=full

# 4. Se necessário, colocar o serviço em modo de manutenção
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --set-env-vars MAINTENANCE_MODE=true
```

**Para vazamento de dados:**

```bash
# 1. Identificar o vetor de exfiltração nos logs
gcloud logging read \
  'resource.type="cloud_run_revision" AND
   resource.labels.service_name="sisrua-app" AND
   httpRequest.status=200 AND
   httpRequest.responseSize>1000000' \
  --freshness 24h \
  --format "value(timestamp, httpRequest.remoteIp, httpRequest.requestUrl, httpRequest.responseSize)"

# 2. Bloquear IPs suspeitos (via Cloud Armor se configurado):
gcloud compute security-policies rules create 1000 \
  --security-policy sisrua-waf \
  --expression "inIpRange(origin.ip, '<IP_SUSPEITO>/32')" \
  --action deny-403

# 3. Exportar logs para preservação de evidências
gcloud logging read \
  'resource.type="cloud_run_revision"' \
  --freshness 72h \
  --format json > /tmp/incident_logs_$(date +%Y%m%d_%H%M%S).json
```

### 7.2 Ações de Remediação Definitiva

| Vetor                                       | Remediação                                                         |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Credenciais comprometidas                   | Rotação de todas as secrets; ativar MFA para acesso administrativo |
| Vulnerabilidade em endpoint                 | Hotfix + deploy; bloquear o endpoint até a correção                |
| Injeção SQL / acesso não autorizado a dados | Corrigir query; implementar RLS (Row Level Security) no Supabase   |
| Exposição de variáveis de ambiente          | Rotação de todas as variáveis secretas; auditoria de logs de CI/CD |
| Acesso de insider                           | Revogar acesso; notificar RH; revisão completa de RBAC             |

---

## 8. Trilha de Evidências para Auditoria

### 8.1 O Que Coletar e Preservar

Toda evidência deve ser coletada **antes** de qualquer ação de remediação que
possa alterá-la. A regra de ouro é: **coletar antes de corrigir**.

| Evidência                                         | Fonte                           | Retenção                        |
| ------------------------------------------------- | ------------------------------- | ------------------------------- |
| Logs de acesso HTTP (Cloud Run)                   | Google Cloud Logging            | 180 dias                        |
| Logs de banco de dados (pg_audit)                 | Supabase / PostgreSQL           | 180 dias                        |
| Logs de autenticação                              | Supabase Auth logs              | 180 dias                        |
| Snapshots de banco (pré-incidente)                | Supabase backups                | Permanente durante investigação |
| Métricas Prometheus do período                    | Grafana/Prometheus              | 90 dias                         |
| E-mails e comunicações internas sobre o incidente | E-mail corporativo              | 5 anos                          |
| Notificações ANPD enviadas                        | PDF exportado do portal ANPD    | 5 anos                          |
| Comunicações aos titulares                        | E-mail + confirmação de entrega | 5 anos                          |
| Registros de ações de contenção (com timestamps)  | Ticket de incidente             | 5 anos                          |
| Análise forense (se aplicável)                    | Relatório técnico               | 5 anos                          |

### 8.2 Cadeia de Custódia

```
1. Responsável pela coleta:       [nome + cargo]
2. Data/hora da coleta:           DD/MM/AAAA HH:MM BRT
3. Hash SHA-256 do arquivo:       [hash]
4. Armazenamento:                 [local seguro — ex: bucket GCS com Object Lock]
5. Acesso autorizado:             DPO + Tech Lead + Jurídico
6. Transferência para jurídico:   [data, forma, protocolo de entrega]
```

### 8.3 Registro de Incidente LGPD

Cada incidente deve gerar um registro permanente no formato:

```yaml
# Arquivo: incidents/LGPD/INC-LGPD-AAAA-NNN.yaml
id: INC-LGPD-2026-001
titulo: "Descrição breve"
data_ocorrencia: 2026-XX-XX
data_conhecimento: 2026-XX-XX
data_encerramento: 2026-XX-XX
severidade: SEV-1 | SEV-2 | SEV-3 | SEV-4
tipo: A | B | C | D | E | F
titulares_afetados: 0
dados_afetados:
  - categoria: "ex: e-mail"
    quantidade: N
notificacao_anpd:
  enviada: true | false
  data: 2026-XX-XX
  protocolo_anpd: "XXXXXXXX"
notificacao_titulares:
  enviada: true | false
  data: 2026-XX-XX
  quantidade_notificados: N
causa_raiz: "descrição"
acoes_corretivas:
  - descricao: "ação"
    responsavel: "nome"
    prazo: 2026-XX-XX
    status: pendente | concluida
lições_aprendidas: "texto"
dpo_responsavel: "nome"
```

---

## 9. Contatos Essenciais

> **Nota de segurança:** Esta seção não deve conter dados de contato reais em
> arquivos versionados publicamente. Preencha os valores em um arquivo separado
> não versionado (`contacts/lgpd_contacts.yaml`) ou em um cofre de secrets.

| Função                          | Titular              | E-mail                      | Telefone            |
| ------------------------------- | -------------------- | --------------------------- | ------------------- |
| **DPO (Encarregado)**           | [NOME DO DPO]        | [dpo@empresa.com.br]        | [+55 XX XXXXX-XXXX] |
| **Tech Lead**                   | [NOME]               | [techlead@empresa.com.br]   | [+55 XX XXXXX-XXXX] |
| **SRE On-Call**                 | Rotação              | [oncall@empresa.com.br]     | [+55 XX XXXXX-XXXX] |
| **Jurídico Interno**            | [NOME]               | [juridico@empresa.com.br]   | [+55 XX XXXXX-XXXX] |
| **Escritório Jurídico Externo** | [NOME DO ESCRITÓRIO] | [contato@escritorio.com.br] | [+55 XX XXXX-XXXX]  |
| **CEO / Representante Legal**   | [NOME]               | [ceo@empresa.com.br]        | [+55 XX XXXXX-XXXX] |

**ANPD — Autoridade Nacional de Proteção de Dados:**

| Canal                | Informação                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Portal de incidentes | https://www.gov.br/anpd/pt-br/comunicacao-de-incidente-de-seguranca                                |
| Site oficial         | https://www.gov.br/anpd                                                                            |
| Ouvidoria            | https://www.gov.br/anpd/pt-br/canais_atendimento/ouvidoria                                         |
| Endereço             | SCS Quadra 9, Bloco C, Ed. Parque Cidade Corporate Torre C, 10º andar — Brasília/DF, CEP 70308-200 |

---

## 10. Apêndice: Categorização de Dados Pessoais no Sistema

### 10.1 Mapeamento de Dados (ROPA simplificado)

| Dado                     | Tabela/Coleção           | Base legal (LGPD)                | Retenção         | Sensível?             |
| ------------------------ | ------------------------ | -------------------------------- | ---------------- | --------------------- |
| E-mail                   | `auth.users` (Supabase)  | Execução de contrato (Art. 7, V) | Duração da conta | Não                   |
| Nome de usuário          | `auth.users`             | Execução de contrato             | Duração da conta | Não                   |
| Hash de senha            | `auth.users`             | Execução de contrato             | Duração da conta | Não (hash)            |
| Coordenadas de projetos  | `projects`, `bt_history` | Execução de contrato             | 5 anos           | **Sim** (localização) |
| Parâmetros de cálculo BT | `bt_history`             | Execução de contrato             | 5 anos           | Não                   |
| IP de acesso             | Cloud Run logs           | Legítimo interesse (Art. 7, IX)  | 90 dias          | Não                   |
| Timestamp de acesso      | Cloud Run logs           | Legítimo interesse               | 90 dias          | Não                   |
| Jobs DXF (metadados)     | `dxf_jobs`               | Execução de contrato             | 30 dias          | Não                   |

### 10.2 Subprocessadores de Dados

| Subprocessador                | Dado compartilhado                  | País                                     | Instrumento legal                 |
| ----------------------------- | ----------------------------------- | ---------------------------------------- | --------------------------------- |
| Google Cloud (Cloud Run, GCS) | Todos os dados processados          | EUA / Brasil (região southamerica-east1) | DPA Google Cloud                  |
| Supabase                      | Dados de usuário e projetos         | EUA (AWS us-east-1)                      | DPA Supabase                      |
| IBGE (API pública)            | Coordenadas geográficas de consulta | Brasil                                   | Dado público — sem DPA necessário |
| OSM/Nominatim                 | Coordenadas geográficas de consulta | Alemanha                                 | Dado público — sem DPA necessário |

---

_Documento mantido pelo DPO. Revisar após cada incidente SEV-1/SEV-2 e semestralmente._
_Manter em sincronia com o DPIA e o ROPA do sistema._
_Última atualização: 2026-04-14_
