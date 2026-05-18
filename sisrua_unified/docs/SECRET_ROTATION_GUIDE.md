# 🛡️ Guia de Rotação de Segredos (Incident Response)

Este documento foi gerado após a detecção de credenciais em plaintext em ambientes locais/logs de auditoria. Para garantir a integridade do sistema, siga os passos abaixo para rotacionar as chaves comprometidas.

## 1. Supabase (Service Role Key)
**Impacto:** Crítico (Acesso total ao banco de dados e Auth).
1. Acesse o [Dashboard do Supabase](https://app.supabase.com/).
2. Vá em **Project Settings** > **API**.
3. Em **Project API keys**, localize a `service_role` key.
4. Clique em **Roll Key**.
5. Atualize a nova chave no Gerenciador de Segredos do Cloud Run e nos arquivos `.env` locais (não rastreados).

## 2. Google Cloud API Key
**Impacto:** Médio (Uso não autorizado de APIs de Mapas/Elevation).
1. Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2. Vá em **APIs & Services** > **Credentials**.
3. Localize a chave de API utilizada.
4. Clique em **Regenerate Key**.
5. Configure restrições de IP e Referrer HTTP na nova chave.

## 3. Redis Password
**Impacto:** Alto (Acesso ao cache e filas de jobs).
1. Gere uma nova senha forte.
2. Atualize o arquivo `secrets/redis_password.txt`.
3. Reinicie os containers via Docker Compose.
4. Em produção, atualize o segredo no orquestrador (Cloud Run/K8s).

## 4. PostHog API Key
**Impacto:** Baixo (Acesso a dados de telemetria).
1. Acesse o dashboard do PostHog.
2. Vá em **Project Settings**.
3. Rotacione o **Project API Key**.

---

**⚠️ AVISO:** Nunca commite arquivos `.env` ou segredos no repositório. Utilize o padrão `_FILE` do Docker Secrets ou Gerenciadores de Segredos de Nuvem.
