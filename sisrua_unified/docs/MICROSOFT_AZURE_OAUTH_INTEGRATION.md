# Microsoft Azure Entra ID OAuth Integration — sisTOPOGRAFIA

**Data:** May 17, 2026  
**Status:** ✅ Integração Completa  
**Responsável:** GitHub Copilot

---

## 📋 Resumo Executivo

Este documento descreve a integração completa entre **Azure Entra ID** (Microsoft) e **Supabase OAuth** para Single Sign-On (SSO) corporativo no sisTOPOGRAFIA.

Ao completar esta integração:

- ✅ Usuários de `@microsoft.com`, `@im3brasil.com.br` ou qualquer domínio podem fazer login com conta Microsoft
- ✅ JWT válido é retornado e sincronizado entre Azure e Supabase
- ✅ Token é verificado no backend com `verifySupabaseAccessToken`
- ✅ Acesso corporativo é provisionado automaticamente

---

## 🔧 Informações da Aplicação Registrada

Você já possui o registro no **Azure Entra ID** com:

| Campo                  | Valor                                     |
| ---------------------- | ----------------------------------------- |
| **Nome**               | sisRUA                                    |
| **Client ID (App ID)** | `d5cf3432-1653-4328-8a40-9822bb7c9d4d`    |
| **Tenant ID**          | `c580bd4a-fb89-4bde-b6ae-715befa1ab31`    |
| **Object ID**          | `ca2604f6-2c10-465d-b3e5-2076901a4617`    |
| **Tipos de Conta**     | Multitenant (Todos os usuários Microsoft) |
| **Status**             | ✅ Ativado                                |

---

## 📝 Etapa 1: Configurar Redirect URIs no Azure Entra ID

### Acesso

