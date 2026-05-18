// ============================================================================
// BT (Baixa Tensão) Types
// ============================================================================

export interface BtNetworkScenarioPayload {
  id?: string;
  mode: 'ramal' | 'clandestino';
  poles?: Array<{
    id: string;
    lat: number;
    lng: number;
    demandaClientesKva?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface BtEditorModePayload {
  mode: 'view' | 'edit' | 'analyze' | 'none' | 'add-pole' | 'move-pole' | 'add-transformer' | 'add-edge';
  selectedPolesIds?: string[];
  selectedTransformerIds?: string[];
}

// ============================================================================
// MT (Média Tensão) Types
// ============================================================================

export interface MtNetworkState {
  selectionMode: 'center-radius' | 'polygon';
  terminals?: Array<{ lat: number; lng: number }>;
  profile?: 'rural' | 'urban' | 'industrial';
  maxSnapDistance?: number;
}

export interface MtRouterResult {
  routeId: string;
  segments: Array<{
    id: string;
    start: [number, number];
    end: [number, number];
    distance: number;
  }>;
  totalDistance: number;
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormValidationError {
  field: string;
  message: string;
  code: 'required' | 'invalid' | 'out-of-range';
}

export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
}

// ============================================================================
// Admin/Settings Types
// ============================================================================

export interface ServiceTierForm {
  serviceName: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  supportHours: string;
  slaAvailabilityPct: number;
  sloLatencyP95Ms: number;
  supportChannel: string;
}

export interface AdminSettings {
  theme: 'light' | 'dark' | 'sunlight';
  language: 'pt-BR' | 'en' | 'es';
  autoSave: boolean;
  debugMode: boolean;
  serviceTiers: ServiceTierForm[];
}

// ============================================================================
// App State Types
// ============================================================================

export interface AppContextState {
  settings: AdminSettings;
  btNetworkScenario: BtNetworkScenarioPayload | null;
  btEditorMode: BtEditorModePayload;
  mtNetworkState: MtNetworkState | null;
  appHistory: Array<{ timestamp: string; action: string }>;
}

export interface AppContextActions {
  setBtNetworkScenario: (s: BtNetworkScenarioPayload | null) => void;
  setBtEditorMode: (m: BtEditorModePayload) => void;
  setMtNetworkState: (s: MtNetworkState | null) => void;
  updateSettings: (s: Partial<AdminSettings>) => void;
}

// ============================================================================
// Component Props Types (exported for use in other files)
// ============================================================================

export interface WithLoading {
  isLoading?: boolean;
  error?: string | null;
}

export interface WithValidation {
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
}
