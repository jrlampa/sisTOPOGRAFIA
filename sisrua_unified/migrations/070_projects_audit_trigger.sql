-- 070_projects_audit_trigger.sql
-- Adiciona gatilho de auditoria à tabela de projetos para rastrear atividade no portal

DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;

CREATE TRIGGER trg_audit_projects
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.proc_audit_log();

-- Comentário para documentação
COMMENT ON TRIGGER trg_audit_projects ON public.projects IS 'Gatilho para registrar toda criação, edição ou remoção de projetos na trilha forense de auditoria.';
