-- 065_collaboration_realtime.sql
-- Implementação de persistência para edição colaborativa e multiplayer (Item 134)

CREATE TYPE collaboration_status AS ENUM ('aberta', 'bloqueada', 'encerrada');
CREATE TYPE collaboration_op_type AS ENUM (
  'adicionar_ponto', 'mover_ponto', 'remover_ponto',
  'adicionar_trecho', 'remover_trecho', 'editar_atributo', 'comentar'
);

-- Tabela de Sessões Colaborativas
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    projeto_id UUID NOT NULL, -- Referência lógica ao projeto
    nome_projeto TEXT NOT NULL,
    responsavel_id UUID REFERENCES auth.users(id),
    status collaboration_status DEFAULT 'aberta',
    versao_atual INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Histórico de Operações (Log para Sync e Auditoria)
CREATE TABLE collaboration_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id),
    tipo_operacao collaboration_op_type NOT NULL,
    payload JSONB NOT NULL,
    versao_base INTEGER NOT NULL,
    versao_resultante INTEGER NOT NULL,
    conflito BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_history ENABLE ROW LEVEL SECURITY;

-- Políticas de Tenant Isolation
CREATE POLICY tenant_isolation_sessions ON collaboration_sessions
    USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY tenant_isolation_history ON collaboration_history
    USING (sessao_id IN (SELECT id FROM collaboration_sessions WHERE tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid())));

-- Habilitar Realtime para estas tabelas (opcional se usarmos Broadcast puro, mas bom para fallbacks)
-- ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_sessions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_history;

-- Índices de performance
CREATE INDEX idx_coll_sessions_projeto ON collaboration_sessions(projeto_id);
CREATE INDEX idx_coll_history_sessao ON collaboration_history(sessao_id, versao_resultante);