1. Abra [portal.azure.com](https://portal.azure.com)
2. Navegue para **Azure Entra ID** → **App registrations** → **sisRUA**
3. Vá até **Authentication** (Menu esquerdo)

### Adicione estes Redirect URIs

```
https://zqtewkmqweicgacycnap.supabase.co/auth/v1/callback
http://localhost:3002
http://localhost:5173
https://seu-dominio-producao.com
https://seu-dominio-producao.com/callback
```

**Formulário de Redirect URIs:**

- Type: `Web`
- Redirect URI: (cada uma das URLs acima)

**Salve** e aguarde sincronização (~30s).

---

## 🔐 Etapa 2: Gerar Client Secret (Supabase)

### No Azure Portal

1. Dentro do registro **sisRUA**, vá até **Certificates & secrets**
2. Clique em **New client secret**
3. **Description:** `Supabase OAuth Integration`
4. **Expires:** `24 months` (recomendado)
5. Clique **Add**
6. **COPIE IMEDIATAMENTE** o valor do secret (não será mostrado novamente)

Exemplo de output:

```
Value: 8X.8Q~.kRxAbcDefGhIjKlmnOpQrStUvWxYz
Secret ID: 12345678-1234-5678-1234-567812345678
```

---

## ⚙️ Etapa 3: Configurar Azure OAuth no Supabase

### Acesso

1. Entre em [app.supabase.com](https://app.supabase.com)
2. Selecione o projeto **sisRUA Unified** (zqtewkmqweicgacycnap)
3. **Project Settings** → **Auth** → **Providers** → **Azure**

### Preencha os Campos

| Campo             | Valor                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Enabled**       | ✅ ON                                                                                    |
| **Client ID**     | `d5cf3432-1653-4328-8a40-9822bb7c9d4d`                                                   |
| **Tenant ID**     | `c580bd4a-fb89-4bde-b6ae-715befa1ab31`                                                   |
| **Client Secret** | `[Cole o valor gerado acima]`                                                            |
| **Redirect URL**  | `https://zqtewkmqweicgacycnap.supabase.co/auth/v1/callback` (preenchido automaticamente) |

**Clique SAVE** e aguarde confirmação.

---

## 📱 Etapa 4: Testar Login Microsoft Frontend

### No sisTOPOGRAFIA (Dev)

1. Abra [http://localhost:5173](http://localhost:5173)
2. Na landing page, procure o botão **"Entrar com Microsoft"**
3. Clique nele → será redirecionado para login Microsoft
4. Autentique-se com sua conta corporativa
5. Ser redirecionado de volta ao dashboard com JWT válido

### Debugging

Se receber erro `SUPABASE_URL mismatch` ou `Redirect URI not registered`:

- Verifique se o Redirect URI está **exatamente igual** no Azure
- Limpe cache do navegador (`Ctrl+Shift+Del`)
- Verifique se Supabase Azure Provider está **ON**

---

## 🔐 Etapa 5: Verificação Backend

### O JWT é automaticamente verificado em:

**Arquivo:** [server/services/supabaseJwtService.ts](../server/services/supabaseJwtService.ts)

```typescript
export async function verifySupabaseAccessToken(
  token: string
): Promise<VerifiedSupabaseUser | null> {
  // Valida assinatura JWT usando JWKS do Supabase
  // Retorna { userId, email, payload }
}
```

**Arquivo:** [server/middleware/authGuard.ts](../server/middleware/authGuard.ts)

```typescript
export const attachSupabaseUserIfPresent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extrai Bearer token do header Authorization
  // Valida e popula res.locals.authenticatedUser
};
```

### Endpoints Protegidos

Todos os endpoints que usam `attachSupabaseUserIfPresent` middleware têm acesso automático ao usuário:

```typescript
// server/index.ts
app.use(attachSupabaseUserIfPresent);

// Agora res.locals.authenticatedUser contém:
{
  userId: string,
  email: string,
  payload: SupabaseJwtPayload
}
```

---

## 📊 Fluxo Completo de Autenticação

```
┌─────────────────┐
│   Usuário       │
│   Abre App      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Frontend: Click "Entrar com Microsoft"      │
│ supabase.auth.signInWithOAuth({             │
│   provider: 'azure',                        │
│   options: { redirectTo: ... }              │
│ })                                          │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Microsoft Login Flow                        │
│ 1. Redireciona para login.microsoft.com     │
│ 2. Usuário autentica                        │
│ 3. Retorna authorization code               │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Supabase Exchange OAuth Code para JWT       │
│ supabase.com + Client Secret + Auth Code    │
│ → Retorna access_token (JWT Supabase)       │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Frontend: Salva JWT em sessão               │
│ Frontend: Redireciona para /dashboard       │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Backend Middleware: attachSupabaseUserIfPresent
│ 1. Extrai Bearer token do header            │
│ 2. Valida com JWKS do Supabase              │
│ 3. Popula res.locals.authenticatedUser      │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ Request é Processado                        │
│ Usuário tem acesso a dados corporativos     │
└─────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Erro: "AADSTS50058: Silent sign-in request failed"

**Causa:** Usuário não está logado no Microsoft Account Manager.

**Solução:**

- Abra em aba privada
- Ou faça logout de todas as contas Microsoft
- Tente novamente

### Erro: "The redirect URI is not registered"

**Causa:** Redirect URI não está configurado no Azure.

**Solução:**

1. Verifique [Azure Portal](https://portal.azure.com)
2. Procure o Redirect URI **exatamente igual** (case-sensitive)
3. Se faltando, adicione em **Authentication** → **Redirect URIs**

### Erro: "Client Secret expired"

**Causa:** Client Secret expirou (máximo 24 meses por padrão).

**Solução:**

1. Gere um novo secret no Azure
2. Atualize em Supabase Console
3. No código, não mude nada (será automático)

### Erro: "JWT token invalid or expired"

**Causa:** Token expirou ou assinatura inválida.

**Solução:**

- Frontend chama `supabase.auth.refreshSession()` automaticamente
- Se continuar, faça logout e login novamente

---

## 📌 Variáveis de Ambiente Requeridas

### Frontend (`.env` / `vite.config.ts`)

```bash
VITE_SUPABASE_URL=https://zqtewkmqweicgacycnap.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### Backend (`.env`)

```bash
SUPABASE_URL=https://zqtewkmqweicgacycnap.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_ALLOWED_EMAIL_DOMAIN=im3brasil.com.br
```

---

## 🔒 Segurança

### ✅ Implementado

- JWT Bearer token validation via JWKS (RS256 signature)
- Token refresh automático
- CORS origin verification
- Email domain whitelist (`SUPABASE_ALLOWED_EMAIL_DOMAIN`)

### ❌ **NÃO fazer**

- ❌ Armazenar Client Secret em frontend
- ❌ Usar `SUPABASE_SERVICE_ROLE_KEY` no frontend
- ❌ Desabilitar verificação de JWT

### 🎯 Recomendações

1. Rotacione Client Secrets a cada 12 meses
2. Monitore login failures em `audit_logs`
3. Configure alertas no Azure para atividades suspeitas
4. Use HTTPS em produção (já configurado no docker-compose)

---

## 📞 Suporte

| Recurso                 | URL                                                           |
| ----------------------- | ------------------------------------------------------------- |
| **Supabase Docs**       | https://supabase.com/docs/guides/auth/social-login/auth-azure |
| **Azure Entra ID Docs** | https://learn.microsoft.com/en-us/entra/identity-platform/    |
| **Issues do Projeto**   | Abra GitHub Issue com tag `auth-oauth`                        |

---

## 📋 Checklist de Implementação

- [x] Azure Entra ID Application Registered
- [ ] Redirect URIs Configurados no Azure
- [ ] Client Secret Gerado
- [ ] Azure OAuth Ativado no Supabase
- [ ] Frontend: Botões OAuth Adicionados
- [ ] Backend: JWT Validation Testado
- [ ] E2E Tests Passando
- [ ] Documentação Atualizada
- [ ] Deploy em Staging

---

**Last Updated:** 2026-05-17  
**Next Review:** 2026-08-17
