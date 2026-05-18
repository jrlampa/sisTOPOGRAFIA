# Feature Flags Matrix — sisRUA

**Data:** 13 Maio 2026  
**Escopo:** Mapeamento de funcionalidades bloqueáveis por tier/role  
**Formato:** Matriz de controle (LISTA APENAS — sem implementação)

---

## 1. CATEGORIAS DE FEATURES

### 1.1 Export & File Operations

| ID          | Feature                  | Community         | Professional | Enterprise   | Notas                                   |
| ----------- | ------------------------ | ----------------- | ------------ | ------------ | --------------------------------------- |
| **EXP-001** | Export DXF               | ❌ BLOCKED        | ✅ 20/mês    | ✅ Unlimited | Arquivo CAD 2.5D com cartografia        |
| **EXP-002** | Export GeoJSON           | ✅ Unlimited      | ✅ Unlimited | ✅ Unlimited | Dados geoespaciais em JSON              |
| **EXP-003** | Export CSV (Coordenadas) | ⚠️ 100 linhas/mês | ✅ Unlimited | ✅ Unlimited | Formato tabular de pontos               |
| **EXP-004** | Export BT History (JSON) | ❌ BLOCKED        | ✅ Unlimited | ✅ Unlimited | Histórico de edições topologia          |
| **EXP-005** | Export BT History (CSV)  | ❌ BLOCKED        | ✅ Unlimited | ✅ Unlimited | Histórico em formato tabular            |
| **EXP-006** | Project Save to Cloud    | ✅ 5 projects     | ✅ Unlimited | ✅ Unlimited | Persistência em DB                      |
| **EXP-007** | Project Load from Cloud  | ✅ Sim            | ✅ Sim       | ✅ Sim       | Recuperação de projetos salvos          |
| **EXP-008** | Batch Export (API)       | ❌ BLOCKED        | ❌ BLOCKED   | ✅ Sim       | Processamento paralelo de múltiplos DXF |

---

### 1.2 Analysis & Computation

| ID          | Feature                           | Community  | Professional | Enterprise   | Notas                                         |
| ----------- | --------------------------------- | ---------- | ------------ | ------------ | --------------------------------------------- |
| **ANA-001** | OSM Feature Parsing               | ✅ Sim     | ✅ Sim       | ✅ Sim       | Leitura básica de features (buildings, roads) |
| **ANA-002** | Topology Analysis BT (Read)       | ✅ Sim     | ✅ Sim       | ✅ Sim       | Visualizar estrutura (postes/trechos)         |
| **ANA-003** | Topology Analysis BT (Write/Edit) | ❌ BLOCKED | ✅ Sim       | ✅ Sim       | Editar postes, trechos, validar               |
| **ANA-004** | BT Calculate (validação)          | ❌ BLOCKED | ✅ Sim       | ✅ Sim       | Cálculos de comprimento, conectividade        |
| **ANA-005** | Topology Analysis MT (Read)       | ✅ Sim     | ✅ Sim       | ✅ Sim       | Visualizar MT (transformadores/redes)         |
| **ANA-006** | Topology Analysis MT (Write/Edit) | ❌ BLOCKED | ✅ Sim       | ✅ Sim       | Editar MT, vincular à rede                    |
| **ANA-007** | MT Calculate (validação)          | ❌ BLOCKED | ✅ Sim       | ✅ Sim       | Cálculos de tensão, capacidade                |
| **ANA-008** | Terrain Processing                | ❌ BLOCKED | ⚠️ 5/mês     | ✅ Unlimited | Contours + DEM processing                     |
| **ANA-009** | Telescopic Analysis (Sugestões)   | ❌ BLOCKED | ✅ Sim       | ✅ Sim       | Análise automática de otimizações             |

---

### 1.3 Design Generativo (DG)

