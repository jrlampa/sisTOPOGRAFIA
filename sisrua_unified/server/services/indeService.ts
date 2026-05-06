import { logger } from "../utils/logger.js";
import { fetchWithCircuitBreaker } from "../utils/externalApi.js";

/**
 * INDE - Infraestrutura Nacional de Dados Espaciais Service
 *
 * Provides access to Brazilian official geographic data through OGC standards:
 * - WMS (Web Map Service): Map images
 * - WFS (Web Feature Service): Vector features (GeoJSON)
 * - CSW (Catalogue Service): Metadata search
 *
 * INDE URL: https://inde.gov.br/
 *
 * Key data sources:
 * - IBGE: Municipal boundaries, roads, hydrography
 * - ICMBio: Conservation units, indigenous lands
 * - ANA: Water resources, watersheds
 * - DNIT: Federal roads
 */

// INDE Geoserver endpoints
const INDE_ENDPOINTS = {
  ibge: "https://geoservicos.ibge.gov.br/geoserver",
  icmbio: "https://geoservicos.icmbio.gov.br/geoserver",
  ana: "https://geoservicos.ana.gov.br/geoserver",
  dnit: "https://geoservicos.dnit.gov.br/geoserver",
};

interface WfsFeatureType {
  name: string;
  title: string;
  abstract?: string;
}

interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: any[];
  totalFeatures?: number;
}

export class IndeService {
  private static getSourceBreakerName(
    source: keyof typeof INDE_ENDPOINTS,
  ): string {
    return `INDE_${source.toUpperCase()}`;
  }

  /**
   * Get WFS capabilities (available feature types)
   */
  static async getWfsCapabilities(
    source: keyof typeof INDE_ENDPOINTS = "ibge",
  ): Promise<WfsFeatureType[]> {
    const baseUrl = INDE_ENDPOINTS[source];
    const url = `${baseUrl}/wfs?service=WFS&version=2.0.0&request=GetCapabilities`;

    try {
      logger.info("Fetching INDE WFS capabilities", { source });
      const response = await fetchWithCircuitBreaker(
        this.getSourceBreakerName(source),
        url,
        { signal: AbortSignal.timeout(10000) },
        { maxRetries: 2, initialDelay: 500, maxDelay: 2000 },
      );

      const xml = await response.text();

      // Parse FeatureTypes from XML (simplified)
      const featureTypes: WfsFeatureType[] = [];
      const featureTypeMatches = xml.match(/<FeatureType>.*?<\/FeatureType>/gs);

      if (featureTypeMatches) {
        for (const ft of featureTypeMatches) {
          const nameMatch = ft.match(/<Name>([^<]+)<\/Name>/);
          const titleMatch = ft.match(/<Title>([^<]+)<\/Title>/);
          const abstractMatch = ft.match(/<Abstract>([^<]+)<\/Abstract>/);

          if (nameMatch) {
            featureTypes.push({
              name: nameMatch[1],
              title: titleMatch?.[1] || nameMatch[1],
              abstract: abstractMatch?.[1],
            });
          }
        }
      }

      logger.info("INDE WFS capabilities fetched", {
        source,
        featureTypesCount: featureTypes.length,
      });

      return featureTypes;
    } catch (error) {
      logger.error("INDE WFS capabilities failed", { error, source });
      return [];
    }
  }

  /**
   * Query WFS features within bounding box
   */
  static async getFeaturesByBBox(
    layerName: string,
    west: number,
    south: number,
    east: number,
    north: number,
    source: keyof typeof INDE_ENDPOINTS = "ibge",
    maxFeatures: number = 1000,
  ): Promise<GeoJsonFeatureCollection | null> {
    const baseUrl = INDE_ENDPOINTS[source];

    // WFS 2.0.0 GetFeature with bbox and GeoJSON output
    const url = new URL(`${baseUrl}/wfs`);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeNames", layerName);
    url.searchParams.set("bbox", `${west},${south},${east},${north}`);
    url.searchParams.set("outputFormat", "application/json");
    url.searchParams.set("count", maxFeatures.toString());

    try {
      logger.info("Fetching INDE WFS features", {
        layer: layerName,
        source,
        bbox: `${west},${south},${east},${north}`,
      });

      const response = await fetchWithCircuitBreaker(
        this.getSourceBreakerName(source),
        url.toString(),
        { signal: AbortSignal.timeout(30000) },
        { maxRetries: 2, initialDelay: 500, maxDelay: 3000 },
      );

      const data = (await response.json()) as GeoJsonFeatureCollection;

      logger.info("INDE WFS features fetched", {
        layer: layerName,
        count: data.features?.length || 0,
      });

      return data;
    } catch (error) {
      logger.error("INDE WFS features fetch failed", {
        error,
        layer: layerName,
      });
      return null;
    }
  }

