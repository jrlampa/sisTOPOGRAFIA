import { useState } from 'react';
import { parseKml, KmlMarker } from '../utils/kmlParser';
import { GeoLocation } from '../types';
import type { AppLocale } from '../types';
import { normalizeAppLocale } from '../i18n/appLocale';

export interface KmlImportResult {
  type: 'polygon' | 'markers';
  points: GeoLocation[];           // polygon: boundary points; markers: one per placemark
  names?: (string | undefined)[];  // only present for markers
}

interface UseKmlImportProps {
  locale?: AppLocale;
  onImportSuccess: (result: KmlImportResult, filename: string) => void;
  onError: (message: string) => void;
}

const KML_IMPORT_TEXT = {
  "pt-BR": {
    noValidPoints: 'Nenhum ponto válido encontrado no arquivo KML/KMZ',
    noValidMarkers: 'Nenhum marcador válido encontrado no arquivo KML/KMZ',
    importFailed: 'Falha na importação do KML/KMZ',
    failedReadText: 'Falha ao ler o arquivo como texto.',
    failedReadBinary: 'Falha ao ler o arquivo como binário.',
  },
  "en-US": {
    noValidPoints: 'No valid points found in the KML/KMZ file',
    noValidMarkers: 'No valid markers found in the KML/KMZ file',
    importFailed: 'KML/KMZ import failed',
    failedReadText: 'Failed to read file as text.',
    failedReadBinary: 'Failed to read file as binary.',
  },
  "es-ES": {
    noValidPoints: 'No se encontraron puntos válidos en el archivo KML/KMZ',
    noValidMarkers: 'No se encontraron marcadores válidos en el archivo KML/KMZ',
    importFailed: 'Falló la importación de KML/KMZ',
    failedReadText: 'Error al leer el archivo como texto.',
    failedReadBinary: 'Error al leer el archivo como binario.',
  },
} as const;

export function useKmlImport({ locale, onImportSuccess, onError }: UseKmlImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const normalizedLocale = normalizeAppLocale(locale);
  const text = KML_IMPORT_TEXT[normalizedLocale];

  const translateErrorMessage = (message: string): string => {
    switch (message) {
      case 'Failed to read file as text.':
        return text.failedReadText;
      case 'Failed to read file as binary.':
        return text.failedReadBinary;
      default:
        return message;
    }
  };

  const importKml = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const parsed = await parseKml(file);
      const filename = file.name.replace(/\.(kml|kmz)$/i, '');

      if (parsed.type === 'polygon') {
        if (parsed.points.length === 0) throw new Error(text.noValidPoints);
        onImportSuccess({
          type: 'polygon',
          points: parsed.points.map(p => ({ lat: p[0], lng: p[1] }))
        }, filename);
      } else {
        if (parsed.markers.length === 0) throw new Error(text.noValidMarkers);
        onImportSuccess({
          type: 'markers',
          points: parsed.markers.map((m: KmlMarker) => ({ lat: m.point[0], lng: m.point[1] })),
          names: parsed.markers.map((m: KmlMarker) => m.name)
        }, filename);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error
        ? translateErrorMessage(error.message)
        : text.importFailed;
      onError(message);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    importKml,
    isProcessing
  };
}
