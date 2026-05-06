import {
    criarDossie,
    obterDossie,
    listarDossies,
    resumoDossies,
    vincularValidacaoBdgd,
    adicionarArtefato,
    registrarSubmissao,
    arquivarDossie,
    exportarPacote,
    verificarIntegridadePacote,
    sha256Hex,
    canonicalJson,
    _resetDossieState,
    type DossieRegulatorio,
    type PacoteExportavel,
} from '../services/dossieRegulatorioService';
import { type BdgdValidationReport } from '../services/bdgdValidatorService';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    _resetDossieState();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const dossieInput = {
    cicloReferencia: '2026-T1',
    distribuidora: 'CEMIG Distribuição S.A.',
    cnpj: '06.981.180/0001-16',
    responsavelTecnico: 'João Silva',
    prazoEntregaISO: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30d
    autor: 'sistema-teste',
};

const reportConformeFixture: BdgdValidationReport = {
    generatedAt: new Date().toISOString(),
    aneelSpec: 'PRODIST Módulo 2 / REN 956/2021',
    layers: [
        {
            layer: 'SEGBT',
            description: 'Segmentos de Rede de Baixa Tensão',
            totalRecords: 10,
            validRecords: 10,
            issues: [],
            conformant: true,
        },
    ],
    totals: {
        layersChecked: 1,
        layersConformant: 1,
        totalRecords: 10,
        totalIssues: 0,
        errors: 0,
        warnings: 0,
    },
    conformant: true,
};