  /**
   * Get features by layer name and filter
   */
  static async getFeatures(
    layerName: string,
    source: keyof typeof INDE_ENDPOINTS = "ibge",
    filter?: string,
    maxFeatures: number = 1000,
  ): Promise<GeoJsonFeatureCollection | null> {
    const baseUrl = INDE_ENDPOINTS[source];

    const url = new URL(`${baseUrl}/wfs`);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeNames", layerName);
    url.searchParams.set("outputFormat", "application/json");
    url.searchParams.set("count", maxFeatures.toString());

    if (filter) {
      url.searchParams.set("filter", filter);
    }

    try {
      const response = await fetchWithCircuitBreaker(
        this.getSourceBreakerName(source),
        url.toString(),
        { signal: AbortSignal.timeout(30000) },
        { maxRetries: 2, initialDelay: 500, maxDelay: 3000 },
      );

      return (await response.json()) as GeoJsonFeatureCollection;
    } catch (error) {
      logger.error("INDE WFS getFeatures failed", { error, layer: layerName });
      return null;
    }
  }

  /**
   * Get WMS map image URL
   */
  static getWmsMapUrl(
    layerName: string,
    west: number,
    south: number,
    east: number,
    north: number,
    width: number = 1024,
    height: number = 768,
    source: keyof typeof INDE_ENDPOINTS = "ibge",
  ): string {
    const baseUrl = INDE_ENDPOINTS[source];

    const url = new URL(`${baseUrl}/wms`);
    url.searchParams.set("service", "WMS");
    url.searchParams.set("version", "1.1.0");
    url.searchParams.set("request", "GetMap");
    url.searchParams.set("layers", layerName);
    url.searchParams.set("styles", "");
    url.searchParams.set("bbox", `${west},${south},${east},${north}`);
    url.searchParams.set("width", width.toString());
    url.searchParams.set("height", height.toString());
    url.searchParams.set("srs", "EPSG:4326");
    url.searchParams.set("format", "image/png");

    return url.toString();
  }

  /**
   * Get available layers for a source (commonly used)
   */
  static async getCommonLayers(
    source: keyof typeof INDE_ENDPOINTS = "ibge",
  ): Promise<WfsFeatureType[]> {
    const allCapabilities = await this.getWfsCapabilities(source);

    // Filter for commonly useful layers
    const keywords = [
      "municipio",
      "municipal",
      "limite",
      "rodovia",
      "rodovias",
      "estrada",
      "hidrografia",
      "rio",
      "curso",
      "vegetacao",
      "floresta",
      "assentamento",
      "rural",
    ];

    return allCapabilities.filter((layer) => {
      const searchText =
        `${layer.name} ${layer.title} ${layer.abstract || ""}`.toLowerCase();
      return keywords.some((kw) => searchText.includes(kw));
    });
  }

  /**
   * Get municipality boundary from INDE (alternative to IBGE)
   */
  static async getMunicipalityBoundary(
    municipioName: string,
    _uf: string,
  ): Promise<GeoJsonFeatureCollection | null> {
    // Common layer names for municipalities in INDE
    const possibleLayers = [
      "CCAR:BC250_Municipio_A",
      "CCAR:BC250_Localidade_A",
      "IBGE: municipios",
    ];

    for (const layer of possibleLayers) {
      const filter = `<Filter><PropertyIsEqualTo><PropertyName>nome</PropertyName><Literal>${municipioName}</Literal></PropertyIsEqualTo></Filter>`;

      const result = await this.getFeatures(layer, "ibge", filter, 1);
      if (result && result.features && result.features.length > 0) {
        return result;
      }
    }

    return null;
  }
}

export default IndeService;
