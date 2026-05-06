/**
 * Testes — LGPD Residência de Dados Brasil (Item 41)
 * Cobre: localizações, conformidade por sistema, relatório geral, adequação ANPD
 */

import {
    registrarLocalizacao,
    obterLocalizacao,
    listarLocalizacoes,
    listarLocalizacoesPorSistema,
    removerLocalizacao,
    verificarConformidadeSistema,
    gerarRelatorioResidencia,
    paisTemAdequacaoReconhecida,
    _resetResidenciaState,
} from '../services/lgpdResidenciaService';

beforeEach(() => {
    _resetResidenciaState();
});

// ── Localizações ──────────────────────────────────────────────────────────────

describe('registrarLocalizacao', () => {
    it('deve registrar localização no Brasil sem base legal de transferência', () => {
        const loc = registrarLocalizacao({
            sistema: 'api-core',
            descricao: 'Banco de dados principal',
            provedor: 'aws',
            regiaoProvedor: 'sa-east-1',
            pais: 'BR',
            contemDadosPessoais: true,
            categorias: ['nome', 'cpf'],
        });
        expect(loc.id).toBeDefined();
        expect(loc.pais).toBe('BR');
        expect(loc.contemDadosPessoais).toBe(true);
        expect(loc.registradaEm).toBeDefined();
    });

    it('deve registrar localização no exterior com base legal', () => {
        const loc = registrarLocalizacao({
            sistema: 'analytics',
            descricao: 'BigQuery analytics',
            provedor: 'gcp',
            regiaoProvedor: 'us-east1',
            pais: 'US',
            contemDadosPessoais: false,
            categorias: ['metricas_anonimas'],
            baseLegalTransferencia: 'garantias_adequadas',
            referenciaContratual: 'DPA-GCP-2024',
        });
        expect(loc.pais).toBe('US');
        expect(loc.baseLegalTransferencia).toBe('garantias_adequadas');
    });
});

describe('obterLocalizacao / listarLocalizacoes', () => {
    it('deve retornar null para ID inexistente', () => {
        expect(obterLocalizacao('nao-existe')).toBeNull();
    });

    it('deve listar todas as localizações registradas', () => {
        registrarLocalizacao({ sistema: 's1', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: true, categorias: [] });
        registrarLocalizacao({ sistema: 's2', descricao: 'd', provedor: 'azure', regiaoProvedor: 'brazilsouth', pais: 'BR', contemDadosPessoais: false, categorias: [] });
        expect(listarLocalizacoes()).toHaveLength(2);
    });
});

describe('listarLocalizacoesPorSistema', () => {
    it('deve filtrar por sistema', () => {
        registrarLocalizacao({ sistema: 'auth', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: true, categorias: [] });
        registrarLocalizacao({ sistema: 'auth', descricao: 'd2', provedor: 'gcp', regiaoProvedor: 'us-east1', pais: 'US', contemDadosPessoais: false, categorias: [], baseLegalTransferencia: 'garantias_adequadas' });
        registrarLocalizacao({ sistema: 'storage', descricao: 'd3', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: false, categorias: [] });

        expect(listarLocalizacoesPorSistema('auth')).toHaveLength(2);
        expect(listarLocalizacoesPorSistema('storage')).toHaveLength(1);
        expect(listarLocalizacoesPorSistema('nao-existe')).toHaveLength(0);
    });
});

describe('removerLocalizacao', () => {
    it('deve remover localização existente', () => {
        const loc = registrarLocalizacao({ sistema: 's', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: false, categorias: [] });
        expect(removerLocalizacao(loc.id)).toBe(true);
        expect(listarLocalizacoes()).toHaveLength(0);
    });

    it('deve retornar false para ID inexistente', () => {
        expect(removerLocalizacao('nao-existe')).toBe(false);
    });
});

// ── Conformidade ──────────────────────────────────────────────────────────────