const reportNaoConformeFixture: BdgdValidationReport = {
    ...reportConformeFixture,
    layers: [
        {
            ...reportConformeFixture.layers[0],
            issues: [
                {
                    rule: 'R1',
                    severity: 'error',
                    field: 'COD_ID',
                    recordIndex: 0,
                    message: 'Campo obrigatório ausente',
                },
            ],
            conformant: false,
            validRecords: 9,
        },
    ],
    totals: { ...reportConformeFixture.totals, totalIssues: 1, errors: 1, layersConformant: 0 },
    conformant: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('sha256Hex / canonicalJson', () => {
    it('sha256Hex retorna string hexadecimal de 64 chars', () => {
        const h = sha256Hex('hello');
        expect(h).toHaveLength(64);
        expect(h).toMatch(/^[0-9a-f]+$/);
    });

    it('canonicalJson ordena chaves independente da ordem de inserção', () => {
        const obj = { z: 1, a: 2, m: 3 };
        const json = canonicalJson(obj);
        expect(json).toBe('{"a":2,"m":3,"z":1}');
    });

    it('canonicalJson produz mesmo resultado independente da ordem', () => {
        const a = canonicalJson({ b: 1, a: 2 });
        const b = canonicalJson({ a: 2, b: 1 });
        expect(a).toBe(b);
    });
});

// ─── Criar dossiê ─────────────────────────────────────────────────────────────

describe('criarDossie', () => {
    it('cria dossiê com status rascunho e trilha inicial', () => {
        const d = criarDossie(dossieInput);
        expect(d.id).toBeTruthy();
        expect(d.status).toBe('rascunho');
        expect(d.cicloReferencia).toBe('2026-T1');
        expect(d.trilhaAuditoria).toHaveLength(1);
        expect(d.trilhaAuditoria[0].tipo).toBe('criacao');
        expect(d.trilhaAuditoria[0].snapshotHash).toHaveLength(64);
        expect(d.artefatos).toHaveLength(0);
        expect(d.validacoesBdgd).toHaveLength(0);
    });

    it('listarDossies retorna dossiê criado', () => {
        criarDossie(dossieInput);
        expect(listarDossies()).toHaveLength(1);
    });

    it('obterDossie retorna null para ID inexistente', () => {
        expect(obterDossie('nao-existe')).toBeNull();
    });
});

// ─── Vincular validação BDGD ──────────────────────────────────────────────────

describe('vincularValidacaoBdgd', () => {
    it('vincula relatório conforme e avança status para validado', () => {
        const d = criarDossie(dossieInput);
        const updated = vincularValidacaoBdgd(d.id, reportConformeFixture, 'eng-teste')!;
        expect(updated.validacoesBdgd).toHaveLength(1);
        expect(updated.status).toBe('validado');
        expect(updated.trilhaAuditoria).toHaveLength(2);
        expect(updated.trilhaAuditoria[1].tipo).toBe('validacao_bdgd');
        const vinc = updated.validacoesBdgd[0];
        expect(vinc.conforme).toBe(true);
        expect(vinc.camadas).toContain('SEGBT');
        expect(vinc.totalRegistros).toBe(10);
    });

    it('vincula relatório não conforme e mantém status rascunho', () => {
        const d = criarDossie(dossieInput);
        const updated = vincularValidacaoBdgd(d.id, reportNaoConformeFixture, 'eng-teste')!;
        expect(updated.status).toBe('rascunho');
        expect(updated.validacoesBdgd[0].conforme).toBe(false);
        expect(updated.validacoesBdgd[0].erros).toBe(1);
    });

    it('retorna null para dossiê inexistente', () => {
        expect(vincularValidacaoBdgd('nao-existe', reportConformeFixture, 'x')).toBeNull();
    });

    it('resumoDossies conformeBdgd=true quando todas validações conformes', () => {
        const d = criarDossie(dossieInput);
        vincularValidacaoBdgd(d.id, reportConformeFixture, 'x');
        const resumo = resumoDossies().find((r) => r.id === d.id)!;
        expect(resumo.conformeBdgd).toBe(true);
    });
});

// ─── Adicionar artefatos ──────────────────────────────────────────────────────

describe('adicionarArtefato', () => {
    it('calcula SHA-256 e adiciona artefato ao dossiê', () => {
        const d = criarDossie(dossieInput);
        const conteudo = 'COD_ID,COMP\n001,120.5\n002,85.0';
        const updated = adicionarArtefato(d.id, {
            nome: 'SEGBT.csv',
            tipo: 'csv',
            descricao: 'Segmentos BT do ciclo 2026-T1',
            conteudo,
            camadasCobertas: ['SEGBT'],
        }, 'eng-teste')!;

        expect(updated.artefatos).toHaveLength(1);
        const art = updated.artefatos[0];
        expect(art.nome).toBe('SEGBT.csv');
        expect(art.sha256).toHaveLength(64);
        expect(art.tamanhoBytes).toBe(Buffer.from(conteudo, 'utf8').length);
        expect(art.camadasCobertas).toContain('SEGBT');

        // evento de auditoria registrado
        const evt = updated.trilhaAuditoria.find((e) => e.tipo === 'adicao_artefato');
        expect(evt).toBeDefined();
        expect(evt?.metadados?.sha256).toBe(art.sha256);
    });

    it('retorna null para dossiê inexistente', () => {
        expect(adicionarArtefato('nao-existe', {
            nome: 'x', tipo: 'csv', descricao: 'x', conteudo: 'x', camadasCobertas: ['SEGBT'],
        }, 'x')).toBeNull();
    });
});

// ─── Submissão e arquivamento ─────────────────────────────────────────────────

describe('registrarSubmissao', () => {
    it('avança status para submetido e registra protocolo', () => {
        const d = criarDossie(dossieInput);
        vincularValidacaoBdgd(d.id, reportConformeFixture, 'x');
        const updated = registrarSubmissao(d.id, 'ANEEL-2026-00123', 'dpo')!;
        expect(updated.status).toBe('submetido');
        expect(updated.protocoloAneel).toBe('ANEEL-2026-00123');
        const evt = updated.trilhaAuditoria.find((e) => e.tipo === 'submissao_aneel');
        expect(evt).toBeDefined();
    });

    it('retorna null para dossiê inexistente', () => {
        expect(registrarSubmissao('nao-existe', 'X', 'x')).toBeNull();
    });
});

describe('arquivarDossie', () => {
    it('avança status para arquivado', () => {
        const d = criarDossie(dossieInput);
        const updated = arquivarDossie(d.id, 'admin')!;
        expect(updated.status).toBe('arquivado');
        expect(updated.trilhaAuditoria.at(-1)?.tipo).toBe('arquivamento');
    });

    it('retorna null para dossiê inexistente', () => {
        expect(arquivarDossie('nao-existe', 'x')).toBeNull();
    });
});

// ─── Exportação e integridade ─────────────────────────────────────────────────

describe('exportarPacote / verificarIntegridadePacote', () => {
    it('exporta pacote com schemaVersion e integrityHash válido', () => {
        const d = criarDossie(dossieInput);
        const pacote = exportarPacote(d.id)!;
        expect(pacote).toBeDefined();
        expect(pacote.schemaVersion).toBe('1.0');
        expect(pacote.integrityHash).toHaveLength(64);
        expect(pacote.dossie.id).toBe(d.id);
    });

    it('verificarIntegridadePacote retorna true para pacote íntegro', () => {
        const d = criarDossie(dossieInput);
        const pacote = exportarPacote(d.id)!;
        expect(verificarIntegridadePacote(pacote)).toBe(true);
    });

    it('verificarIntegridadePacote retorna false se pacote foi adulterado', () => {
        const d = criarDossie(dossieInput);
        const pacote = exportarPacote(d.id)!;
        // Adulterar campo
        const adulterado: PacoteExportavel = {
            ...pacote,
            dossie: { ...pacote.dossie, distribuidora: 'DISTRIBUIDORA FALSA' },
        };
        expect(verificarIntegridadePacote(adulterado)).toBe(false);
    });

    it('retorna null para dossiê inexistente', () => {
        expect(exportarPacote('nao-existe')).toBeNull();
    });

    it('hashPacoteFinal é salvo no dossiê após exportação', () => {
        const d = criarDossie(dossieInput);
        const pacote = exportarPacote(d.id)!;
        const updated = obterDossie(d.id)!;
        expect(updated.hashPacoteFinal).toBe(pacote.integrityHash);
    });
});

// ─── resumoDossies ────────────────────────────────────────────────────────────

describe('resumoDossies', () => {
    it('dentroDosPrazo=true para dossiê com prazo futuro', () => {
        const d = criarDossie(dossieInput);
        const resumo = resumoDossies().find((r) => r.id === d.id)!;
        expect(resumo.dentroDosPrazo).toBe(true);
    });

    it('dentroDosPrazo=true para dossiê submetido (independente do prazo)', () => {
        const passado = new Date(Date.now() - 1000).toISOString();
        const d = criarDossie({ ...dossieInput, prazoEntregaISO: passado });
        registrarSubmissao(d.id, 'X-001', 'admin');
        const resumo = resumoDossies().find((r) => r.id === d.id)!;
        expect(resumo.dentroDosPrazo).toBe(true);
    });

    it('totalArtefatos e totalValidacoes corretos', () => {
        const d = criarDossie(dossieInput);
        vincularValidacaoBdgd(d.id, reportConformeFixture, 'x');
        adicionarArtefato(d.id, {
            nome: 'f.csv', tipo: 'csv', descricao: 'teste', conteudo: 'a,b', camadasCobertas: ['SEGBT'],
        }, 'x');
        const resumo = resumoDossies().find((r) => r.id === d.id)!;
        expect(resumo.totalValidacoes).toBe(1);
        expect(resumo.totalArtefatos).toBe(1);
    });
});
