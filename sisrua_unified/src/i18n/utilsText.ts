import { AppLocale } from "../types";

export const getUtilsText = (locale: AppLocale) => {
  const texts = {
    "pt-BR": {
      kml: {
          readTextError: "Falha ao ler o arquivo como texto.",
          readBinaryError: "Falha ao ler o arquivo como binário.",
          invalidContent: "Conteúdo KML inválido.",
          noCoords: "Nenhuma coordenada encontrada no KML/KMZ.",
          noValidCoords: "Nenhuma coordenada válida encontrada no KML/KMZ.",
          noValidMarkers: "Nenhuma coordenada de marcador válida encontrada no KML/KMZ.",
          noInternalKml: "Arquivo KMZ sem arquivo .kml interno.",
      },
      download: {
          emptyFilename: "O nome do arquivo deve ser uma string não vazia",
          invalidFilename: "Nome de arquivo inválido após sanitização",
          emptyContent: "O conteúdo não pode estar vazio",
          invalidMime: "Tipo MIME inválido",
      },
      sanitization: {
          stringExpected: "A entrada deve ser uma string",
          invalidNumber: "A entrada não é um número válido",
          numberRange: "O número deve estar entre {{min}} e {{max}}",
          invalidJson: "JSON fornecido é inválido",
      }
    },
    "en-US": {
      kml: {
          readTextError: "Failed to read file as text.",
          readBinaryError: "Failed to read file as binary.",
          invalidContent: "Invalid KML content.",
          noCoords: "No coordinates found in KML/KMZ.",
          noValidCoords: "No valid coordinates found in KML/KMZ.",
          noValidMarkers: "No valid markers found in KML/KMZ.",
          noInternalKml: "KMZ file without internal .kml file.",
      },
      download: {
          emptyFilename: "Filename must be a non-empty string",
          invalidFilename: "Invalid filename after sanitization",
          emptyContent: "Content cannot be empty",
          invalidMime: "Invalid MIME type",
      },
      sanitization: {
          stringExpected: "Input must be a string",
          invalidNumber: "Input is not a valid number",
          numberRange: "Number must be between {{min}} and {{max}}",
          invalidJson: "Provided JSON is invalid",
      }
    },
    "es-ES": {
      kml: {
          readTextError: "Error al leer el archivo como texto.",
          readBinaryError: "Error al leer el archivo como binario.",
          invalidContent: "Contenido KML no válido.",
          noCoords: "No se encontraron coordenadas en el KML/KMZ.",
          noValidCoords: "No se encontraron coordenadas válidas en el KML/KMZ.",
          noValidMarkers: "No se encontraron marcadores válidos en el KML/KMZ.",
          noInternalKml: "Archivo KMZ sin archivo .kml interno.",
      },
      download: {
          emptyFilename: "El nombre del archivo debe ser una cadena no vacía",
          invalidFilename: "Nombre de archivo no válido después de la sanitización",
          emptyContent: "El contenido no puede estar vacío",
          invalidMime: "Tipo MIME no válido",
      },
      sanitization: {
          stringExpected: "La entrada debe ser una cadena",
          invalidNumber: "La entrada no es un número válido",
          numberRange: "El número debe estar entre {{min}} y {{max}}",
          invalidJson: "El JSON proporcionado no es válido",
      }
    },
  };

  return texts[locale] || texts["pt-BR"];
};
