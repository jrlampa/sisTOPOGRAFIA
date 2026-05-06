/**
 * Serviço T2-57 — sisTOPOGRAFIA Academy
 * Tutoriais interativos e trilhas de certificação técnica integradas.
 */

import { createHash } from "crypto";

export type NivelDificuldade = "basico" | "intermediario" | "avancado" | "especialista";
export type TipoConteudo = "video" | "texto" | "quiz" | "simulacao" | "pratica_guiada";
export type StatusTrilha = "rascunho" | "publicada" | "arquivada";

export interface Modulo {
  id: string;
  cursoId: string;
  titulo: string;
  tipoConteudo: TipoConteudo;
  cargaHorariaMin: number;
  ordem: number;
  criadoEm: string;
}

export interface Curso {
  id: string;
  trilhaId: string;
  titulo: string;
  descricao: string;
  modulos: Modulo[];
  cargaHorariaH: number;
  ordem: number;
  criadoEm: string;
}

export interface Trilha {
  id: string;
  tenantId: string;
  titulo: string;
  descricao: string;
  nivelDificuldade: NivelDificuldade;
  categorias: string[];
  cursos: Curso[];
  certificadoNome: string;
  cargaHorariaTotalH: number;
  status: StatusTrilha;
  criadoEm: string;
}

export interface ProgressoAluno {
  id: string;
  usuarioId: string;
  trilhaId: string;
  modulosConcluidosIds: string[];
  percentualConcluido: number;
  iniciadoEm: string;
  ultimaAtividadeEm: string;
  certificadoEmitido: boolean;
  hashCertificado?: string;
}

const CATEGORIAS_VALIDAS = ["eletrica", "topografia", "normas", "bim", "sig", "geoprocessamento", "gestao_projetos"];

let _trilhaCounter = 0;
let _cursoCounter = 0;
let _moduloCounter = 0;
let _progressoCounter = 0;
const _trilhas = new Map<string, Trilha>();
const _cursos = new Map<string, Curso>();
const _progressos = new Map<string, ProgressoAluno>();

export class AcademyService {
  static _reset(): void {
    _trilhaCounter = 0;
    _cursoCounter = 0;
    _moduloCounter = 0;
    _progressoCounter = 0;
    _trilhas.clear();
    _cursos.clear();
    _progressos.clear();
  }

  static criarTrilha(data: {
    tenantId: string;
    titulo: string;
    descricao: string;
    nivelDificuldade: NivelDificuldade;
    categorias: string[];
    certificadoNome: string;
  }): Trilha {
    const id = `tr-${++_trilhaCounter}`;
    const trilha: Trilha = {
      id,
      tenantId: data.tenantId,
      titulo: data.titulo,
      descricao: data.descricao,
      nivelDificuldade: data.nivelDificuldade,
      categorias: data.categorias,
      cursos: [],
      certificadoNome: data.certificadoNome,
      cargaHorariaTotalH: 0,
      status: "rascunho",
      criadoEm: new Date().toISOString(),
    };
    _trilhas.set(id, trilha);
    return trilha;
  }

  static listarTrilhas(tenantId?: string): Trilha[] {
    const all = Array.from(_trilhas.values());
    return tenantId ? all.filter((t) => t.tenantId === tenantId) : all;
  }

  static obterTrilha(id: string): Trilha | undefined {
    return _trilhas.get(id);
  }

  static adicionarCurso(
    trilhaId: string,
    data: {
      titulo: string;
      descricao: string;
      cargaHorariaH: number;
      ordem: number;
    }
  ): Curso {
    const trilha = _trilhas.get(trilhaId);
    if (!trilha) throw new Error("Trilha não encontrada");
    const cursoId = `cu-${++_cursoCounter}`;
    const curso: Curso = {
      id: cursoId,
      trilhaId,
      titulo: data.titulo,
      descricao: data.descricao,
      modulos: [],
      cargaHorariaH: data.cargaHorariaH,
      ordem: data.ordem,
      criadoEm: new Date().toISOString(),
    };
    _cursos.set(cursoId, curso);
    trilha.cursos.push(curso);
    trilha.cargaHorariaTotalH += data.cargaHorariaH;
    return curso;
  }

  static adicionarModulo(
    cursoId: string,
    data: {
      titulo: string;
      tipoConteudo: TipoConteudo;
      cargaHorariaMin: number;
      ordem: number;
    }
  ): Modulo {
    const curso = _cursos.get(cursoId);
    if (!curso) throw new Error("Curso não encontrado");
    const modulo: Modulo = {
      id: `mo-${++_moduloCounter}`,
      cursoId,
      titulo: data.titulo,
      tipoConteudo: data.tipoConteudo,
      cargaHorariaMin: data.cargaHorariaMin,
      ordem: data.ordem,
      criadoEm: new Date().toISOString(),
    };
    curso.modulos.push(modulo);
    return modulo;
  }

  static publicarTrilha(trilhaId: string): Trilha {
    const trilha = _trilhas.get(trilhaId);
    if (!trilha) throw new Error("Trilha não encontrada");
    if (trilha.cursos.length === 0) throw new Error("Trilha deve ter ao menos 1 curso para ser publicada");
    trilha.status = "publicada";
    return trilha;
  }

  static iniciarProgresso(data: {
    usuarioId: string;
    trilhaId: string;
  }): ProgressoAluno {
    const trilha = _trilhas.get(data.trilhaId);
    if (!trilha) throw new Error("Trilha não encontrada");
    if (trilha.status !== "publicada") throw new Error("Trilha não está publicada");
    const id = `pg-${++_progressoCounter}`;
    const now = new Date().toISOString();
    const progresso: ProgressoAluno = {
      id,
      usuarioId: data.usuarioId,
      trilhaId: data.trilhaId,
      modulosConcluidosIds: [],
      percentualConcluido: 0,
      iniciadoEm: now,
      ultimaAtividadeEm: now,
      certificadoEmitido: false,
    };
    _progressos.set(id, progresso);
    return progresso;
  }

  static concluirModulo(progressoId: string, moduloId: string): ProgressoAluno {
    const progresso = _progressos.get(progressoId);
    if (!progresso) throw new Error("Progresso não encontrado");
    const trilha = _trilhas.get(progresso.trilhaId);
    if (!trilha) throw new Error("Trilha não encontrada");
    if (!progresso.modulosConcluidosIds.includes(moduloId)) {
      progresso.modulosConcluidosIds.push(moduloId);
    }
    const totalModulos = trilha.cursos.reduce((acc, c) => acc + c.modulos.length, 0);
    progresso.percentualConcluido =
      totalModulos > 0
        ? Math.round((progresso.modulosConcluidosIds.length / totalModulos) * 100)
        : 0;
    progresso.ultimaAtividadeEm = new Date().toISOString();
    return progresso;
  }

  static emitirCertificado(progressoId: string): ProgressoAluno {
    const progresso = _progressos.get(progressoId);
    if (!progresso) throw new Error("Progresso não encontrado");
    if (progresso.percentualConcluido < 100) {
      throw new Error("Certificado só pode ser emitido com 100% de conclusão");
    }
    progresso.certificadoEmitido = true;
    progresso.hashCertificado = createHash("sha256")
      .update(`${progresso.usuarioId}|${progresso.trilhaId}|${Date.now()}`)
      .digest("hex");
    progresso.ultimaAtividadeEm = new Date().toISOString();
    return progresso;
  }

  static listarCategorias(): string[] {
    return CATEGORIAS_VALIDAS;
  }
}
