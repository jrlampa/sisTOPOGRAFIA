import { AppLocale } from "../types";

export interface SelectionManagerText {
  addConductorBt: string;
  addTransformerBt: string;
  addPoleBt: string;
  addSpanMt: string;
  addPoleMt: string;
  deletePoint: string;
  keepPoint: string;
  dragHint: string;
  selectedLabel: string;
  btLabel: string;
  mtLabel: string;
}

export const selectionManagerText: Record<AppLocale, SelectionManagerText> = {
  "pt-BR": {
    addConductorBt: "+CONDUTOR (BT)",
    addTransformerBt: "+TRAFO (BT)",
    addPoleBt: "+POSTE (BT)",
    addSpanMt: "+VÃO (MT)",
    addPoleMt: "+POSTE (MT)",
    deletePoint: "Excluir ponto",
    keepPoint: "Manter ponto",
    dragHint: "Dica: clique e arraste o marcador para reposicionar.",
    selectedLabel: "Selecionado",
    btLabel: "BT",
    mtLabel: "MT",
  },
  "en-US": {
    addConductorBt: "+CONDUCTOR (BT)",
    addTransformerBt: "+TRANSFORMER (BT)",
    addPoleBt: "+POLE (BT)",
    addSpanMt: "+SPAN (MT)",
    addPoleMt: "+POLE (MT)",
    deletePoint: "Delete point",
    keepPoint: "Keep point",
    dragHint: "Tip: click and drag marker to reposition.",
    selectedLabel: "Selected",
    btLabel: "BT",
    mtLabel: "MT",
  },
  "es-ES": {
    addConductorBt: "+CONDUCTOR (BT)",
    addTransformerBt: "+TRAFO (BT)",
    addPoleBt: "+POSTE (BT)",
    addSpanMt: "+TRAMO (MT)",
    addPoleMt: "+POSTE (MT)",
    deletePoint: "Eliminar punto",
    keepPoint: "Mantener punto",
    dragHint: "Consejo: haga clic y arrastre el marcador para reposicionar.",
    selectedLabel: "Seleccionado",
    btLabel: "BT",
    mtLabel: "MT",
  },
};

export const getSelectionManagerText = (locale: AppLocale) => selectionManagerText[locale];
