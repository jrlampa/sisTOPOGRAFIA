/**
 * Testes — LGPD Retenção, Classificação e Descarte (Item 40)
 * Cobre: políticas, eventos de descarte, certificados NIST 800-88
 */

import {
    criarPoliticaRetencao,
    obterPolitica,
    listarPoliticas,
    listarPoliticasAtivas,
    desativarPolitica,
    metodoDescarteRecomendado,
    agendarDescarte,
    iniciarDescarte,
    concluirDescarte,
    cancelarDescarte,
    listarEventosDescarte,
    listarDescartesPendentes,
    listarCertificados,
    obterCertificado,
    _resetRetencaoState,
} from '../services/lgpdRetencaoService';

beforeEach(() => {
    _resetRetencaoState();
});

// ── Políticas ─────────────────────────────────────────────────────────────────

describe('criarPoliticaRetencao', () => {
    it('deve criar política com campos obrigatórios e retornar objeto completo', () => {
        const p = criarPoliticaRetencao({
            nome: 'Logs de acesso',
            descricao: 'Retenção de logs de acesso ao sistema',
            sistema: 'auth-service',
            categorias: ['logs_acesso'],
            nivelClassificacao: 'interno',
            retencaoOperacionalDias: 90,
        });
        expect(p.id).toBeDefined();
        expect(p.nome).toBe('Logs de acesso');
        expect(p.nivelClassificacao).toBe('interno');
        expect(p.retencaoOperacionalDias).toBe(90);
        expect(p.ativa).toBe(true);
        expect(p.criadaEm).toBeDefined();
    });

    it('deve aplicar metodo NIST recomendado quando não informado', () => {
        const p = criarPoliticaRetencao({
            nome: 'Dados sensíveis',
            descricao: 'CPF, biometria',
            sistema: 'core',
            categorias: ['dados_sensiveis'],
            nivelClassificacao: 'restrito',
            retencaoOperacionalDias: 365,
        });
        expect(p.metodoDescarte).toBe('destroy');
    });

    it('deve aceitar metodo descarte explícito', () => {
        const p = criarPoliticaRetencao({
            nome: 'Histórico contratual',
            descricao: 'Dados contratuais legais',
            sistema: 'contratos',
            categorias: ['dados_contratuais'],
            nivelClassificacao: 'confidencial',
            retencaoOperacionalDias: 1825,
            retencaoLegalDias: 3650,
            motivoConservacao: 'cumprimento_obrigacao_legal',
            embasamentoLegal: 'Lei 12.682/2012, Art. 7º',
            metodoDescarte: 'purge',
        });
        expect(p.metodoDescarte).toBe('purge');
        expect(p.retencaoLegalDias).toBe(3650);
        expect(p.motivoConservacao).toBe('cumprimento_obrigacao_legal');
    });
});

describe('obterPolitica / listarPoliticas', () => {
    it('deve retornar null para ID inexistente', () => {
        expect(obterPolitica('nao-existe')).toBeNull();
    });

    it('deve listar todas as políticas criadas', () => {
        criarPoliticaRetencao({ nome: 'A', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'publico', retencaoOperacionalDias: 30 });
        criarPoliticaRetencao({ nome: 'B', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'interno', retencaoOperacionalDias: 60 });
        expect(listarPoliticas()).toHaveLength(2);
    });
});

describe('desativarPolitica', () => {
    it('deve desativar política e remover da lista de ativas', () => {
        const p = criarPoliticaRetencao({
            nome: 'Política obsoleta',
            descricao: 'd',
            sistema: 's',
            categorias: [],
            nivelClassificacao: 'interno',
            retencaoOperacionalDias: 30,
        });
        const updated = desativarPolitica(p.id);
        expect(updated?.ativa).toBe(false);
        expect(listarPoliticasAtivas()).toHaveLength(0);
    });

    it('deve retornar null ao desativar ID inexistente', () => {
        expect(desativarPolitica('nao-existe')).toBeNull();
    });
});

describe('metodoDescarteRecomendado', () => {
    it('publico → clear', () => expect(metodoDescarteRecomendado('publico')).toBe('clear'));
    it('interno → clear', () => expect(metodoDescarteRecomendado('interno')).toBe('clear'));
    it('confidencial → purge', () => expect(metodoDescarteRecomendado('confidencial')).toBe('purge'));
    it('restrito → destroy', () => expect(metodoDescarteRecomendado('restrito')).toBe('destroy'));
});

// ── Eventos de Descarte ───────────────────────────────────────────────────────

describe('agendarDescarte', () => {
    it('deve agendar evento vinculado à política', () => {
        const p = criarPoliticaRetencao({
            nome: 'Dados pessoais',
            descricao: 'd',
            sistema: 'usuarios',
            categorias: ['nome', 'email'],
            nivelClassificacao: 'confidencial',
            retencaoOperacionalDias: 180,
        });
        const evt = agendarDescarte({
            politicaId: p.id,
            registrosEstimados: 5000,
            agendadoPara: new Date(Date.now() + 86400000).toISOString(),
        });
        expect(evt).not.toBeNull();
        expect(evt!.politicaId).toBe(p.id);
        expect(evt!.status).toBe('agendado');
        expect(evt!.registrosEstimados).toBe(5000);
    });

    it('deve retornar null para politicaId inexistente', () => {
        expect(agendarDescarte({
            politicaId: 'nao-existe',
            registrosEstimados: 100,
            agendadoPara: new Date().toISOString(),
        })).toBeNull();
    });
});

