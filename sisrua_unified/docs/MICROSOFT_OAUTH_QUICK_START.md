# ⚡ Quick Start: Microsoft Azure OAuth Integration

**Time to complete:** ~15 minutos  
**Nível:** Intermediate

---

## 🎯 O Que Você Terá ao Final

✅ Login com Microsoft/Google na landing page  
✅ JWT automático validado no backend  
✅ Usuários provisionados automaticamente  
✅ E2E tests passando

---

## 📋 Pré-requisitos

- ✅ Acesso a [Azure Portal](https://portal.azure.com) (admin)
- ✅ Acesso a [Supabase Console](https://app.supabase.com)
- ✅ Node.js 18+ instalado
- ✅ Repositório sisTOPOGRAFIA no local

---

## 🔧 Etapa 1: Azure Portal Setup (5 min)

### 1.1 Adicionar Redirect URIs

```bash
# Abra: https://portal.azure.com
# → Azure Entra ID
# → App registrations
# → sisRUA
# → Authentication
# → Redirect URIs (Web)
```

**Copie e cole esta URL (obrigatória para Supabase OAuth):**

```text
https://zqtewkmqweicgacycnap.supabase.co/auth/v1/callback
```

As URLs `http://localhost:3002` e `http://localhost:5173` nao sao necessarias para o fluxo Supabase OAuth.

Clique em Save.

### 1.2 Gerar Client Secret

```bash
# Mesma tela
# → Certificates & secrets
# → New client secret
# → Description: "Supabase Integration"
# → Expires: 24 months
# → Add
```

Copie o valor do secret (nao sera mostrado novamente).

Exemplo:

```text
8X.8Q~.kRxAbcDefGhIjKlmnOpQrStUvWxYz
```

---

## 🎛️ Etapa 2: Supabase Console Setup (5 min)

### 2.1 Ativar Azure OAuth Provider

```bash
# Abra: https://app.supabase.com
# → Projeto: sisRUA Unified
# → Project Settings
# → Auth
# → Providers
# → Azure
```

### 2.2 Preencher Campos

| Campo             | Valor                                  |
| ----------------- | -------------------------------------- |
| **Enabled**       | ✅ Toggle ON                           |
| **Client ID**     | `d5cf3432-1653-4328-8a40-9822bb7c9d4d` |
| **Tenant ID**     | `c580bd4a-fb89-4bde-b6ae-715befa1ab31` |
| **Client Secret** | Cole o valor do passo 1.2              |

Clique em Save.

---

## 🧪 Etapa 3: Testar Localmente (5 min)

### 3.1 Iniciar Servidor

```bash
cd sisrua_unified

# Terminal 1: Backend + Frontend
npm run dev

# Terminal 2 (opcional): Python Engine
cd py_engine
python main.py
```

### 3.2 Abrir Landing Page

```bash
# Navegador: http://localhost:5173
```

### 3.3 Encontrar Botão de Login

Procure na seção **"Acesso à Jurisdição Digital"**:

- [ ] Botão "Entrar com Google"
- [ ] Botão "Entrar com Microsoft"

### 3.4 Testar Login Microsoft

1. Clique em **"Entrar com Microsoft"**
2. Será redirecionado para `login.microsoft.com`
3. Autentique-se com sua conta Microsoft/Office365
4. Retornará ao dashboard automaticamente

### 3.5 Verificar JWT no Console

```javascript
// Browser DevTools → Console
const session = await supabase.auth.getSession();
console.log(session.data.session.access_token);
```

Deve exibir um JWT válido (3 partes separadas por `.`)

---

## ✅ Validação de Sucesso

- [ ] Botões OAuth aparecem na landing page
- [ ] Clique em "Microsoft" redireciona para login
- [ ] Login bem-sucedido retorna ao dashboard
- [ ] `supabase.auth.getSession()` retorna JWT
- [ ] Backend middleware `attachSupabaseUserIfPresent` popula `res.locals.authenticatedUser`

---

## 🧪 Rodar E2E Tests

```bash
cd sisrua_unified

# Instalar Playwright (se não tiver)
npm install -D @playwright/test

# Rodar testes de auth
npm run test:e2e -- auth-oauth

# Ou teste específico de OAuth
npx playwright test e2e/auth-oauth.spec.ts --headed

# Se estiver na raiz do monorepo, use:
npm run test:e2e:auth-oauth
```

---

## 🚨 Troubleshooting

### ❌ "Redirect URI not registered"

**Solução:**

1. Verifique espaços em branco no URI
2. Certifique-se de que está em `Authentication` → `Redirect URIs`
3. Não está em `API permissions`
4. Espere 1-2 minutos pela sincronização

### ❌ "Client Secret expired"

**Solução:**

1. Gere um novo secret no Azure
2. Atualize em Supabase
3. Reinicie o servidor

### ❌ "CORS error" ou "localhost refused connection"

**Solução:**

```bash
# Certifique-se de que:
# 1. Port 5173 (frontend) está ouvindo
npm run dev

# 2. Port 3001 (backend) está ouvindo
# (deve estar rodando junto com dev)

# 3. Verify CORS_ORIGIN in .env
echo "CORS_ORIGIN=http://localhost:5173"
```

### ❌ Login funciona, mas JWT não é verificado no backend

**Solução:**

1. Verifique se `SUPABASE_URL` está correto no `.env`
2. Verifique se `attachSupabaseUserIfPresent` está registrado:

```typescript
// server/index.ts
app.use(attachSupabaseUserIfPresent); // Deve estar ANTES das rotas
```

---

## 📚 Próximos Passos

1. **Configurar Email Domain Whitelist:**

   ```bash
   # .env
   SUPABASE_ALLOWED_EMAIL_DOMAIN=im3brasil.com.br
   ```

2. **Configurar Superadmin:**

   ```bash
   # .env
   SUPABASE_SUPERADMIN_EMAIL=seu-email@microsoft.com
   ```

3. **Deploy em Staging:**
   - Adicionar Redirect URI de staging ao Azure
   - Testar fluxo completo em staging

4. **Adicionar Testes E2E:**
   - Criar `e2e/auth-oauth.spec.ts`
   - Testar login Microsoft em ambiente headless

---

## 📞 Referências

<!-- markdownlint-disable MD060 -->

| Documento                  | Link                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Full Integration Guide** | [MICROSOFT_AZURE_OAUTH_INTEGRATION.md](./MICROSOFT_AZURE_OAUTH_INTEGRATION.md)                  |
| **Supabase OAuth Docs**    | [Supabase OAuth Azure](https://supabase.com/docs/guides/auth/social-login/auth-azure)           |
| **Microsoft Entra Docs**   | [Microsoft Entra Identity Platform](https://learn.microsoft.com/en-us/entra/identity-platform/) |
| **Código: AuthProvider**   | `src/auth/AuthProvider.tsx`                                                                     |
| **Código: Backend JWT**    | `server/services/supabaseJwtService.ts`                                                         |

<!-- markdownlint-enable MD060 -->

---

## 💡 Dicas Avançadas

### 1. Mapear User Metadata (opcional)

```typescript
// server/services/authOnboardingService.ts
// Extrair dados do payload do JWT
const userMetadata = payload.user_metadata as {
  name?: string;
  avatar_url?: string;
  provider?: string;
};
```

### 2. Auditoria de Logins

```typescript
// Adicionar registro em audit_logs quando login via OAuth
await supabase.from('audit_logs').insert({
  action: 'oauth_signin',
  changed_by: userId,
  device_fingerprint: getFingerprint(),
  geo_country: getCountry(),
});
```

### 3. Mostrar Avatar do Microsoft

```typescript
// UserProfile component
const avatarUrl = user?.user_metadata?.avatar_url;
if (avatarUrl) {
  return <img src={avatarUrl} alt={user.email} />;
}
```

---

**Status:** ✅ Integração Completa  
**Last Updated:** 2026-05-17
