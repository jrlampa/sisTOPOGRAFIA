-- 066_user_preferences.sql
-- Persistência de preferências de usuário e Feature Flags (Item 135)

CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    theme TEXT DEFAULT 'dark',
    locale TEXT DEFAULT 'pt-BR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas: Usuário só pode ler/editar suas próprias preferências
CREATE POLICY user_prefs_isolation ON public.user_preferences
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_tenant_updated_at(); -- Reusando função existente
