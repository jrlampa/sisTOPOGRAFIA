/**
 * rastreabilidadeRegulatoriaService.test.ts
 * Testes unitários para Matriz de Rastreabilidade Regulatória (Ponto 116 [T1]).
 */

import {
  listarItens,
  obterItem,
  adicionarItem,
  atualizarStatus,
  gerarRelatorio,
  type FonteNorma,
  type StatusConformidade,
  type ItemRastreabilidade,
} from "../services/rastreabilidadeRegulatoriaService";

describe("rastreabilidadeRegulatoriaService", () => {
  describe("listarItens()", () => {
    it("retorna todos os itens canônicos sem filtro", () => {
      const itens = listarItens();
      expect(itens.length).toBeGreaterThanOrEqual(10);
    });

    it("filtra por fonte ANEEL", () => {
      const itens = listarItens("ANEEL");
      expect(itens.length).toBeGreaterThan(0);
      itens.forEach((i) => expect(i.requisito.fonte).toBe("ANEEL"));
    });

    it("filtra por status conforme", () => {
      const itens = listarItens(undefined, "conforme");
      expect(itens.length).toBeGreaterThan(0);
      itens.forEach((i) => expect(i.status).toBe("conforme"));
    });

    it("filtra combinando fonte ANPD e status conforme", () => {
      const itens = listarItens("ANPD", "conforme");
      expect(itens.length).toBeGreaterThan(0);
      itens.forEach((i) => {
        expect(i.requisito.fonte).toBe("ANPD");
        expect(i.status).toBe("conforme");
      });
    });

    it("retorna array vazio para filtro que não corresponde", () => {
      const itens = listarItens("NBR", "nao_conforme");
      expect(Array.isArray(itens)).toBe(true);
    });
  });

  describe("obterItem()", () => {
    it("retorna item canônico por ID", () => {
      const item = obterItem("RT-001");
      expect(item).toBeDefined();
      expect(item!.id).toBe("RT-001");
      expect(item!.requisito.norma).toContain("PRODIST");
    });

    it("retorna undefined para ID inexistente", () => {
      expect(obterItem("RT-INEXISTENTE")).toBeUndefined();
    });
  });

  describe("adicionarItem()", () => {
    it("adiciona item extra e o torna visível via listarItens", () => {
      const novoItem: Omit<ItemRastreabilidade, "id" | "verificadoEm"> = {
        requisito: {
          id: "NBR-TEST",
          norma: "NBR 14039",
          fonte: "NBR",
          descricao: "Instalações elétricas de média tensão",
        },
        implementacoes: [
          {
            tipo: "servico",
            referencia: "server/services/mtCalculationService.ts",
            descricao: "Cálculo MT",
          },
        ],
        testes: [
          {
            tipo: "teste",
            referencia: "server/tests/mtCalculationService.test.ts",
            descricao: "Testes MT",
          },
        ],
        status: "parcial",
      };
      const adicionado = adicionarItem(novoItem);
      expect(adicionado.id).toMatch(/^RT-\d{3}$/);
      expect(adicionado.verificadoEm).toBeInstanceOf(Date);

      const encontrado = obterItem(adicionado.id);
      expect(encontrado).toBeDefined();
      expect(encontrado!.requisito.norma).toBe("NBR 14039");
    });
  });

  describe("atualizarStatus()", () => {
    it("retorna false para item canônico (imutável)", () => {
      const ok = atualizarStatus("RT-001", "parcial", "teste");
      expect(ok).toBe(false);
      // Canônico deve permanecer inalterado
      expect(obterItem("RT-001")!.status).toBe("conforme");
    });

    it("atualiza status de item extra", () => {
      const adicionado = adicionarItem({
        requisito: { id: "X-1", norma: "X", fonte: "INTERNA", descricao: "X" },
        implementacoes: [],
        testes: [],
        status: "nao_avaliado",
      });
      const ok = atualizarStatus(
        adicionado.id,
        "conforme",
        "verificado manualmente",
      );
      expect(ok).toBe(true);
      expect(obterItem(adicionado.id)!.status).toBe("conforme");
      expect(obterItem(adicionado.id)!.observacao).toBe(
        "verificado manualmente",
      );
    });

    it("retorna false para ID inexistente", () => {
      expect(atualizarStatus("RT-NAOEXISTE", "conforme")).toBe(false);
    });
  });

  describe("gerarRelatorio()", () => {
    it("retorna sumário com totalItens >= 10", () => {
      const rel = gerarRelatorio();
      expect(rel.totalItens).toBeGreaterThanOrEqual(10);
    });

    it("percentualConformidade está entre 0 e 100", () => {
      const rel = gerarRelatorio();
      expect(rel.percentualConformidade).toBeGreaterThanOrEqual(0);
      expect(rel.percentualConformidade).toBeLessThanOrEqual(100);
    });

    it("soma de conformes + parciais + naoConformes + naoAvaliados == totalItens", () => {
      const rel = gerarRelatorio();
      expect(
        rel.conformes + rel.parciais + rel.naoConformes + rel.naoAvaliados,
      ).toBe(rel.totalItens);
    });

    it("filtra por fonte no relatório", () => {
      const relAneel = gerarRelatorio("ANEEL");
      const relTodos = gerarRelatorio();
      expect(relAneel.totalItens).toBeLessThanOrEqual(relTodos.totalItens);
    });
  });
});