describe('verificarConformidadeSistema', () => {
    it('sistema 100% Brasil → conforme', () => {
        registrarLocalizacao({ sistema: 'db', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: true, categorias: ['cpf'] });
        const result = verificarConformidadeSistema('db');
        expect(result.status).toBe('conforme');
        expect(result.violacoes).toHaveLength(0);
        expect(result.localizacoesBrasil).toBe(1);
        expect(result.localizacoesForaDoBrasil).toBe(0);
    });

    it('dado pessoal fora do Brasil sem base legal → nao_conforme', () => {
        registrarLocalizacao({
            sistema: 'backup',
            descricao: 'Backup S3 EUA',
            provedor: 'aws',
            regiaoProvedor: 'us-east-1',
            pais: 'US',
            contemDadosPessoais: true,
            categorias: ['nome', 'cpf'],
            baseLegalTransferencia: 'nenhuma',
        });
        const result = verificarConformidadeSistema('backup');
        expect(result.status).toBe('nao_conforme');
        expect(result.violacoes).toHaveLength(1);
    });

    it('dado NÃO pessoal fora do Brasil → conforme', () => {
        registrarLocalizacao({
            sistema: 'cdn',
            descricao: 'Assets estáticos',
            provedor: 'aws',
            regiaoProvedor: 'us-east-1',
            pais: 'US',
            contemDadosPessoais: false,
            categorias: ['imagens'],
        });
        const result = verificarConformidadeSistema('cdn');
        expect(result.status).toBe('conforme');
        expect(result.violacoes).toHaveLength(0);
    });

    it('dado pessoal fora do Brasil COM base legal → sob_analise (não violação)', () => {
        registrarLocalizacao({
            sistema: 'ml',
            descricao: 'Treinamento ML EUA',
            provedor: 'aws',
            regiaoProvedor: 'us-west-2',
            pais: 'US',
            contemDadosPessoais: true,
            categorias: ['comportamento_anonimizado'],
            baseLegalTransferencia: 'garantias_adequadas',
            referenciaContratual: 'DPA-AWS-2024',
        });
        const result = verificarConformidadeSistema('ml');
        expect(result.status).toBe('sob_analise');
        expect(result.violacoes).toHaveLength(0);
    });
});

describe('gerarRelatorioResidencia', () => {
    it('deve retornar relatório vazio quando não há localizações', () => {
        const rel = gerarRelatorioResidencia();
        expect(rel.totalSistemas).toBe(0);
        expect(rel.conformeGeral).toBe(true);
    });

    it('deve agregar conformidade de múltiplos sistemas', () => {
        // Sistema 1 — conforme (Brasil)
        registrarLocalizacao({ sistema: 'api', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: true, categorias: [] });
        // Sistema 2 — não conforme (fora, sem base legal)
        registrarLocalizacao({ sistema: 'legacy', descricao: 'd', provedor: 'outro', regiaoProvedor: 'us-east-1', pais: 'US', contemDadosPessoais: true, categorias: ['cpf'], baseLegalTransferencia: 'nenhuma' });

        const rel = gerarRelatorioResidencia();
        expect(rel.totalSistemas).toBe(2);
        expect(rel.sistemasConformes).toBe(1);
        expect(rel.sistemasNaoConformes).toBe(1);
        expect(rel.conformeGeral).toBe(false);
        expect(rel.totalViolacoes).toBe(1);
    });

    it('conformeGeral = true quando todos sistemas conformes', () => {
        registrarLocalizacao({ sistema: 's1', descricao: 'd', provedor: 'aws', regiaoProvedor: 'sa-east-1', pais: 'BR', contemDadosPessoais: true, categorias: [] });
        registrarLocalizacao({ sistema: 's2', descricao: 'd', provedor: 'azure', regiaoProvedor: 'brazilsouth', pais: 'BR', contemDadosPessoais: true, categorias: [] });
        expect(gerarRelatorioResidencia().conformeGeral).toBe(true);
    });
});

// ── Adequação ANPD ────────────────────────────────────────────────────────────

describe('paisTemAdequacaoReconhecida', () => {
    it('países UE têm adequação reconhecida', () => {
        expect(paisTemAdequacaoReconhecida('EU')).toBe(true);
        expect(paisTemAdequacaoReconhecida('DE')).toBe(true);
        expect(paisTemAdequacaoReconhecida('IE')).toBe(true);
    });

    it('Brasil não está no set (não precisa)', () => {
        expect(paisTemAdequacaoReconhecida('BR')).toBe(false);
    });

    it('EUA não tem adequação reconhecida', () => {
        expect(paisTemAdequacaoReconhecida('US')).toBe(false);
    });

    it('Japão e Canadá têm adequação', () => {
        expect(paisTemAdequacaoReconhecida('JP')).toBe(true);
        expect(paisTemAdequacaoReconhecida('CA')).toBe(true);
    });
});
