import { useState } from 'react';
import { parseKml, KmlMarker } from '../utils/kmlParser';
import { GeoLocation } from '../types';

export interface KmlImportResult {
  type: 'polygon' | 'markers';
  points: GeoLocation[];           // polygon: boundary points; markers: one per placemark
  names?: (string | undefined)[];  // only present for markers
}

interface UseKmlImportProps {
  onImportSuccess: (result: KmlImportResult, filename: string) => void;
  onError: (message: string) => void;
}

export function useKmlImport({ onImportSuccess, onError }: UseKmlImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const importKml = async (file: File) => {
    setIsProcessing(true);
    
    try {
      const parsed = await parseKml(file);
      const filename = file.name.replace(/\.(kml|kmz)$/i, '');

      if (parsed.type === 'polygon') {
        if (parsed.points.length === 0) throw new Error('No valid points found in KML/KMZ file');
        onImportSuccess({
          type: 'polygon',
          points: parsed.points.map(p => ({ lat: p[0], lng: p[1] }))
        }, filename);
      } else {
        if (parsed.markers.length === 0) throw new Error('No valid markers found in KML/KMZ file');
        onImportSuccess({
          type: 'markers',
          points: parsed.markers.map((m: KmlMarker) => ({ lat: m.point[0], lng: m.point[1] })),
          names: parsed.markers.map((m: KmlMarker) => m.name)
        }, filename);
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KML/KMZ import failed';
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
