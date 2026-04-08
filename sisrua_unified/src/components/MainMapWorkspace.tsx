import React, { Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { BtModalStack } from './BtModalStack';

const MapSelector = React.lazy(() => import('./MapSelector'));
const FloatingLayerPanel = React.lazy(() => import('./FloatingLayerPanel'));
const ElevationProfile = React.lazy(() => import('./ElevationProfile'));

const MapSuspenseFallback = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-300">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 text-sm font-semibold">
      <Loader2 size={18} className="animate-spin" />
      Carregando mapa 2.5D...
    </div>
  </div>
);

const InlineSuspenseFallback = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
    <Loader2 size={14} className="animate-spin" />
    {label}
  </div>
);

type Props = {
  mapSelectorProps: any;
  floatingLayerPanelProps: any;
  elevationProfileData: any[];
  onCloseElevationProfile: () => void;
  isDark: boolean;
  btModalStackProps: React.ComponentProps<typeof BtModalStack>;
};

export function MainMapWorkspace({
  mapSelectorProps,
  floatingLayerPanelProps,
  elevationProfileData,
  onCloseElevationProfile,
  isDark,
  btModalStackProps,
}: Props) {
  return (
    <div className="flex-1 relative z-10">
      <Suspense fallback={<MapSuspenseFallback />}>
        <MapSelector {...mapSelectorProps} />

        <FloatingLayerPanel {...floatingLayerPanelProps} />
      </Suspense>

      <AnimatePresence>
        {elevationProfileData.length > 0 && (
          <Suspense fallback={<InlineSuspenseFallback label="Carregando perfil altimetrico" />}>
            <ElevationProfile
              data={elevationProfileData}
              onClose={onCloseElevationProfile}
              isDark={isDark}
            />
          </Suspense>
        )}
      </AnimatePresence>

      <BtModalStack {...btModalStackProps} />
    </div>
  );
}
