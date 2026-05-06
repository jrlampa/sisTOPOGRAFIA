import type { AppLocale } from "../types";

type DxfProgressText = {
  sectionLabel: string;
  continueNavigation: string;
  failedMessage: string;
  closeAriaLabel: string;
};

const TEXTS: Record<AppLocale, DxfProgressText> = {
  "pt-BR": {
    sectionLabel: "Processamento DXF",
    continueNavigation:
      "Você pode continuar navegando no mapa enquanto o arquivo é gerado.",
    failedMessage:
      "Falha ao gerar o arquivo. Verifique os dados e tente novamente.",
    closeAriaLabel: "Fechar notificação de DXF",
  },
  "en-US": {
    sectionLabel: "DXF Processing",
    continueNavigation:
      "You can keep navigating the map while the file is being generated.",
    failedMessage: "Failed to generate the file. Check the data and try again.",
    closeAriaLabel: "Close DXF notification",
  },
  "es-ES": {
    sectionLabel: "Procesamiento DXF",
    continueNavigation:
      "Puedes seguir navegando en el mapa mientras se genera el archivo.",
    failedMessage:
      "Error al generar el archivo. Verifique los datos e intente de nuevo.",
    closeAriaLabel: "Cerrar notificación DXF",
  },
};

export function getDxfProgressText(locale: AppLocale): DxfProgressText {
  return TEXTS[locale] ?? TEXTS["pt-BR"];
}
