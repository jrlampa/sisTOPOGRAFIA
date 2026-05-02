import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "placeholder_key";
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || "https://app.posthog.com";

const appInitTime = Date.now();
let firstActionTracked = false;

/**
 * Initializes PostHog for client-side tracking.
 * Only initializes if a key is provided and not in development mode (optional).
 */
export const initAnalytics = () => {
  if (POSTHOG_KEY && POSTHOG_KEY !== "placeholder_key") {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true, // Automatically capture clicks and pageviews
      persistence: "localStorage",
    });
  } else {
    console.info(
      "PostHog Analytics: Placeholder key detected. Tracking disabled.",
    );
  }
};

/**
 * Tracks a custom event.
 * @param eventName Name of the event to track
 * @param properties Additional context for the event
 */
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>,
) => {
  if (posthog.__loaded) {
    posthog.capture(eventName, properties);
  }
};

/**
 * Specifically track DXF generation success/failure.
 */
export const trackDxfGeneration = (
  mode: string,
  success: boolean,
  durationMs?: number,
  error?: string,
) => {
  trackEvent("dxf_generation", {
    mode,
    success,
    duration_ms: durationMs,
    error_message: error,
  });
};

/**
 * UX-20: Tracks workflow stage transitions and time spent.
 */
export const trackWorkflowStage = (
  from: number,
  to: number,
  durationMs: number,
) => {
  trackEvent("workflow_stage_change", {
    from_stage: from,
    to_stage: to,
    duration_ms: durationMs,
    path: `${from} -> ${to}`,
  });
};

/**
 * UX-20: Tracks rework (undo/redo) to identify friction points.
 */
export const trackRework = (actionType: "undo" | "redo", label: string) => {
  trackEvent("user_friction_rework", {
    action_type: actionType,
    action_label: label,
  });
};

/**
 * UX-20: Tracks errors shown to the user and potential recovery actions.
 */
export const trackErrorFriction = (
  message: string,
  hasRetry: boolean,
  retryClicked: boolean = false,
) => {
  trackEvent("user_friction_error", {
    error_message: message,
    has_retry: hasRetry,
    retry_clicked: retryClicked,
  });
};

/**
 * UX-20: Tracks modal abandonment to find drops in complex wizards.
 */
export const trackModalAbandonment = (
  modalName: string,
  durationMs: number,
  completed: boolean,
  lastStep?: string,
) => {
  trackEvent("modal_journey", {
    modal_name: modalName,
    duration_ms: durationMs,
    completed,
    last_step: lastStep,
  });
};

/**
 * UX-20: Tracks header CTA actions for first-useful-action and frequency metrics.
 */
export const trackHeaderAction = (
  action:
    | "save_project"
    | "open_project"
    | "open_help"
    | "open_settings"
    | "toggle_sidebar"
    | "mobile_menu_open"
    | "mobile_menu_close"
    | "history_panel_open",
) => {
  if (!firstActionTracked) {
    trackEvent("first_useful_action", {
      action,
      time_to_action_ms: Date.now() - appInitTime,
    });
    firstActionTracked = true;
  }
  trackEvent("header_action", { action });
};

/**
 * UX-20: Tracks autosave status changes for error-rate baseline metric.
 */
export const trackAutoSaveStatus = (status: "saving" | "error" | "success") => {
  trackEvent("autosave_status", { status });
};

/**
 * UX-20: Tracks Command Palette query + action for semantic search analysis.
 */
export const trackCommandPalette = (query: string, actionId?: string) => {
  trackEvent("command_palette_action", {
    query_length: query.length,
    action_id: actionId,
  });
};

/**
 * UX-20: Tracks pole focus via Command Palette semantic search (Item 26).
 */
export const trackPoleFocus = (
  poleId: string,
  source: "command_palette" | "map_click",
) => {
  trackEvent("pole_focused", { pole_id: poleId, source });
};

/**
 * UX-20: Tracks DG Wizard parameter divergence to identify friction with default AI logic.
 */
export const trackDgParameterDivergence = (
  params: any,
  poleOverrides: Record<string, number>
) => {
  const overridesCount = Object.keys(poleOverrides).length;
  trackEvent("dg_parameter_divergence", {
    clientes_por_poste: params.clientesPorPoste,
    area_clandestina: params.areaClandestinaM2,
    demanda_media: params.demandaMediaClienteKva,
    fator_simultaneidade: params.fatorSimultaneidade,
    trafos_permitidos_count: params.faixaKvaTrafoPermitida?.length || 0,
    max_span: params.maxSpanMeters,
    pole_overrides_count: overridesCount,
    has_divergence: params.clientesPorPoste !== 1 || params.demandaMediaClienteKva !== 1.5 || overridesCount > 0,
  });
};
