/**
 * Magic Numbers - Centralized constants to eliminate hardcoded values
 * Improves maintainability and consistency across the codebase
 */

// ============================================================================
// ID Generation & Entity Management
// ============================================================================

/** Entropy range for legacy ID generation (deprecated - use idGenerator.ts instead) */
export const LEGACY_ID_ENTROPY = 1000;

/** Entity ID prefixes for clarity */
export const ENTITY_ID_PREFIXES = {
  RAMAL_POLE: 'RP',
  CONDUCTOR: 'C',
  CONDUCTOR_REPLACEMENT: 'RC',
  TRANSFORMER: 'T',
  REGULATOR: 'R',
  MT_POLE: 'MT',
  MT_EDGE: 'V',
} as const;

// ============================================================================
// Geographic & Spatial Constants
// ============================================================================

/** Default map zoom level */
export const DEFAULT_MAP_ZOOM = 15;

/** Default map center (Brasília, Brazil) */
export const DEFAULT_MAP_CENTER = [-15.7942, -47.8822] as const;

/** Radius validation - minimum meters */
export const MIN_RADIUS_METERS = 10;

/** Radius validation - maximum meters */
export const MAX_RADIUS_METERS = 50_000;

// ============================================================================
// UI/UX Timing Constants
// ============================================================================

/** Debounce delay for coordinate inputs (milliseconds) */
export const DEBOUNCE_COORDINATE_INPUT_MS = 300;

/** Debounce delay for search/filter inputs (milliseconds) */
export const DEBOUNCE_SEARCH_INPUT_MS = 200;

/** Debounce delay for autosave (milliseconds) */
export const DEBOUNCE_AUTOSAVE_MS = 500;

/** Error state reset delay (milliseconds) */
export const ERROR_STATE_RESET_DELAY_MS = 800;

// ============================================================================
// Performance & Memory Limits
// ============================================================================

/** Maximum items in BT history before pagination required */
export const BT_HISTORY_PAGE_SIZE = 50;

/** Maximum polling attempts for DXF generation */
export const MAX_DXF_POLL_ATTEMPTS = 30;

/** Polling interval for DXF status check (milliseconds) */
export const DXF_POLL_INTERVAL_MS = 500;

// ============================================================================
// Validation Ranges
// ============================================================================

/** Minimum characters for filename validation */
export const MIN_FILENAME_LENGTH = 3;

/** Maximum characters for filename validation */
export const MAX_FILENAME_LENGTH = 255;

/** Valid filename regex - alphanumeric, dash, underscore, dot, space */
export const VALID_FILENAME_REGEX = /^[\w\-\. ]{3,255}$/;

/** Valid path component regex - prevents path traversal */
export const VALID_PATH_COMPONENT_REGEX = /^[\w\-\.]+$/;

/** Minimum numeric input value */
export const MIN_NUMERIC_VALUE = 0;

/** Maximum numeric input value */
export const MAX_NUMERIC_VALUE = Number.MAX_SAFE_INTEGER;

// ============================================================================
// Feature Flags & Experimental Features
// ============================================================================

/** Enable CQT (Configuração Topológica) feature */
const APP_ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Enable CQT (Configuração Topológica) feature */
export const FEATURE_CQT_ENABLED = String(APP_ENV.VITE_FEATURE_CQT ?? APP_ENV.REACT_APP_FEATURE_CQT ?? '') === 'true';

/** Enable BT (Barramento Topológico) feature */
export const FEATURE_BT_ENABLED = String(APP_ENV.VITE_FEATURE_BT ?? APP_ENV.REACT_APP_FEATURE_BT ?? '') === 'true';

/** Enable debug logging */
export const DEBUG_MODE_ENABLED = APP_ENV.DEV === true || APP_ENV.MODE === 'development';

// ============================================================================
// API & Backend Configuration
// ============================================================================

/** Default timeout for HTTP requests (milliseconds) */
export const HTTP_REQUEST_TIMEOUT_MS = 30_000;

/** Default retry attempts for failed requests */
export const HTTP_RETRY_ATTEMPTS = 3;

/** Rate limit - requests per minute */
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;

// ============================================================================
// Storage & Persistence
// ============================================================================

/** LocalStorage key for autosave draft */
export const AUTOSAVE_STORAGE_KEY = 'sisrua_draft';

/** LocalStorage key for app settings */
export const SETTINGS_STORAGE_KEY = 'sisrua_settings';

/** LocalStorage key for UI state (preferences, sidebar state) */
export const UI_STATE_STORAGE_KEY = 'sisrua_ui_state';

/** Version key for data structure compatibility checks */
export const STORAGE_VERSION_KEY = 'sisrua_version';

/** Current storage format version */
export const CURRENT_STORAGE_VERSION = 1;
