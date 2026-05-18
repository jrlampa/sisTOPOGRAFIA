# FinOps + Stripe Valuation — sisRUA

**Data:** 13 Maio 2026  
**Responsável:** Dev FullStack (FinOps + Stripe)  
**Status:** Proposta de Precificação

---

## 1. VALUATION EXECUTIVA

### 1.1 Visão Geral do Produto

**sisRUA** = Sistema de Exportação Geoespacial OSM → DXF + Análise Topológica (BT/MT)

**Proposta de Valor:**

- ✅ Digitalização de redes (elétrica, transmissão, infraestrutura)
- ✅ Geração automática de CAD 2.5D com elementos cartográficos
- ✅ Análise topológica (postes, trechos, transformadores)
- ✅ Design Generativo para otimização de redes
- ✅ Multi-export (DXF, GeoJSON, CSV, histórico)

**Mercado-alvo:**

- Concessionárias de energia
- Empresas de telecom/infraestrutura
- Órgãos governamentais (planejamento urbano)
- Consultorias de engenharia civil

**Métrica de Valor:**

- Reduz 60-70% do tempo de mapeamento manual
- Custo/ha processada
- Créditos por processamento (quantidade de features)
- Escalabilidade de projetos simultâneos

---

## 2. ESTRUTURA DE TIERS (3 Camadas)

### TIER 1: COMMUNITY (Gratuito / Freemium)

**Público:** Indivíduos, educação, POC

| Feature                         | Limite         | Descrição                                         |
| ------------------------------- | -------------- | ------------------------------------------------- |
| **Análise OSM Básica**          | ✅             | Visualização de features (buildings, roads, etc.) |
| **Estatísticas**                | ✅             | Contagem e métricas básicas                       |
| **Topologia BT/MT (Read-only)** | ✅             | Visualizar estrutura, sem edição                  |
| **Export GeoJSON**              | ✅             | Ilimitado                                         |
| **Export DXF**                  | ❌             | Bloqueado                                         |
| **Export CSV**                  | 100 linhas/mês | Coordenadas básicas                               |
| **Terrain Processing**          | ❌             | Bloqueado                                         |
| **Design Generativo**           | ❌             | Bloqueado                                         |
| **Área máxima**                 | 2 km²          | Raio: ~800m                                       |
| **API Access**                  | ❌             | Bloqueado                                         |
| **Storage Projects**            | 5 projects     | 30 dias retenção                                  |
| **Support**                     | Comunidade     | Email (5 dias resposta)                           |

**Conversão esperada:** 5-10% → Tier Professional

---

### TIER 2: PROFESSIONAL (Recorrente)

**Público:** Pequenas/médias empresas, consultores, startups

**Preço:** R$ 99-150/mês (ou $25-35 USD)

| Feature                 | Limite       | Descrição                           |
| ----------------------- | ------------ | ----------------------------------- |
| **Análise Completa**    | ✅           | Todas as features OSM               |
| **Topologia BT/MT**     | ✅ (R/W)     | Edição completa + cálculos          |
| **Export DXF**          | 20/mês       | CAD 2.5D com cartografia            |
| **Export CSV**          | Ilimitado    | Coordenadas + atributos             |
| **Terrain Processing**  | 5/mês        | Processamento de terreno (contours) |
| **Design Generativo**   | 5/mês        | Rodadas de otimização               |
| **Análise Telescópica** | ✅           | Sugestões automáticas               |
| **Área máxima**         | 50 km²       | Raio: ~4km                          |
| **Projetos Storage**    | Unlimited    | 90 dias retenção                    |
| **Webhooks/Callbacks**  | ✅           | Integração com sistemas             |
| **API Access**          | ✅ (Limited) | 1000 req/mês                        |
| **Support**             | Email + Chat | 24h resposta (horário comercial)    |
| **SLA**                 | 95%          | Uptime garantido                    |

**Retenção alvo:** 70-80%  
**LTV esperado:** R$ 1,500-1,800 (18 meses)

---

### TIER 3: ENTERPRISE (Custom)

**Público:** Grandes concessionárias, governo, multinacionais

**Preço:** Custom (Negociação caso-a-caso, mínimo R$ 500/mês)

| Feature                   | Limite    | Descrição                       |
| ------------------------- | --------- | ------------------------------- |
| **Tudo do Professional**  | ✅        | Feature-complete                |
| **Multi-tenant**          | ✅        | Isolamento de dados por cliente |
| **Export DXF**            | Unlimited | Sem throttling                  |
| **Terrain Processing**    | Unlimited | Processamento contínuo          |
| **Design Generativo**     | Unlimited | Rodadas ilimitadas              |
| **Área máxima**           | Unlimited | Qualquer raio/polígono          |
| **API Access**            | Unlimited | Rate limit custom               |
| **Webhooks**              | ✅        | Ilimitados                      |
| **Processamento Batch**   | ✅        | Fila prioritária                |
| **White-label Option**    | Custom    | Branding próprio                |
| **SSO/SAML**              | ✅        | Integração corporativa          |
| **Relatórios Executivos** | ✅        | Mensal + ad-hoc                 |
| **Suporte Dedicado**      | ✅        | Slack + phone, SLA 4h           |
| **SLA Personalizado**     | 99.5%+    | Uptime customizável             |

