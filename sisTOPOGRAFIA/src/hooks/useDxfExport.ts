import { useEffect, useState } from 'react';
import { generateDXF, getDxfJobStatus } from '../services/dxfService';
import { SelectionMode, GeoLocation, LayerConfig, EconomicData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Logger from '../utils/logger';

interface UseDxfExportProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useDxfExport({ onSuccess, onError }: UseDxfExportProps) {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState('idle');
  const [jobProgress, setJobProgress] = useState(0);
  const [downloadCenter, setDownloadCenter] = useState<GeoLocation | null>(null);
  const [heatmapData, setHeatmapData] = useState<any | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [economicData, setEconomicData] = useState<EconomicData | null>(null);
  const [longitudinalProfile, setLongitudinalProfile] = useState<Array<{ distance: number, elevation: number }> | null>(null);

  const triggerDownload = (url: string, center: GeoLocation) => {
    const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const downloadDxf = async (
    center: GeoLocation,
    radius: number,
    selectionMode: SelectionMode,
    polygon: GeoLocation[],
    layers: LayerConfig,
    projection: 'local' | 'utm' = 'utm',
    enableAI: boolean = true
  ) => {
    setIsDownloading(true);
    setJobStatus('queued');
    setJobProgress(0);

    try {
      // Obtain the Firebase ID token so the backend can authenticate the request
      let authToken: string | undefined;
      if (user) {
        try {
          authToken = await user.getIdToken();
        } catch (tokenError) {
          Logger.warn('Could not retrieve Firebase ID token', tokenError);
        }
      }

      const result = await generateDXF(
        center.lat,
        center.lng,
        radius,
        selectionMode,
        polygon,
        layers,
        projection,
        enableAI,
        authToken
      );

      if (!result) {
        throw new Error('Backend failed to queue DXF generation');
      }

      if ('url' in result && result.url) {
        triggerDownload(result.url, center);
        onSuccess('DXF Downloaded');
        setIsDownloading(false);
        setJobStatus('completed');
        setJobProgress(100);
        return true;
      }

      if ('jobId' in result && result.jobId) {
        setDownloadCenter(center);
        setJobId(String(result.jobId));
        return true;
      }

      throw new Error('Backend failed to queue DXF generation');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DXF generation failed';
      setIsDownloading(false);
      setJobStatus('failed');
      onError(`DXF Error: ${message}`);
      return false;
    }
  };

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(async () => {
      try {
        const statusResponse = await getDxfJobStatus(jobId);
        /* v8 ignore next 3 -- race guard: component unmounts between getDxfJobStatus resolving and this check */
        if (!isActive) {
          return;
        }

        setJobStatus(statusResponse.status);
        if (typeof statusResponse.progress === 'number') {
          setJobProgress(statusResponse.progress);
        }

        if (statusResponse.status === 'completed') {
          const url = statusResponse.result?.url;
          if (!url) {
            throw new Error('DXF job completed without a URL');
          }

          /* v8 ignore next -- downloadCenter always set by setDownloadCenter() before polling; defensive fallback */
          const center = downloadCenter || { lat: 0, lng: 0, label: '' };
          triggerDownload(url, center);

          // Fetch Heatmap data
          const heatmapUrl = url.replace('.dxf', '.heatmap.json');
          try {
            const hRes = await fetch(heatmapUrl);
            if (hRes.ok) {
              const hData = await hRes.json();
              setHeatmapData(hData);
            }
          /* v8 ignore next 3 -- defensive catch for network failure on heatmap asset fetch */
          } catch (e) {
            Logger.error("Failed to load heatmap data", e);
          }

          // Fetch AI Suggestion
          const aiUrl = url.replace('.dxf', '_ia_design.md');
          try {
            const aiRes = await fetch(aiUrl);
            if (aiRes.ok) {
              const aiText = await aiRes.text();
              setAiSuggestion(aiText);
            }
          /* v8 ignore next 3 -- defensive catch for network failure on AI suggestion asset fetch */
          } catch (e) {
            Logger.error("Failed to load AI suggestion", e);
          }

          // Fetch Economic Data
          const economicsUrl = url.replace('.dxf', '.economics.json');
          try {
            const econRes = await fetch(economicsUrl);
            if (econRes.ok) {
              const econData = await econRes.json();
              setEconomicData(econData);
            }
          /* v8 ignore next 3 -- defensive catch for network failure; symmetric with PDF/AI catches */
          } catch (e) {
            Logger.error("Failed to load economic data", e);
          }

          // Fetch Profile CSV
          const csvUrl = url.replace('.dxf', '_perfil_longitudinal.csv');
          try {
            const csvRes = await fetch(csvUrl);
            if (csvRes.ok) {
              const blob = await csvRes.clone().blob();
              const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
              const csvLink = document.createElement('a');
              csvLink.href = URL.createObjectURL(blob);
              csvLink.download = filename.replace('.dxf', '_perfil.csv');
              csvLink.click();

              // Parse for UI
              const csvText = await csvRes.text();
              const lines = csvText.trim().split('\n');
              const profile = lines.slice(1).map((l, i) => ({ distance: i * 5, elevation: parseFloat(l.trim()) })).filter(d => !isNaN(d.elevation));
              setLongitudinalProfile(profile);
            }
          /* v8 ignore next 3 -- defensive catch for network failure; symmetric with PDF/AI catches */
          } catch (e) {
            Logger.error("Failed to load profile CSV", e);
          }

          // Fetch PDF Report
          const pdfUrl = url.replace('.dxf', '_laudo.pdf');
          try {
            const pdfRes = await fetch(pdfUrl);
            if (pdfRes.ok) {
              const blob = await pdfRes.blob();
              const filename = `dxf_export_${center.lat.toFixed(4)}_${center.lng.toFixed(4)}.dxf`;
              const pdfLink = document.createElement('a');
              pdfLink.href = URL.createObjectURL(blob);
              pdfLink.download = filename.replace('.dxf', '_laudo_executivo.pdf');
              pdfLink.click();
            }
          } catch (e) {
            Logger.error("Failed to download PDF report", e);
          }

          onSuccess('DXF Downloaded');
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobProgress(100);
          setJobStatus('completed');
          setDownloadCenter(null);
          return;
        }

        if (statusResponse.status === 'failed') {
          const errorMessage = statusResponse.error || 'DXF generation failed';
          onError(`DXF Error: ${errorMessage}`);
          clearInterval(intervalId);
          setJobId(null);
          setIsDownloading(false);
          setJobStatus('failed');
          setDownloadCenter(null);
        }
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message = error instanceof Error ? error.message : 'DXF generation failed';
        onError(`DXF Error: ${message}`);
        clearInterval(intervalId);
        setJobId(null);
        setIsDownloading(false);
        setJobStatus('failed');
        setDownloadCenter(null);
      }
    }, 2000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [jobId, downloadCenter, onError, onSuccess]);

  return {
    downloadDxf,
    isDownloading,
    jobId,
    jobStatus,
    jobProgress,
    heatmapData,
    setHeatmapData,
    aiSuggestion,
    setAiSuggestion,
    economicData,
    setEconomicData,
    longitudinalProfile,
    setLongitudinalProfile
  };
}
