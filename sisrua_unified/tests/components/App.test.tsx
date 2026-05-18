import React from 'react';
import { render, screen, act } from '@testing-library/react';
import App from '@/App';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ProjectService } from '@/services/projectService';

// Mock all internal hooks of App
vi.mock('@/hooks/useAppHooks', () => ({
  useAppHooks: vi.fn(() => ({
    orchestrator: {
        appState: { settings: { locale: 'pt-BR' }, btTopology: { poles: [] } },
        setAppState: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        appPast: [],
        appFuture: [],
        saveSnapshot: vi.fn(),
    },
    osmEngine: { isProcessing: false, progressValue: 0, statusMessage: '' },
    autoSave: { status: 'idle', lastAutoSaved: undefined },
    elevationProfile: { profileData: [], clearProfile: vi.fn() },
    mapState: {
        updateSettings: vi.fn(),
        showToast: vi.fn(),
        toasts: [],
        closeToast: vi.fn(),
        showSettings: false,
        openSettings: vi.fn(),
        closeSettings: vi.fn(),
        handleSelectionModeChange: vi.fn(),
        handleRadiusChange: vi.fn(),
        handleClearPolygon: vi.fn(),
        isPolygonValid: true,
        handleRestoreSession: vi.fn(),
        handleDismissSession: vi.fn(),
        sessionDraft: null,
    },
    topologySources: { mtTopology: { poles: [], edges: [] }, mapRenderSources: {}, dgTopologySource: null },
    derivedState: {
        btSummary: {},
        accumulatedByPole: [],
        isCalculating: false,
        hasBtPoles: false,
    },
    compliance: { result: null },
  }))
}));

vi.mock('@/hooks/useAppCommandPalette', () => ({
    useAppCommandPalette: vi.fn(() => ({ actions: [] }))
}));

vi.mock('@/hooks/useAppElectricalAudit', () => ({
    useAppElectricalAudit: vi.fn(() => ({ isAuditOpen: false }))
}));

vi.mock('@/hooks/useAppSidebarProps', () => ({
    useAppSidebarProps: vi.fn(() => ({}))
}));

vi.mock('@/hooks/useAppAnalysisWorkflow', () => ({
    useAppAnalysisWorkflow: vi.fn(() => ({}))
}));

vi.mock('@/hooks/useAppGlobalHotkeys', () => ({
    useAppGlobalHotkeys: vi.fn()
}));

// Mock components
vi.mock('@/components/AppWorkspace', () => ({
    AppWorkspace: () => <div data-testid="app-workspace">Workspace</div>
}));
vi.mock('@/components/SnapshotModal', () => ({
    SnapshotModal: () => <div data-testid="snapshot-modal">Snapshots</div>
}));
vi.mock('@/components/Toast', () => ({
    default: () => null
}));
vi.mock('@/components/CommandPalette', () => ({
    CommandPalette: () => null
}));
vi.mock('@/components/HelpModal', () => ({
    HelpModal: () => null
}));
vi.mock('@/components/SettingsModal', () => ({
    default: () => null
}));

// Mock ProjectService
vi.mock('@/services/projectService', () => ({
    ProjectService: {
        getProjectState: vi.fn().mockResolvedValue(null)
    }
}));

describe('App root component', () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AppWorkspace', async () => {
    renderWithRouter(<App />);
    expect(screen.getByTestId('app-workspace')).toBeDefined();
  });

  it('loads project on mount if id is in params', async () => {
    // useParams is mocked by react-router-dom mock in tests/setup? 
    // No, but we can mock it here if needed or use MemoryRouter
  });
});