| ID         | Feature                | Community  | Professional   | Enterprise   | Notas                             |
| ---------- | ---------------------- | ---------- | -------------- | ------------ | --------------------------------- |
| **DG-001** | DG Read Context        | ❌ BLOCKED | ✅ Sim         | ✅ Sim       | Acessar resultado de otimizações  |
| **DG-002** | DG Optimization (run)  | ❌ BLOCKED | ⚠️ 5/mês       | ✅ Unlimited | Rodada de otimização automática   |
| **DG-003** | DG Apply Single        | ❌ BLOCKED | ✅ (com limit) | ✅ Sim       | Aplicar sugestão individual       |
| **DG-004** | DG Apply All           | ❌ BLOCKED | ✅ (com limit) | ✅ Sim       | Aplicar todas sugestões de rodada |
| **DG-005** | DG Scenario: As-Is     | ❌ BLOCKED | ✅ Sim         | ✅ Sim       | Visualizar rede atual             |
| **DG-006** | DG Scenario: Projected | ❌ BLOCKED | ✅ Sim         | ✅ Sim       | Visualizar rede otimizada         |

---

### 1.4 Data Management & Admin

| ID          | Feature                 | Community  | Professional        | Enterprise   | Notas                          |
| ----------- | ----------------------- | ---------- | ------------------- | ------------ | ------------------------------ |
| **MGT-001** | Reset Topology          | ❌ BLOCKED | ✅ Sim              | ✅ Sim       | Limpar todos os dados BT/MT    |
| **MGT-002** | Undo/Redo               | ✅ Sim     | ✅ Sim              | ✅ Sim       | Histórico local (session)      |
| **MGT-003** | Change Project Settings | ❌ BLOCKED | ✅ Sim              | ✅ Sim       | Alterar locale, modo de edição |
| **MGT-004** | Storage Quota View      | ✅ 1GB     | ✅ 10GB             | ✅ Unlimited | Dashboard de uso               |
| **MGT-005** | Usage Analytics         | ❌ BLOCKED | ✅ Dashboard básico | ✅ Avançado  | Relatórios de atividade        |

---

### 1.5 API & Integrations

| ID          | Feature           | Community  | Professional    | Enterprise   | Notas                                  |
| ----------- | ----------------- | ---------- | --------------- | ------------ | -------------------------------------- |
| **API-001** | REST API Access   | ❌ BLOCKED | ⚠️ 1000 req/mês | ✅ Unlimited | `/api/v1/*` endpoints                  |
| **API-002** | Webhooks          | ❌ BLOCKED | ✅ Sim          | ✅ Unlimited | Eventos de job completion, export done |
| **API-003** | Callbacks (Async) | ❌ BLOCKED | ✅ Sim          | ✅ Sim       | Notificação HTTP POST de resultado     |
| **API-004** | OAuth2 / SAML     | ❌ BLOCKED | ❌ BLOCKED      | ✅ Sim       | Integração SSO corporativa             |
| **API-005** | API Key Rotation  | ❌ BLOCKED | ✅ 5 keys       | ✅ Unlimited | Múltiplas API keys p/ app              |

---

### 1.6 Mapping & Visualization

| ID          | Feature                         | Community  | Professional | Enterprise | Notas                        |
| ----------- | ------------------------------- | ---------- | ------------ | ---------- | ---------------------------- |
| **MAP-001** | Base Layer (OSM)                | ✅ Sim     | ✅ Sim       | ✅ Sim     | Mapa base OpenStreetMap      |
| **MAP-002** | Custom Map Styles               | ❌ BLOCKED | ❌ BLOCKED   | ✅ Sim     | White-label cartography      |
| **MAP-003** | Focus Mode                      | ✅ Sim     | ✅ Sim       | ✅ Sim     | Zoom automático em seleção   |
| **MAP-004** | Layer Toggle (Buildings, Roads) | ✅ Sim     | ✅ Sim       | ✅ Sim     | Mostrar/ocultar camadas      |
| **MAP-005** | Coordinate Grid                 | ❌ BLOCKED | ✅ Sim       | ✅ Sim     | Grade de coordenadas no mapa |

---

### 1.7 Support & Service

| ID          | Feature            | Community     | Professional         | Enterprise   | Notas                |
| ----------- | ------------------ | ------------- | -------------------- | ------------ | -------------------- |
| **SUP-001** | Email Support      | ✅ Comunidade | ✅ 24h               | ✅ 4h SLA    | Resposta garantida   |
| **SUP-002** | Chat Support       | ❌ BLOCKED    | ✅ Horário comercial | ✅ 24/7      | Live chat ou Slack   |
| **SUP-003** | Documentation      | ✅ Sim        | ✅ Sim               | ✅ Sim       | Wiki + API docs      |
| **SUP-004** | Onboarding Call    | ❌ BLOCKED    | ⚠️ 1x (30 min)       | ✅ Unlimited | Inicial + ad-hoc     |
| **SUP-005** | Custom Development | ❌ BLOCKED    | ❌ BLOCKED           | ✅ Sim       | Rodizio com dev team |

