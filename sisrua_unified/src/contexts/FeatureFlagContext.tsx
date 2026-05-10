import React, { createContext, useContext, useEffect, useState } from "react";
import {
  FeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  FeaturePreset,
  PRESETS,
  CustomPreset,
  FEATURE_LABELS,
} from "../types/featureFlags";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../auth/AuthProvider";
import { API_BASE_URL } from "../config/api";
import { buildApiHeaders } from "../services/apiClient";

interface FeatureHealth {
  latencyMs: number;
  status: "online" | "degraded" | "offline";
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  customPresets: CustomPreset[];
  featureHealth: Record<string, FeatureHealth>;
  toggleFlag: (key: keyof FeatureFlags) => void;
  applyPreset: (preset: FeaturePreset | string) => void;
  saveCustomPreset: (label: string) => Promise<void>;
  deleteCustomPreset: (id: string) => Promise<void>;
  resetToDefaults: () => void;
  isReady: boolean;
}

interface UserPreferencesRow {
  feature_flags?: Partial<FeatureFlags> | null;
  custom_presets?: CustomPreset[] | null;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(
  undefined,
);

export const FeatureFlagProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [featureHealth, setFeatureHealth] = useState<
    Record<string, FeatureHealth>
  >({});
  const [isReady, setIsReady] = useState(false);

  // 1. Carregar preferências e presets
  useEffect(() => {
    const loadPreferences = async () => {
      const saved = localStorage.getItem("sisrua_feature_flags");
      let initialFlags = DEFAULT_FEATURE_FLAGS;

      if (saved) {
        try {
          initialFlags = { ...DEFAULT_FEATURE_FLAGS, ...JSON.parse(saved) };
        } catch (e) {
          console.error("Failed to parse local flags", e);
        }
      }

      if (user && supabase) {
        const { data, error } = await (supabase
          .from("user_preferences" as any)
          .select("feature_flags, custom_presets")
          .eq("user_id", user.id)
          .single() as unknown as Promise<{
          data: UserPreferencesRow | null;
          error: any;
        }>);

        if (data) {
          if (data.feature_flags) {
            initialFlags = { ...initialFlags, ...data.feature_flags };
            localStorage.setItem(
              "sisrua_feature_flags",
              JSON.stringify(initialFlags),
            );
          }
          if (data.custom_presets) {
            setCustomPresets(data.custom_presets);
          }
        } else if (error && error.code !== "PGRST116") {
          console.warn("[Flags] Erro ao carregar do banco", error.message);
        }
      }

      setFlags(initialFlags);
      setIsReady(true);
    };

    loadPreferences();
  }, [user]);

  // 2. Monitoramento de Saúde (Health Check)
  useEffect(() => {
    const checkHealth = async () => {
      const newHealth: Record<string, FeatureHealth> = {};
      const headers = buildApiHeaders();

      for (const [key, info] of Object.entries(FEATURE_LABELS)) {
        if (info.healthCheckUrl && flags[key as keyof FeatureFlags]) {
          const start = Date.now();
          try {
            const res = await fetch(`${API_BASE_URL}${info.healthCheckUrl}`, {
              headers,
              signal: AbortSignal.timeout(3000),
            });
            const latency = Date.now() - start;
            newHealth[key] = {
              latencyMs: latency,
              status: res.ok
                ? latency > 1500
                  ? "degraded"
                  : "online"
                : "offline",
            };
          } catch {
            newHealth[key] = { latencyMs: 0, status: "offline" };
          }
        }
      }
      setFeatureHealth(newHealth);
    };

    if (isReady) {
      checkHealth();
      const timer = setInterval(checkHealth, 30000); // A cada 30s
      return () => clearInterval(timer);
    }
  }, [flags, isReady]);

  // 3. Salvar preferências
  const saveFlags = async (
    nextFlags: FeatureFlags,
    updatedPresets?: CustomPreset[],
  ) => {
    setFlags(nextFlags);
    localStorage.setItem("sisrua_feature_flags", JSON.stringify(nextFlags));

    if (user && supabase) {
      try {
        await (supabase.from("user_preferences" as any).upsert({
          user_id: user.id,
          feature_flags: nextFlags,
          custom_presets: updatedPresets ?? customPresets,
          updated_at: new Date().toISOString(),
        } as any) as unknown as Promise<{ error: any }>);
      } catch (err: any) {
        console.error("[Flags] Erro ao sincronizar", err.message);
      }
    }
  };

  const toggleFlag = async (key: keyof FeatureFlags) => {
    const nextFlags = { ...flags, [key]: !flags[key] };
    saveFlags(nextFlags);
  };

  const applyPreset = async (presetId: FeaturePreset | string) => {
    let nextFlags: FeatureFlags;
    const standardPreset = PRESETS[presetId as FeaturePreset];

    if (standardPreset) {
      nextFlags = {
        ...DEFAULT_FEATURE_FLAGS,
        ...standardPreset.flags,
      } as FeatureFlags;
    } else {
      const custom = customPresets.find((p) => p.id === presetId);
      if (custom) {
        nextFlags = custom.flags;
      } else {
        return;
      }
    }
    saveFlags(nextFlags);
  };

  const saveCustomPreset = async (label: string) => {
    if (!user) return;
    const newPreset: CustomPreset = {
      id: crypto.randomUUID(),
      label,
      flags: { ...flags },
      createdAt: new Date().toISOString(),
    };
    const nextPresets = [...customPresets, newPreset];
    setCustomPresets(nextPresets);
    await saveFlags(flags, nextPresets);
  };

  const deleteCustomPreset = async (id: string) => {
    const nextPresets = customPresets.filter((p) => p.id !== id);
    setCustomPresets(nextPresets);
    await saveFlags(flags, nextPresets);
  };

  const resetToDefaults = async () => {
    saveFlags(DEFAULT_FEATURE_FLAGS);
  };

  return (
    <FeatureFlagContext.Provider
      value={{
        flags,
        customPresets,
        featureHealth,
        toggleFlag,
        applyPreset,
        saveCustomPreset,
        deleteCustomPreset,
        resetToDefaults,
        isReady,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagProvider",
    );
  }
  return context;
};
