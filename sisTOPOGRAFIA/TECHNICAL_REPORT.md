# sisTOPOGRAFIA — Technical Report

**Version:** 1.0.0  
**Date:** March 2026  
**Status:** ✅ Production-Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [API Reference](#4-api-reference)
5. [DXF Layer Standards (sisTOPO_)](#5-dxf-layer-standards-sistopo_)
6. [Security](#6-security)
7. [Testing & Coverage](#7-testing--coverage)
8. [Performance & Scalability](#8-performance--scalability)
9. [Deployment](#9-deployment)
10. [Development Standards](#10-development-standards)

---

## 1. Executive Summary

sisTOPOGRAFIA is an enterprise-grade geospatial platform that automates the extraction of OpenStreetMap (OSM) data and the generation of topographic DXF files for AutoCAD (ABNT NBR 13133-compliant). The system integrates free-tier public APIs — OSM, Open-Elevation, IBGE, INCRA, ICMBio, INEA, and Groq AI — to produce 2.5D topographic drawings with BIM metadata attached.

**Key capabilities:**
- On-demand DXF generation for any geographic area (circle, polygon, or UTM bounding box)
- Automated terrain modelling: TIN mesh, contour lines, cut/fill volumes, hydrology
- Environmental compliance layers: APP 30 m buffers (Código Florestal), conservation units (ICMBio/INEA), ANEEL/PRODIST electric-grid easement zones
- AI-powered site analysis (Groq Llama) embedded in generated reports
- Firebase Auth + Firestore for multi-user sessions and cross-instance cache
- Batch processing via CSV upload with Google Cloud Tasks job queue

---

## 2. System Architecture

The system follows **Clean Architecture** and **Domain-Driven Design (DDD)** principles across three loosely-coupled layers.

```
┌──────────────────────────────────────────────────────┐
│                   Frontend (React)                    │
│  Leaflet map · Polygon draw · Settings · Auth UI      │
└──────────────────┬───────────────────────────────────┘
                   │  HTTPS REST (JSON)
┌──────────────────▼───────────────────────────────────┐
│               Node.js / Express Backend               │
│  Zod validation · Rate limiting · Firebase Auth       │
│  Cloud Tasks queue · Firestore cache · Winston logs   │
└──────────────────┬───────────────────────────────────┘
                   │  child_process.spawn (JSON over stdout)
┌──────────────────▼───────────────────────────────────┐
│              Python Geoprocessing Engine              │
│  OSMNx · ezdxf · GeoPandas · Shapely · pyproj        │
│  DXF generation · TIN mesh · contours · BIM XDATA    │
└──────────────────────────────────────────────────────┘
```

### 2.1 Frontend (`/src`)

| Component | Responsibility |
|---|---|
| `App.tsx` | Root orchestrator — hooks, state, event delegation |
| `AppHeader.tsx` | Authentication, navigation, AI insights |
| `AppSidebar.tsx` | Search, controls, results panel |
| `MapSelector.tsx` | Leaflet map, polygon/circle drawing, radius selector |
| `SettingsModal.tsx` | Modal orchestrator; delegates to sub-tabs |
| `LayerToggle.tsx` / `NestedLayerToggle.tsx` | Reusable CAD layer toggles |
| `EarthworkPanel.tsx` | Cut/fill volume input + payload builder |
| `HydrologicalProfilePanel.tsx` | Hydrological profile input + payload builder |
| `Dashboard.tsx` | Analytics dashboard (recharts) |
| `BatchUpload.tsx` | CSV batch DXF upload UI |

State is managed via React hooks (`useOsmEngine`, `useDxfExport`, `useEarthwork`, `useSearch`, etc.) without a global store. `useUndoRedo` provides undo/redo for map operations.

### 2.2 Backend (`/server`)

```
server/
├── index.ts                    # Express entry point, graceful shutdown
├── swagger.ts                  # OpenAPI 3.0 spec
├── pythonBridge.ts             # Python subprocess orchestration
├── infrastructure/
│   └── firestoreService.ts     # Firestore singleton, quota guard
├── interfaces/
│   ├── controllers/
│   │   └── DxfController.ts    # Request dispatch → GenerateDxfUseCase
│   ├── routes/                 # Express routers (see §4)
│   └── schemas/
│       └── dxfSchema.ts        # Zod schema for DXF requests
├── middleware/
│   ├── firebaseAuth.ts         # JWT verification, dev-token bypass
│   ├── monitoring.ts           # Request timing / slow-request warnings
│   └── rateLimiter.ts          # express-rate-limit per-route configs
├── schemas/
│   └── apiSchemas.ts           # Zod schemas for all request bodies
└── services/
    ├── batchService.ts         # CSV parsing → batchRowSchema validation
    ├── cacheService.ts         # In-memory L1 cache (cacheKey → filename)
    ├── cacheServiceFirestore.ts# Firestore L2 cache (cross-instance)
    ├── cloudTasksService.ts    # Google Cloud Tasks dispatch / dev-mode fallback
    ├── dxfCleanupService.ts    # 10-min TTL cleanup + 2-min polling
    ├── elevationService.ts     # Open-Elevation fetch with timeout/fallback
    ├── geocodingService.ts     # Nominatim reverse geocoding
    ├── jobStatusService.ts     # In-memory job tracker with cleanup interval
    └── jobStatusServiceFirestore.ts # Firestore job tracker
```

**Request lifecycle (DXF generation):**
1. `POST /api/dxf` → `firebaseAuth` → `requireAuth` → `checkQuota`
2. `DxfController` validates with `dxfGenerationRequestSchema` (Zod)
3. Cache hit? → return cached URL immediately (L1 → L2)
4. `cloudTasksService.createDxfTask` → Cloud Tasks (prod) or direct call (dev)
5. Python engine spawned via `pythonBridge.ts`, result written to `/downloads`
6. `dxfCleanupService` schedules deletion after 10 min
7. Job status polled via `GET /api/jobs/:id`

### 2.3 Python Engine (`/py_engine`)

```
py_engine/
├── main.py                     # CLI entry point
├── controller.py               # OSM Controller — orchestrates the full pipeline
├── dxf_generator.py            # DXF assembler — delegates to specialist drawers
├── dxf_geometry_drawer.py      # Polygon, linestring, point geometry drawing
├── dxf_terrain_drawer.py       # TIN, contours, hydrology, raster overlay
├── dxf_styles.py               # Layer styles and colour table
├── layer_classifier.py         # OSM tag → sisTOPO_ layer mapping
├── legend_builder.py           # Cartographic legend + title block
├── bim_data_attacher.py        # XDATA BIM attachment (APPID registration)
├── cad_exporter.py             # Coordinate grid, satellite overlay, environmental layers
├── terrain_processor.py        # Terrain grid building, contour generation, profile export
├── report_generator.py         # PDF report (reportlab / fpdf2)
├── report_orchestrator.py      # Orchestrates PDF report sections
├── domain/services/
│   ├── cut_fill_optimizer.py   # Cut/fill volume calculation (grid-based)
│   ├── contour_generator.py    # Shapely contour lines from elevation grid
│   ├── environmental_engine.py # APP buffer, ICMBio, INEA, INCRA overlays
│   ├── environmental_extractor.py # GDF bounds resolution and uc extraction
│   ├── hydrology_service.py    # Flow accumulation, drainage network
│   ├── analytics_engine.py     # Solar potential, slope, flow stats
│   └── spatial_audit.py        # Lamp density, power-line proximity audit
├── infrastructure/
│   ├── external_api/
│   │   ├── elevation_client.py  # Open-Elevation batch fetch
│   │   ├── elevation_api.py     # Multi-provider elevation with latency probe
│   │   ├── osmnx_client.py      # OSMNx wrapper (disk cache, polygon mode)
│   │   └── osm_fetcher.py       # OSM tag filter building + fetch dispatch
│   └── adapters/
│       ├── ibge_adapter.py      # IBGE censo/territorial data
│       ├── incra_adapter.py     # INCRA land registry data
│       ├── icmbio_adapter.py    # ICMBio federal conservation units
│       └── inea_adapter.py      # INEA state conservation units (Rio de Janeiro)
└── utils/
    ├── geo.py                   # Geographic helpers (wgs84_to_utm, distance)
    └── logger.py                # JSON progress logger (stdout → Node.js bridge)
```

---

## 3. Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI component framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tooling & HMR |
| Tailwind CSS | 3 | Utility-first styling (glassmorphism) |
| Leaflet / React-Leaflet | 4 | Interactive map |
| Framer Motion | 11 | Animations |
| Recharts | 2 | Analytics charts |
| Firebase SDK | 10 | Auth + Firestore client |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22 | Runtime |
| Express | 4 | HTTP framework |
| TypeScript | 5 | Type safety |
| Zod | 3 | Request validation |
| Winston | 3 | Structured logging |
| Firebase Admin SDK | 12 | Server-side Auth + Firestore |
| `@google-cloud/tasks` | 5 | Async job queue |
| express-rate-limit | 7 | Rate limiting |
| multer | 1 | CSV file upload |
| csv-parser | 3 | CSV stream parsing |
| swagger-jsdoc | 6 | OpenAPI spec |

### Python Engine

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| OSMNx | ≥1.9.3 | OSM graph/geometry extraction |
| ezdxf | ≥1.3.0 | DXF R2010 generation |
| GeoPandas | ≥0.14.4 | Spatial data frames |
| Shapely | ≥2.0.6 | Geometry operations |
| pyproj | ≥3.6.1 | Coordinate transformations (WGS84 ↔ UTM SIRGAS 2000) |
| SciPy | ≥1.13.0 | Delaunay TIN triangulation |
| NumPy | ≥1.26.4 | Grid arithmetic |
| Pillow | ≥10.4.0 | Raster image processing |
| requests | ≥2.32.3 | External API calls |
| reportlab / fpdf2 | ≥4.2.2 / ≥2.7.9 | PDF report generation |

### Infrastructure

| Service | Purpose |
|---|---|
| Google Cloud Run | Serverless container hosting |
| Google Cloud Tasks | Async DXF generation job queue |
| Firebase Auth | User authentication (JWT) |
| Google Firestore | L2 cache, job status, project storage, quota management |
| Docker | Container runtime (development + production) |

---

## 4. API Reference

All endpoints are prefixed with `/api`. Authentication uses Firebase JWT (`Authorization: Bearer <token>`) except for the health endpoint and dev-mode bypass (`DEV_AUTH_TOKEN`).

### System

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check + version info + Firestore status |
| `GET` | `/api/firestore/status` | None | Firestore connectivity status |

### DXF Generation

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/dxf` | Required + Quota | Generate DXF from lat/lon circle, polygon, or UTM |
| `GET` | `/api/jobs/:id` | None | Poll async job status |
| `GET` | `/downloads/:filename` | None | Download generated DXF |

**`POST /api/dxf` request body:**
```json
{
  "mode": "circle | polygon | utm",
  "lat": -22.15,
  "lon": -42.92,
  "radius": 500,
  "polygon": "[[lon,lat],...]",
  "utm": { "zone": "23K", "easting": 714316, "northing": 7549084 },
  "layers": { "buildings": true, "roads": true, "terrain": true, "hydrology": false },
  "projection": "local | utm"
}
```

### Geo Services

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/geo/search` | Required | Address geocoding via Nominatim |
| `POST` | `/api/geo/elevation/profile` | Required | Elevation profile along a linestring |
| `POST` | `/api/geo/analyze-pad` | Required | AI analysis of a geospatial area |

### Batch Processing

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/batch/dxf` | Required | Batch DXF generation from CSV file upload |

**CSV format:**
```
name,lat,lon,radius,mode
SitioA,-22.15,-42.92,500,circle
```

### Analysis

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/analysis` | Required | Groq AI site analysis |

---

## 5. DXF Layer Standards (sisTOPO_)

All DXF layers generated by sisTOPOGRAFIA carry the mandatory prefix `sisTOPO_`, conforming to ABNT NBR 13133.

| Layer Name | Description | Geometry |
|---|---|---|
| `sisTOPO_EDIFICACAO` | Buildings (ANSI31 hatch) | Polygon |
| `sisTOPO_VIAS` | Roads | Polyline |
| `sisTOPO_VIAS_MEIO_FIO` | Curb offsets | Polyline |
| `sisTOPO_VEGETACAO` | Vegetation / trees | Polygon / Point |
| `sisTOPO_EQUIPAMENTOS` | Urban equipment | Point |
| `sisTOPO_MOBILIARIO_URBANO` | Street furniture | Point |
| `sisTOPO_HIDROGRAFIA` | Rivers, streams, water bodies | Polygon / Polyline |
| `sisTOPO_TERRENO_PONTOS` | Terrain grid points | Point |
| `sisTOPO_TERRENO_TIN` | TIN mesh (3DFACE) | 3D Face |
| `sisTOPO_CURVAS_NIVEL_MESTRA` | Major contours (5× interval) | Polyline |
| `sisTOPO_TOPOGRAFIA_CURVAS` | Minor contour lines | Polyline |
| `sisTOPO_RESTRICAO_APP_30M` | 30 m APP Legal buffer (Código Florestal) | Polygon |
| `sisTOPO_USO_RESIDENCIAL` | Land use — residential | Polygon |
| `sisTOPO_USO_COMERCIAL` | Land use — commercial | Polygon |
| `sisTOPO_USO_INDUSTRIAL` | Land use — industrial | Polygon |
| `sisTOPO_USO_VEGETACAO` | Land use — forest/vegetation | Polygon |
| `sisTOPO_UC_FEDERAL` | Federal conservation unit (ICMBio) | Polygon |
| `sisTOPO_UC_ESTADUAL` | State conservation unit (INEA) | Polygon |
| `sisTOPO_UC_MUNICIPAL` | Municipal conservation unit | Polygon |
| `sisTOPO_INFRA_POWER_HV` | High-voltage electrical infrastructure | Polyline |
| `sisTOPO_INFRA_POWER_LV` | Low-voltage electrical infrastructure | Polyline |
| `sisTOPO_INFRA_TELECOM` | Telecommunications infrastructure | Polyline |
| `sisTOPO_PRODIST_FAIXA_HV` | PRODIST HV easement (≥69 kV, ±15 m) | Polygon |
| `sisTOPO_PRODIST_FAIXA_MT` | PRODIST MV easement (±8 m) | Polygon |
| `sisTOPO_PRODIST_FAIXA_BT` | PRODIST LV easement (<13.8 kV, ±2 m) | Polygon |
| `sisTOPO_TEXTO` | Text labels | MTEXT |
| `sisTOPO_ANNOT_AREA` | Area annotations (m²) | MTEXT |
| `sisTOPO_ANNOT_LENGTH` | Length annotations (m) | MTEXT |
| `sisTOPO_LEGENDA` | Cartographic legend | Mixed |
| `sisTOPO_QUADRO` | Title block | Mixed |
| `sisTOPO_MALHA_COORD` | Coordinate grid | Polyline |
| `sisTOPO_PONTOS_COORD` | Geodetic markers (blocks) | Insert |
| `sisTOPO_PONTOS_TEXTO` | Geodetic marker labels | MTEXT |
| `sisTOPO_MDT_IMAGEM_SATELITE` | Satellite raster overlay | IMAGE |
| `sisTOPO_RISCO_ALTO` | High-risk slope hatch (>100%) | Hatch |

### ANEEL/PRODIST Integration

When OSM data contains power-infrastructure tags (`power=line`, etc.) and the `infrastructure` layer flag is enabled, `AneelProdistRules.generate_faixas_servid()` automatically generates easement buffers according to PRODIST Módulo 3 §6.4. A `CustomEvent('aneel-prodist-applied')` is dispatched to the frontend to display a notification toast.

---

## 6. Security

### Authentication & Authorization

- Firebase Auth JWT tokens verified server-side via `firebaseAuth.ts`
- Public key certificates fetched from Google JWKS and cached with TTL from `cache-control` header
- `DEV_AUTH_TOKEN` env var enables a bypass token in non-production environments
- Per-user quota enforcement via Firestore atomic transactions (`checkQuota`)

### Input Validation

All request inputs are validated with [Zod](https://zod.dev) before reaching business logic:

| Schema | Applied to |
|---|---|
| `dxfGenerationRequestSchema` | `POST /api/dxf` |
| `batchRowSchema` | CSV row parsing |
| `geocodingRequestSchema` | `POST /api/geo/search` |
| `elevationProfileSchema` | `POST /api/geo/elevation/profile` |
| `analyzePadSchema` | `POST /api/geo/analyze-pad` |
| `analysisRequestSchema` | `POST /api/analysis` |

Coordinate ranges, polygon vertex counts (≤1000 points), radius bounds (10–5000 m), and per-point lat/lon bounds are all enforced.

### Rate Limiting

| Route group | Limit |
|---|---|
| DXF generation | 10 req / 15 min per IP |
| Geo services | 30 req / 5 min per IP |
| Analysis | 5 req / 1 min per IP |

### Other Measures

- Helmet middleware sets security headers (CSP, HSTS, X-Frame-Options, etc.)
- Python subprocess arguments sanitized before `child_process.spawn`
- Winston structured logging; stack traces suppressed in production responses
- No secrets committed to the repository; `.env` excluded via `.gitignore`
- Docker container runs as non-root user

---

## 7. Testing & Coverage

### Summary

| Layer | Test Runner | Tests | Statement | Branch | Function | Line |
|---|---|---|---|---|---|---|
| Python Engine | pytest | 553 | 99% | 99% | 99% | 99% |
| Node.js Backend | Jest | 296 | 100% | 100% | 100% | 100% |
| React Frontend | Vitest | 237 | 100% | 100% | 100% | 100% |
| **Total** | | **1,086** | | | | |

### Backend Test Files

| File | Scope |
|---|---|
| `api.test.ts` | Full Express app integration (health, DXF, jobs, geo, analysis) |
| `apiSchemas.test.ts` | Zod schema validation for all request schemas |
| `batchRoutes.test.ts` | Batch upload route (cache hit, validation failures, error handling) |
| `batchService.test.ts` | CSV parsing, stream error handling |
| `cacheService.test.ts` | In-memory L1 cache CRUD |
| `cacheServiceFirestore.test.ts` | Firestore L2 cache with TTL |
| `cloudTasksService.test.ts` | Cloud Tasks dispatch + dev-mode fallback |
| `dxfCleanupService.test.ts` | File TTL cleanup + interval lifecycle |
| `dxfController.test.ts` | Controller layer (cache hit, task dispatch, error paths) |
| `dxfSchema.test.ts` | DXF Zod schema — all modes, coordinate bounds, polygon validation |
| `elevationService.test.ts` | Open-Elevation fetch + timeout + fallback |
| `firebaseAuth.test.ts` | JWT verification, dev-token bypass, quota enforcement |
| `firestoreService.test.ts` | Firestore singleton, safeRead/Write/Delete, project snapshot |
| `geocodingService.test.ts` | Nominatim geocoding, error handling |
| `jobStatusService.test.ts` | In-memory job lifecycle, cleanup interval |
| `jobStatusServiceFirestore.test.ts` | Firestore job tracker |
| `monitoring.test.ts` | Request timing middleware |
| `rateLimiter.test.ts` | Rate limiter configurations |

### Frontend Test Files

Tests live in `/tests` (Vitest + Testing Library). All hooks, services, utilities, and context providers are tested at 100% coverage. Notable areas:
- `useOsmEngine`, `useDxfExport`, `useEarthwork`, `useElevationProfile`, `useSearch`, `useKmlImport`, `useUndoRedo`, `useFileOperations`
- `dxfService`, `osmService`, `geminiService`, `elevationService`
- `AuthContext` (Firebase mock)
- `downloadFile`, `kmlParser`, `geo`, `logger`

### Python Test Files

| File | Modules tested |
|---|---|
| `test_use_cases.py` | OsmFetcher, EnvironmentalExtractor, HydrologyService, AnalyticsEngine, OsmController |
| `test_dxf_generator.py` | DXFGenerator helper methods, safe value/point, line merge, geodetic marker |
| `test_dxf_geometry_comprehensive.py` | DxfGeometryDrawer — all geometry types and edge cases |
| `test_dxf_terrain_comprehensive.py` | DxfTerrainDrawer — TIN, contours, hydrology, raster overlay |
| `test_cad_exporter.py` | CadExporter — georef, env layers, cartographic elements, satellite |
| `test_terrain_processor.py` | TerrainProcessor — grid build, contours, profile export |
| `test_osm_controller.py` | OsmController — normalize layers, audit, geodata, full pipeline |
| `test_bim_data_attacher.py` | BimDataAttacher — XDATA attachment, NaN handling |
| `test_report_generator.py` | PDFReportGenerator — sections, header/footer |
| `test_report_orchestrator.py` | ReportOrchestrator — generate, build_report_data |
| `test_aneel_prodist_rules.py` | AneelProdistRules — all voltage levels, empty results |
| `test_spatial_audit.py` | SpatialAudit — lighting score, power proximity |
| `test_cut_fill_optimizer.py` | CutFillOptimizer — grid volumes, degenerate polygons |
| `test_elevation_api.py` | ElevationApiAdapter — provider selection, batch fetch |
| `test_osmnx_extra.py` | OsmnxClient — disk cache, polygon mode, custom CRS |

### CI Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push to `dev`/`main` and on all pull requests:

```
Lint (ESLint) → Frontend Tests (Vitest) → Backend Tests (Jest)
  → TypeScript build check (tsc) → Frontend build (Vite)
  [parallel] Python Tests (pytest)
```

---

## 8. Performance & Scalability

### Caching Strategy (Two-Level)

```
Request → L1 (in-memory Map) → L1 hit? return URL
                              → L2 (Firestore) → L2 hit? return URL
                                              → Generate new DXF
```

- **L1** (in-memory): Zero-latency within the same process. Cleared on restart.
- **L2** (Firestore): Persistent cross-instance cache. Key = deterministic hash of `{lat, lon, radius, mode, polygon, layers}`. TTL managed by `cacheServiceFirestore.ts`.

### Async Job Queue

`POST /api/dxf` returns immediately with a `jobId`. The client polls `GET /api/jobs/:id`. In production, DXF generation is offloaded to Google Cloud Tasks, allowing the HTTP request to complete in < 200 ms while generation takes 2–15 s depending on area size.

In development (without Cloud Tasks), generation runs synchronously in the same Node.js process via the Python bridge.

### DXF File Lifecycle

Generated DXF files are served from a local `/downloads` directory. The `dxfCleanupService` schedules deletion 10 minutes after creation, with a background sweep every 2 minutes for orphaned files. This prevents unbounded disk growth in Cloud Run.

### Rate Limiting

Per-route rate limits protect external API consumption and prevent abuse. Limits are enforced at the Node.js layer before any downstream calls.

---

## 9. Deployment

### Docker (Recommended)

```bash
# Development
docker compose up

# Production build
docker build -t sistopografia:1.0.0 .
docker run -p 8080:8080 --env-file .env sistopografia:1.0.0
```

The Docker image bundles Node.js, Python 3.11, and all dependencies. The single container exposes port 8080 and serves both the compiled frontend bundle and the Express API.

### Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/$PROJECT_ID/sistopografia:1.0.0

# Deploy
gcloud run deploy sistopografia \
  --image gcr.io/$PROJECT_ID/sistopografia:1.0.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,USE_CLOUD_TASKS=true,..."
```

### Environment Variables

| Variable | Description | Required |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Firebase/Firestore project ID | Yes (prod) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON | Yes (prod) |
| `USE_CLOUD_TASKS` | `true` to use Cloud Tasks queue | Prod |
| `CLOUD_TASKS_QUEUE` | Cloud Tasks queue name | Prod |
| `GCP_LOCATION` | GCP region | Prod |
| `GCP_PROJECT_NUMBER` | GCP project number for OIDC | Prod |
| `USE_FIRESTORE` | `true` to use Firestore L2 cache | Optional |
| `GROQ_API_KEY` | Groq AI API key | Optional |
| `DEV_AUTH_TOKEN` | Dev-mode auth bypass token | Dev only |
| `NODE_ENV` | `production` \| `development` \| `test` | Yes |
| `PORT` | HTTP port (default: `8080`) | Optional |

---

## 10. Development Standards

### Code Quality Rules

- **File size limit:** Files > 500 lines **must** be modularised following SRP. Example: `App.tsx` refactored from 763 → 302 lines; `dxf_generator.py` from 868 → 365 lines.
- **No `console.log` in production code:** All logging via Winston (Node.js) or `utils/logger.py` (Python).
- **No `error: any`:** All catch blocks typed as `error: unknown` with `instanceof Error` guards.
- **Zod for all inputs:** No manual type coercion on request bodies.
- **`sisTOPO_` prefix mandatory:** Every DXF layer generated by the engine must carry this prefix.
- **2.5D spatial model:** Use `lwpolyline` with `elevation` + `thickness` and `3DFACE` for TIN. Never bare `LINE` 3D.
- **Free-tier only:** All external providers must have a free tier. Current: OSMNx, Open-Elevation, IBGE/INCRA/ICMBio/INEA public APIs, Groq.

### Coordinate System

Standard test coordinates (UTM Zone 23K, SIRGAS 2000):

| Format | Value |
|---|---|
| UTM | `23K 714316 7549084` |
| WGS84 decimal | `-22.15018, -42.92185` |
| Test radius | 100 m (unit tests), 500 m / 1 km (integration) |

### Branch & PR Strategy

- `main` — stable production release
- `dev` — integration branch; all PRs target here
- Feature branches: `copilot/<feature-slug>` or `feature/<slug>`
- Required CI: ESLint, Vitest, Jest, TypeScript build, Vite build, pytest

### Test Coverage Thresholds

Configured in `jest.config.ts` (backend) and `vite.config.ts` (frontend):

```
statements: 100%
branches:   100%
functions:  100%
lines:      100%
```

Python coverage threshold (`.coveragerc` / `pyproject.toml`): **80% minimum** (currently at 99%).

---

*This document was generated from the system state at version 1.0.0 (March 2026). For architecture decisions and phase-by-phase development history, see `memory.md` and `docs/HISTORICO_CONSOLIDADO.md`.*
