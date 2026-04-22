/**
 * artifactHardeningService.ts — Hardening de Artefatos contra Injeção (50 [T1])
 *
 * Proteção de arquivos técnicos (DXF, JSON, CSV) contra:
 * - Injeção de scripts/macros
 * - Path traversal em nomes de arquivo
 * - Conteúdo malicioso em campos de texto
 * - Exfiltração via comentários DXF
 */

export type RiscoArtefato = "injecao_script" | "path_traversal" | "macro_embedded" | "encoding_suspeito" | "tamanho_excessivo";
export type NivelRisco = "baixo" | "medio" | "alto" | "critico";

export interface HardeningCheck {
  tipo: RiscoArtefato;
  descricao: string;
  nivel: NivelRisco;
  offset?: number;
  trecho?: string;
}

export interface HardeningResult {
  artefatoId: string;
  nomeArquivo: string;
  tipoArquivo: string;
  inspecionadoEm: string;
  aprovado: boolean;
  riscos: HardeningCheck[];
  hashConteudo: string;
  bytesAnalisados: number;
}

import crypto from "crypto";

// Padrões de conteúdo suspeito
const PATTERNS_INJECAO = [
  /(<script[\s>])/i,
  /(javascript\s*:)/i,
  /(vbscript\s*:)/i,
  /(\beval\s*\()/i,
  /(MTEXT.*\\\\U\+[0-9A-Fa-f]{4,})/,  // Unicode injection em DXF MTEXT
];

const PATTERNS_MACRO = [
  /(\bAutoCAD\s+LISP\b)/i,
  /(\(command\s+)/i,   // AutoLISP command
  /(\bVBA\s+Module\b)/i,
];

function sha256Short(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function sanitizarNomeArquivo(nome: string): string {
  // Remove path traversal, mantém apenas caracteres seguros
  return nome
    .replace(/\.\./g, "")
    .replace(/[/\\:*?"<>|]/g, "_")
    .slice(0, 255);
}

export class ArtifactHardeningService {
  static inspecionarConteudo(
    conteudo: string,
    nomeArquivo: string,
    tipoArquivo: string
  ): HardeningResult {
    const riscos: HardeningCheck[] = [];

    // Path traversal no nome do arquivo
    if (/(\.\.|[/\\])/.test(nomeArquivo)) {
      riscos.push({
        tipo: "path_traversal",
        descricao: `Nome de arquivo suspeito: '${nomeArquivo}'`,
        nivel: "alto",
      });
    }

    // Tamanho excessivo (>50MB)
    if (conteudo.length > 50 * 1024 * 1024) {
      riscos.push({
        tipo: "tamanho_excessivo",
        descricao: `Arquivo excede 50MB (${Math.round(conteudo.length / 1024 / 1024)}MB)`,
        nivel: "medio",
      });
    }

    // Injeção de scripts
    for (const pattern of PATTERNS_INJECAO) {
      const match = pattern.exec(conteudo);
      if (match) {
        riscos.push({
          tipo: "injecao_script",
          descricao: `Padrão suspeito detectado: '${match[0]}'`,
          nivel: "critico",
          offset: match.index,
          trecho: conteudo.slice(Math.max(0, match.index - 20), match.index + 40),
        });
      }
    }

    // Macros embutidas
    for (const pattern of PATTERNS_MACRO) {
      const match = pattern.exec(conteudo);
      if (match) {
        riscos.push({
          tipo: "macro_embedded",
          descricao: `Macro embutida detectada: '${match[0]}'`,
          nivel: "alto",
          offset: match.index,
        });
      }
    }

    // Encoding suspeito (null bytes, caracteres de controle inesperados)
    const nullBytes = (conteudo.match(/\x00/g) || []).length;
    if (nullBytes > 10) {
      riscos.push({
        tipo: "encoding_suspeito",
        descricao: `${nullBytes} null bytes detectados — possível encoding suspeito`,
        nivel: "medio",
      });
    }

    const aprovado = !riscos.some((r) => r.nivel === "critico" || r.nivel === "alto");

    return {
      artefatoId: `art-${Date.now()}`,
      nomeArquivo: sanitizarNomeArquivo(nomeArquivo),
      tipoArquivo,
      inspecionadoEm: new Date().toISOString(),
      aprovado,
      riscos,
      hashConteudo: sha256Short(conteudo),
      bytesAnalisados: conteudo.length,
    };
  }

  static sanitizarTexto(texto: string): string {
    return texto
      .replace(/(<script[\s>].*?<\/script>)/gis, "[REMOVIDO]")
      .replace(/(javascript\s*:)/gi, "javascript_blocked:")
      .replace(/\x00/g, "")
      .slice(0, 10_000);
  }

  static sanitizarNomeArquivo(nome: string): string {
    return sanitizarNomeArquivo(nome);
  }
}