---

## 2. LIMITES POR TIER

### 2.1 Quotas de Processamento

| Métrica                          | Community | Professional | Enterprise |
| -------------------------------- | --------- | ------------ | ---------- |
| **Área máxima por projeto**      | 2 km²     | 50 km²       | Unlimited  |
| **Raio máximo (circunferência)** | ~800m     | ~4km         | Unlimited  |
| **Features processáveis**        | 5,000     | 50,000       | 500,000+   |
| **Concurrent jobs**              | 1         | 3            | 10+        |

### 2.2 Rate Limiting

| Recurso                       | Community     | Professional | Enterprise |
| ----------------------------- | ------------- | ------------ | ---------- |
| **API Calls/mês**             | 0 (bloqueado) | 1,000        | Unlimited  |
| **Exports/mês**               | 0 DXF         | 20 DXF       | Unlimited  |
| **Processamento Terrain/mês** | 0             | 5            | Unlimited  |
| **DG Rodadas/mês**            | 0             | 5            | Unlimited  |

### 2.3 Storage & Retention

| Métrica               | Community       | Professional | Enterprise      |
| --------------------- | --------------- | ------------ | --------------- |
| **Espaço Projects**   | 1GB             | 10GB         | Unlimited       |
| **Retenção de dados** | 30 dias         | 90 dias      | Ilimitada       |
| **Backups**           | Sim (1x/semana) | Sim (1x/dia) | Sim (múltiplas) |

---

## 3. MAPA DE IMPLEMENTAÇÃO

### Fase 1: Backend Middleware (ASAP)

```typescript
// Exemplo de middleware que SERÁ USADO (pseudo-code)
export const requireTier = (minimumTier: 'community' | 'professional' | 'enterprise') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userTier = await getUserTier(req.user.id); // FROM Stripe

    if (!hasTierAccess(userTier, minimumTier)) {
      return res.status(403).json({
        error: 'Upgrade required',
        requiredTier: minimumTier,
      });
    }
    next();
  };
};

// Aplicar em rotas:
router.post('/export/dxf', requireTier('professional'), handleDxfExport);
router.post('/run-dg', requireTier('professional'), handleDgOptimization);
```

### Fase 2: Frontend Conditional Rendering (Após Fase 1)

```tsx
// Exemplo de bloqueio de UI (será usado após middleware)
function ExportDxfButton({ userTier }) {
  if (userTier === 'community') {
    return <UpgradePrompt tier="professional" />;
  }
  return <Button onClick={handleDxfExport}>Export DXF</Button>;
}
```

### Fase 3: Usage Metering (Stripe Billing)

```typescript
// Sync de usage com Stripe para PAYG
await stripe.billing.meterEventAdjustment.create({
  eventName: 'dxf_export_count',
  timestamp: Date.now(),
  value: 1,
  identifier: customerId,
});
```

---

## 4. WORKFLOW DE BLOQUEIO

### Quando um usuário tenta acessar feature bloqueada:

1. **Request chega ao backend**
   → Middleware `requireTier()` valida permissão contra `users.tier` (Stripe-synced)

2. **Tier não permite → 403 Forbidden**

   ```json
   {
     "error": "Feature requires Professional tier",
     "currentTier": "community",
     "requiredTier": "professional",
     "upgrade_url": "https://sisrua.com/pricing?ref=blocked_feature"
   }
   ```

3. **Frontend captura erro → Exibe modal de upgrade**
   - Botão "Upgrade to Professional"
   - Link para pricing page
   - Benefícios da tier

4. **Usuário clica upgrade → Stripe Checkout → Synca tier no DB**
   - Via webhook `customer.subscription.created`
   - Permissão ativada imediatamente após pagamento

---

## 5. OBSERVAÇÃO IMPORTANTE

### ⚠️ Esta é apenas uma LISTA de features que PRECISAM de bloqueios

- **NÃO foi implementado nenhum código aqui**
- Próximo passo: criar Stripe products e webhook de sync
- Depois: adicionar middleware `requireTier()` nas rotas principais
- Por último: UI disabled states baseado em tier

---

**Approval required before coding implementation**