**CAC esperado:** R$ 2,000-5,000  
**LTV esperado:** R$ 15,000+ (24 meses)

---

## 3. MODELO DE RECEITA COMPLEMENTAR

### 3.1 Pay-as-You-Go (PAYG)

Além dos tiers recorrentes, oferecer créditos excedentes:

| Recurso                | Preço Unitário        | Descrição               |
| ---------------------- | --------------------- | ----------------------- |
| **DXF Export**         | R$ 10 / cada          | Acima do limite mensal  |
| **Terrain Processing** | R$ 25 / processamento | Contours + análise      |
| **Design Generativo**  | R$ 50 / rodada        | Otimização manual       |
| **API Calls**          | R$ 0.01 / 100 req     | Além do limit           |
| **Storage Extra**      | R$ 5 / 100 MB/mês     | Retenção além do padrão |
| **Priority Queue**     | R$ 100 / mês          | DXF/Terrain prioritário |

### 3.2 One-Time Purchases

- **Consultoria de Setup:** R$ 500 (importação de dados iniciais)
- **Treinamento (Online):** R$ 200/hora
- **Custom Development:** R$ 150/hora

---

## 4. MÉTRICAS DE FINOPS

### 4.1 Infraestrutura por Tier

| Tier             | CPU/req | Memória | Storage | CDN       | Custo AWS/mês |
| ---------------- | ------- | ------- | ------- | --------- | ------------- |
| **Community**    | 100mCPU | 256MB   | 1GB     | Mín       | $15           |
| **Professional** | 500mCPU | 1GB     | 10GB    | 500GB     | $75           |
| **Enterprise**   | 2CPU    | 4GB     | 100GB+  | Ilimitado | $300+         |

### 4.2 Unit Economics (Monthly)

**Assumptions:**

- ARPU Professional: R$ 120
- ARPU Enterprise: R$ 1,500
- Churn Professional: 5%
- Churn Enterprise: 2%

```
Professional:
├─ Revenue/user: R$ 120
├─ COGS (AWS+Python engine): R$ 25 (21%)
├─ Gross Margin: R$ 95 (79%)
├─ Opex (suporte, dev): R$ 40
└─ Contribution Margin: R$ 55 (46%)

Enterprise:
├─ Revenue/user: R$ 1,500
├─ COGS (AWS+ops): R$ 300 (20%)
├─ Gross Margin: R$ 1,200 (80%)
├─ Opex (suporte dedicado): R$ 400
└─ Contribution Margin: R$ 800 (53%)
```

### 4.3 Break-even & Growth

```
Target (2026):
├─ 100 Professional users → R$ 12k/mês
├─ 5 Enterprise users → R$ 7.5k/mês
├─ Total MRR: R$ 19.5k
├─ Fixed Costs: R$ 8k
└─ Profit: R$ 11.5k/mês (59%)

Year-2 Growth (2027):
├─ 300 Professional users → R$ 36k/mês
├─ 20 Enterprise users → R$ 30k/mês
├─ Total MRR: R$ 66k
└─ Profit: R$ 45k/mês (68%)
```

---

## 5. ESTRATÉGIA DE ADOÇÃO

### Fase 1: Community Acquisition (Mês 1-3)

- ✅ Lanço Freemium com limites (2km², 100 CSV lines)
- ✅ Onboarding gratuito (15 min)
- ✅ Target: 200 users

### Fase 2: Professional Conversion (Mês 4-6)

- ✅ Upgrade upsell (usuarios com >2 km² ou >5 projects)
- ✅ Email sequence + in-app prompts
- ✅ Teste A/B de pricing (R$ 99 vs R$ 149)
- ✅ Target: 50 conversões (25%)

### Fase 3: Enterprise Pipeline (Mês 6+)

- ✅ Outreach direto (Aneel, concessionárias)
- ✅ Proof of Concept customizado
- ✅ SLA negociado
- ✅ Target: 3-5 deals no Y2

---

## 6. PRÓXIMOS PASSOS (Implementação)

### ✅ Stripe Setup

1. [ ] Criar 3 produtos Stripe (Community=free, Prof, Enterprise)
2. [ ] Configurar planos e preços
3. [ ] Webhook para sync com DB (stripe→user_tiers)
4. [ ] Metering for PAYG (Stripe Billing)

### ✅ Feature Flags (Role-Based)

1. [ ] Mapeamento de blocklist por tier
2. [ ] Middleware de enforcement (`requireTier()`)
3. [ ] Frontend: UI disabled states

### ✅ Monitoramento

1. [ ] Dashboard de MRR/Churn/CAC
2. [ ] Alertas de anomalias (overuse)
3. [ ] Cost per user por tier

---

## 7. DOCUMENTAÇÃO DE SUPORTE

- **Pricing Page:** `/pricing` (React component)
- **Tier Comparison:** Tabela interativa (Blade 16pt)
- **Billing Portal:** Stripe Customer Portal (gerenciar cartões, invoices)
- **API Docs:** `/api/v1/tiers` (endpoint para frontend saber tier do user)

---

**Aprovado por:** **\_**  
**Válido até:** 30 Junho 2026
