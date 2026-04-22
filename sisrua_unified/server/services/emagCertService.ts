/**
 * emagCertService.ts — Certificação de Acessibilidade eMAG (97 [T1])
 *
 * Modela a conformidade com eMAG 3.1 (Modelo de Acessibilidade em Governo Eletrônico):
 * - Registro de requisitos eMAG por seção
 * - Vinculação com evidências de conformidade (screenshots, testes)
 * - Geração de relatório de certificação com percentual
 * - Histórico de inspeções
 */

export type StatusConformidade = "conforme" | "parcialmente_conforme" | "nao_conforme" | "nao_aplicavel";
export type SecaoEmag =
  | "1_marcacao"
  | "2_comportamento"
  | "3_conteudo"
  | "4_apresentacao"
  | "5_multimidia"
  | "6_formulario";

export interface RequisitoEmag {
  id: string;
  secao: SecaoEmag;
  codigo: string;        // ex: "1.1", "2.4", "6.3"
  titulo: string;
  descricao: string;
  nivel: "A" | "AA" | "AAA";
}

export interface EvidenciaConformidade {
  id: string;
  requisitoId: string;
  status: StatusConformidade;
  descricao: string;
  responsavel: string;
  registradoEm: string;
  artefato?: string;     // nome do arquivo ou URL da evidência
}

export interface InspecaoEmag {
  id: string;
  titulo: string;
  versaoSistema: string;
  responsavel: string;
  criadoEm: string;
  concluidoEm?: string;
  evidencias: EvidenciaConformidade[];
  percentualConformidade?: number;
  certificadoEmitido: boolean;
}

// Catálogo base de requisitos eMAG 3.1 (amostra dos principais)
const CATALOGO_REQUISITOS: RequisitoEmag[] = [
  { id: "r1.1", secao: "1_marcacao", codigo: "1.1", titulo: "Respeitar os Padrões Web", descricao: "HTML válido segundo W3C", nivel: "A" },
  { id: "r1.2", secao: "1_marcacao", codigo: "1.2", titulo: "Organizar o Código de Forma Lógica", descricao: "Estrutura de cabeçalhos (h1-h6) hierárquica", nivel: "A" },
  { id: "r2.1", secao: "2_comportamento", codigo: "2.1", titulo: "Não Abrir Novas Instâncias", descricao: "Links e formulários não devem abrir nova janela sem aviso", nivel: "A" },
  { id: "r2.4", secao: "2_comportamento", codigo: "2.4", titulo: "Disponibilizar Salto para Conteúdo Principal", descricao: "Link de salto para conteúdo (skip-link) no início da página", nivel: "A" },
  { id: "r3.1", secao: "3_conteudo", codigo: "3.1", titulo: "Identificar o Idioma Principal", descricao: "Atributo lang no HTML", nivel: "A" },
  { id: "r3.5", secao: "3_conteudo", codigo: "3.5", titulo: "Descrever Links com Clareza", descricao: "Textos de links descritivos e únicos na página", nivel: "A" },
  { id: "r4.1", secao: "4_apresentacao", codigo: "4.1", titulo: "Oferecer Contraste Mínimo", descricao: "Relação de contraste >= 4.5:1 para textos normais", nivel: "AA" },
  { id: "r4.4", secao: "4_apresentacao", codigo: "4.4", titulo: "Possibilitar Visualização sem Rolagem Horizontal", descricao: "Responsividade sem scroll horizontal em 320px", nivel: "AA" },
  { id: "r6.1", secao: "6_formulario", codigo: "6.1", titulo: "Fornecer Alternativa em Texto para as Imagens", descricao: "Atributo alt descritivo em todas as imagens funcionais", nivel: "A" },
  { id: "r6.3", secao: "6_formulario", codigo: "6.3", titulo: "Associar Etiquetas com Campos", descricao: "Todos os campos de formulário com label associado (for/id)", nivel: "A" },
];

const inspecoes = new Map<string, InspecaoEmag>();
let iSeq = 1;
let eSeq = 1;

export class EmagCertService {
  static listarRequisitos(secao?: SecaoEmag): RequisitoEmag[] {
    if (secao) return CATALOGO_REQUISITOS.filter((r) => r.secao === secao);
    return [...CATALOGO_REQUISITOS];
  }

  static criarInspecao(dados: {
    titulo: string;
    versaoSistema: string;
    responsavel: string;
  }): InspecaoEmag {
    const id = `emag-${iSeq++}`;
    const inspecao: InspecaoEmag = {
      ...dados,
      id,
      criadoEm: new Date().toISOString(),
      evidencias: [],
      certificadoEmitido: false,
    };
    inspecoes.set(id, inspecao);
    return inspecao;
  }

  static registrarEvidencia(
    inspecaoId: string,
    dados: Omit<EvidenciaConformidade, "id" | "registradoEm">
  ): EvidenciaConformidade {
    const inspecao = inspecoes.get(inspecaoId);
    if (!inspecao) throw new Error(`Inspeção '${inspecaoId}' não encontrada`);

    const req = CATALOGO_REQUISITOS.find((r) => r.id === dados.requisitoId);
    if (!req) throw new Error(`Requisito '${dados.requisitoId}' não encontrado`);

    const evidencia: EvidenciaConformidade = {
      ...dados,
      id: `ev-${eSeq++}`,
      registradoEm: new Date().toISOString(),
    };
    inspecao.evidencias.push(evidencia);
    return evidencia;
  }

  static concluirInspecao(inspecaoId: string): InspecaoEmag {
    const inspecao = inspecoes.get(inspecaoId);
    if (!inspecao) throw new Error(`Inspeção '${inspecaoId}' não encontrada`);

    const total = CATALOGO_REQUISITOS.length;
    const conformes = inspecao.evidencias.filter(
      (e) => e.status === "conforme" || e.status === "nao_aplicavel"
    ).length;
    inspecao.percentualConformidade = Math.round((conformes / total) * 100);
    inspecao.concluidoEm = new Date().toISOString();
    // Certificado emitido se >= 80% de conformidade e todos os A são conformes
    const naoConformesA = inspecao.evidencias.filter((e) => {
      const req = CATALOGO_REQUISITOS.find((r) => r.id === e.requisitoId);
      return req?.nivel === "A" && e.status === "nao_conforme";
    });
    inspecao.certificadoEmitido = inspecao.percentualConformidade >= 80 && naoConformesA.length === 0;

    return { ...inspecao };
  }

  static listarInspecoes(): InspecaoEmag[] {
    return [...inspecoes.values()];
  }

  static getInspecao(id: string): InspecaoEmag {
    const i = inspecoes.get(id);
    if (!i) throw new Error(`Inspeção '${id}' não encontrada`);
    return i;
  }

  static _reset(): void {
    inspecoes.clear();
    iSeq = 1;
    eSeq = 1;
  }
}
