import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppWorkspace } from '@/components/AppWorkspace';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';

const appSettingsOverlaySpy = vi.fn();

// Mock all sub-components to focus on AppWorkspace logic and prop passing
vi.mock('@/components/AppHeader', () => ({
  AppHeader: (props: any) => <div data-testid="mock-header" onClick={props.onOpenHelp}>Header</div>
}));
vi.mock('@/components/SidebarWorkspace', () => ({
  SidebarWorkspace: () => <div data-testid="mock-sidebar">Sidebar</div>
}));
vi.mock('@/components/MapSelector', () => ({
  default: () => <div data-testid="mock-map">Map</div>
}));
vi.mock('@/components/SessionRecoveryBanner', () => ({
  SessionRecoveryBanner: () => <div data-testid="mock-recovery">Recovery</div>
}));
vi.mock('@/components/HelpModal', () => ({
  HelpModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-help-modal">Help</div> : null
}));
vi.mock('@/components/AppSettingsOverlay', () => ({
  AppSettingsOverlay: (props: any) => {
    appSettingsOverlaySpy(props);
    return props.showSettings ? <div data-testid="mock-settings-overlay">Settings</div> : null;
  }
}));
vi.mock('@/components/BtModalStack', () => ({
  BtModalStack: () => <div data-testid="mock-modal-stack">Modals</div>
}));
vi.mock('@/components/BimInspectorDrawer', () => ({
  BimInspectorDrawer: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-bim-drawer">BIM</div> : null
}));
vi.mock('@/components/ElectricalAuditDrawer', () => ({
  ElectricalAuditDrawer: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-audit-drawer">Audit</div> : null
}));
vi.mock('@/components/BtTelescopicSuggestionModal', () => ({
  BtTelescopicSuggestionModal: () => <div data-testid="mock-telescopic-modal">Telescopic</div>
}));
vi.mock('@/components/Toast', () => ({
  default: () => <div data-testid="mock-toast">Toast</div>
}));
vi.mock('@/components/CommandPalette', () => ({
  CommandPalette: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-palette">Palette</div> : null
}));
vi.mock('@/components/FeatureSettingsModal', () => ({
  FeatureSettingsModal: ({ isOpen }: { isOpen: boolean }) => isOpen ? <div data-testid="mock-feature-settings">FeatureSettings</div> : null
}));
vi.mock('@/components/JurisdictionStatus', () => ({
  JurisdictionStatus: () => <div data-testid="mock-jurisdiction">Jurisdiction</div>
}));
vi.mock('@/components/MultiplayerAvatars', () => ({
  MultiplayerAvatars: () => <div data-testid="mock-multiplayer">Multiplayer</div>
}));

// Mock hooks
vi.mock('@/contexts/FeatureFlagContext', () => ({
  useFeatureFlags: vi.fn(() => ({ flags: { enableMultiplayer: true } }))
}));
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1', email: 'test@im3.com' } })),
  AuthProvider: ({ children }: any) => <>{children}</>
}));
vi.mock('@/hooks/useMultiplayer', () => ({
  useMultiplayer: vi.fn(() => ({ onlineUsers: [] }))
}));
vi.mock('@/hooks/useNeighborhoodAwareness', () => ({
  useNeighborhoodAwareness: vi.fn(() => ({ neighbors: [], hasCollision: false }))
}));

describe('AppWorkspace component', () => {
  beforeEach(() => {
    appSettingsOverlaySpy.mockClear();
  });

  const defaultProps: any = {
    settings: { locale: 'pt-BR', theme: 'dark', projectMetadata: { projectName: 'Test' } },
    isDark: true,
    toasts: [],
    btTopology: { poles: [], transformers: [], edges: [] },
    mtTopology: { poles: [], edges: [] },
    sidebarSelectionControlsProps: {},
    sidebarBtEditorSectionProps: {},
    sidebarAnalysisResultsProps: {},
    mapSelectorProps: { center: [0, 0] },
    polygon: [], // Added
    handleSaveProject: vi.fn(),
    handleLoadProject: vi.fn(),
    setIsHelpOpen: vi.fn(),
    updateSettings: vi.fn(),
  };

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  it('renders all core layout components', () => {
    renderWithRouter(<AppWorkspace {...defaultProps} />);
    expect(screen.getByTestId('mock-header')).toBeDefined();
    expect(screen.getByTestId('mock-sidebar')).toBeDefined();
    expect(screen.getByTestId('mock-map')).toBeDefined();
  });

  it('renders overlays and drawers when open', () => {
    const props = {
      ...defaultProps,
      isHelpOpen: true,
      showSettings: true,
      isBimInspectorOpen: true,
      isAuditOpen: true,
      isCommandPaletteOpen: true,
    };
    renderWithRouter(<AppWorkspace {...props} />);
    expect(screen.getByTestId('mock-help-modal')).toBeDefined();
    expect(screen.getByTestId('mock-settings-overlay')).toBeDefined();
    expect(screen.getByTestId('mock-bim-drawer')).toBeDefined();
    expect(screen.getByTestId('mock-audit-drawer')).toBeDefined();
    expect(screen.getByTestId('mock-palette')).toBeDefined();
  });

  it('wires full settings overlay props', () => {
    const props = {
      ...defaultProps,
      showSettings: true,
      osmData: { elements: [{ id: 1 }] },
    };

    renderWithRouter(<AppWorkspace {...props} />);

    expect(appSettingsOverlaySpy).toHaveBeenCalled();
    const overlayProps = appSettingsOverlaySpy.mock.calls[0][0];
    expect(overlayProps.showSettings).toBe(true);
    expect(overlayProps.hasData).toBe(true);
    expect(typeof overlayProps.updateSettings).toBe('function');
    expect(typeof overlayProps.handleSaveProject).toBe('function');
    expect(typeof overlayProps.handleLoadProject).toBe('function');
  });

  it('toggles help modal via header callback', () => {
    renderWithRouter(<AppWorkspace {...defaultProps} />);
    fireEvent.click(screen.getByTestId('mock-header'));
    expect(defaultProps.setIsHelpOpen).toHaveBeenCalledWith(true);
  });

  it('renders toasts correctly', () => {
    const props = {
      ...defaultProps,
      toasts: [{ id: '1', message: 'Hello', type: 'success' }]
    };
    renderWithRouter(<AppWorkspace {...props} />);
    expect(screen.getByTestId('mock-toast')).toBeDefined();
  });

  it('handles empty mapSelectorProps gracefully', () => {
    const props = { ...defaultProps, mapSelectorProps: null };
    renderWithRouter(<AppWorkspace {...props} />);
    expect(screen.getByText(/Carregando mapa/i)).toBeDefined();
  });
});