describe('iniciarDescarte', () => {
    it('deve transicionar de agendado para em_execucao', () => {
        const p = criarPoliticaRetencao({ nome: 'P', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'interno', retencaoOperacionalDias: 30 });
        const evt = agendarDescarte({ politicaId: p.id, registrosEstimados: 10, agendadoPara: new Date().toISOString() })!;
        const iniciado = iniciarDescarte(evt.id);
        expect(iniciado?.status).toBe('em_execucao');
        expect(iniciado?.iniciadoEm).toBeDefined();
    });

    it('não deve iniciar evento que não está agendado', () => {
        expect(iniciarDescarte('nao-existe')).toBeNull();
    });
});

describe('concluirDescarte', () => {
    it('deve concluir e emitir certificado NIST 800-88', () => {
        const p = criarPoliticaRetencao({ nome: 'CPFs', descricao: 'd', sistema: 'core', categorias: ['cpf'], nivelClassificacao: 'restrito', retencaoOperacionalDias: 365 });
        const evt = agendarDescarte({ politicaId: p.id, registrosEstimados: 200, agendadoPara: new Date().toISOString() })!;
        iniciarDescarte(evt.id);

        const result = concluirDescarte({
            eventoId: evt.id,
            registrosDescartados: 198,
            executadoPor: 'sistema-DPO',
        });

        expect(result).not.toBeNull();
        expect(result!.evento.status).toBe('concluido');
        expect(result!.evento.registrosDescartados).toBe(198);
        expect(result!.certificado.metodoDescarte).toBe('destroy');
        expect(result!.certificado.normaAplicada).toContain('NIST SP 800-88');
        expect(result!.certificado.integrityHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('deve poder concluir sem passar por iniciar', () => {
        const p = criarPoliticaRetencao({ nome: 'Email mkt', descricao: 'd', sistema: 'mkt', categorias: ['email'], nivelClassificacao: 'confidencial', retencaoOperacionalDias: 90 });
        const evt = agendarDescarte({ politicaId: p.id, registrosEstimados: 50, agendadoPara: new Date().toISOString() })!;

        const result = concluirDescarte({
            eventoId: evt.id,
            registrosDescartados: 50,
            executadoPor: 'admin',
        });
        expect(result!.evento.status).toBe('concluido');
    });

    it('certificado deve ter hash distinto para conteúdos distintos', () => {
        const p = criarPoliticaRetencao({ nome: 'P1', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'confidencial', retencaoOperacionalDias: 30 });
        const p2 = criarPoliticaRetencao({ nome: 'P2', descricao: 'd', sistema: 's2', categorias: [], nivelClassificacao: 'confidencial', retencaoOperacionalDias: 30 });

        const e1 = agendarDescarte({ politicaId: p.id, registrosEstimados: 10, agendadoPara: new Date().toISOString() })!;
        const e2 = agendarDescarte({ politicaId: p2.id, registrosEstimados: 20, agendadoPara: new Date().toISOString() })!;

        const r1 = concluirDescarte({ eventoId: e1.id, registrosDescartados: 10, executadoPor: 'sys' })!;
        const r2 = concluirDescarte({ eventoId: e2.id, registrosDescartados: 20, executadoPor: 'sys' })!;

        expect(r1.certificado.integrityHash).not.toBe(r2.certificado.integrityHash);
    });
});

describe('cancelarDescarte', () => {
    it('deve cancelar evento agendado', () => {
        const p = criarPoliticaRetencao({ nome: 'P', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'interno', retencaoOperacionalDias: 30 });
        const evt = agendarDescarte({ politicaId: p.id, registrosEstimados: 5, agendadoPara: new Date().toISOString() })!;
        const cancelado = cancelarDescarte(evt.id, 'Política revisada');
        expect(cancelado?.status).toBe('cancelado');
        expect(cancelado?.observacao).toBe('Política revisada');
    });
});

describe('listarDescartesPendentes', () => {
    it('deve retornar apenas eventos com prazo vencido e status agendado', () => {
        const p = criarPoliticaRetencao({ nome: 'P', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'interno', retencaoOperacionalDias: 30 });
        // Vencido (data no passado)
        agendarDescarte({ politicaId: p.id, registrosEstimados: 10, agendadoPara: new Date(Date.now() - 86400000).toISOString() });
        // Futuro
        agendarDescarte({ politicaId: p.id, registrosEstimados: 10, agendadoPara: new Date(Date.now() + 86400000).toISOString() });

        const pendentes = listarDescartesPendentes();
        expect(pendentes).toHaveLength(1);
    });
});

describe('listarCertificados / obterCertificado', () => {
    it('deve listar certificados emitidos', () => {
        const p = criarPoliticaRetencao({ nome: 'P', descricao: 'd', sistema: 's', categorias: [], nivelClassificacao: 'confidencial', retencaoOperacionalDias: 30 });
        const evt = agendarDescarte({ politicaId: p.id, registrosEstimados: 1, agendadoPara: new Date().toISOString() })!;
        concluirDescarte({ eventoId: evt.id, registrosDescartados: 1, executadoPor: 'admin' });
        const certs = listarCertificados();
        expect(certs).toHaveLength(1);
        expect(obterCertificado(certs[0].id)).not.toBeNull();
    });

    it('deve retornar null para certificado inexistente', () => {
        expect(obterCertificado('nao-existe')).toBeNull();
    });
});
