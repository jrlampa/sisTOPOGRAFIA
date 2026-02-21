import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../src/config/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ seconds: 1000000, nanoseconds: 0 })) }
}));

import { useFileOperations } from '../../src/hooks/useFileOperations';
import { useAuth } from '../../src/contexts/AuthContext';
import { addDoc } from 'firebase/firestore';
import { GlobalState } from '../../src/types';
import Logger from '../../src/utils/logger';

// ── Shared fixtures ─────────────────────────────────────────────────────────

const mockAppState: GlobalState = {
  center: { lat: -22.15018, lng: -42.92185, label: 'Nova Friburgo' },
  radius: 500,
  selectionMode: 'circle',
  polygon: [],
  measurePath: [],
  settings: {
    enableAI: true,
    simplificationLevel: 'low',
    orthogonalize: true,
    projection: 'utm',
    theme: 'dark',
    mapProvider: 'vector',
    contourInterval: 5,
    layers: {
      buildings: true, roads: true, curbs: true, nature: true, terrain: true,
      contours: false, slopeAnalysis: false, furniture: true, labels: true,
      dimensions: false, grid: false
    },
    projectMetadata: {
      projectName: 'NOVA_FRIBURGO',
      companyName: 'TEST_CO',
      engineerName: 'Eng. Silva',
      date: '2026-02-21',
      scale: '1:1000',
      revision: 'R00'
    }
  }
};

const mockSetAppState = vi.fn();
const mockOnSuccess = vi.fn();
const mockOnError = vi.fn();

const defaultProps = {
  appState: mockAppState,
  setAppState: mockSetAppState,
  onSuccess: mockOnSuccess,
  onError: mockOnError
};

// ── Test helpers ────────────────────────────────────────────────────────────

function renderUnauthenticated() {
  (useAuth as any).mockReturnValue({ user: null });
  return renderHook(() => useFileOperations(defaultProps));
}

function renderAuthenticated(uid = 'user-123') {
  (useAuth as any).mockReturnValue({ user: { uid } });
  return renderHook(() => useFileOperations(defaultProps));
}

describe('useFileOperations', () => {
  let anchorClickSpy: ReturnType<typeof vi.fn>;
  let origCreateElement: typeof document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger, 'error').mockImplementation(() => {});

    anchorClickSpy = vi.fn();
    origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') { el.click = anchorClickSpy; }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── initialState ─────────────────────────────────────────────────────────

  it('inicializa com isLoading=false', () => {
    const { result } = renderUnauthenticated();
    expect(result.current.isLoading).toBe(false);
  });

  // ── saveProject ──────────────────────────────────────────────────────────

  it('saveProject cria blob, aciona download e chama onSuccess', () => {
    const { result } = renderUnauthenticated();

    act(() => { result.current.saveProject(); });

    expect(anchorClickSpy).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalledWith('Project Saved');
    expect(result.current.isLoading).toBe(false);
  });

  it('saveProject usa nome do projeto como filename (.osmpro)', () => {
    const { result } = renderUnauthenticated();

    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        el.click = anchorClickSpy;
        anchors.push(el as HTMLAnchorElement);
      }
      return el;
    });

    act(() => { result.current.saveProject(); });

    expect(anchors[0].download).toBe('NOVA_FRIBURGO.osmpro');
  });

  it('saveProject chama onError quando Blob lança exceção', () => {
    const origCreateObjectURL = global.URL.createObjectURL;
    global.URL.createObjectURL = vi.fn(() => { throw new Error('Blob error'); });

    try {
      const { result } = renderUnauthenticated();

      act(() => { result.current.saveProject(); });

      expect(mockOnError).toHaveBeenCalledWith('Failed to save project');
      expect(result.current.isLoading).toBe(false);
    } finally {
      global.URL.createObjectURL = origCreateObjectURL;
    }
  });

  // ── loadProject ──────────────────────────────────────────────────────────

  it('loadProject lê arquivo válido, chama setAppState e onSuccess', async () => {
    const { result } = renderUnauthenticated();
    const fileContent = JSON.stringify({ state: mockAppState, version: '1.0.0' });
    const file = new File([fileContent], 'project.osmpro', { type: 'application/json' });

    let readerLoadCallback: ((e: ProgressEvent<FileReader>) => void) | null = null;
    const mockReader = {
      readAsText: vi.fn(),
      onload: null as any,
      onerror: null as any,
    };
    Object.defineProperty(mockReader, 'onload', {
      set(cb) { readerLoadCallback = cb; },
      get() { return readerLoadCallback; }
    });

    vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader as any);

    act(() => { result.current.loadProject(file); });

    expect(result.current.isLoading).toBe(true);
    expect(mockReader.readAsText).toHaveBeenCalledWith(file);

    await act(async () => {
      readerLoadCallback!({ target: { result: fileContent } } as any);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockSetAppState).toHaveBeenCalledWith(mockAppState, true);
    expect(mockOnSuccess).toHaveBeenCalledWith('Project Loaded');
  });

  it('loadProject chama onError quando formato do arquivo é inválido', async () => {
    const { result } = renderUnauthenticated();
    const badContent = JSON.stringify({ wrong: 'format' });
    const file = new File([badContent], 'bad.osmpro');

    let readerLoadCallback: ((e: ProgressEvent<FileReader>) => void) | null = null;
    const mockReader = { readAsText: vi.fn(), onload: null as any, onerror: null as any };
    Object.defineProperty(mockReader, 'onload', {
      set(cb) { readerLoadCallback = cb; }
    });
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader as any);

    act(() => { result.current.loadProject(file); });

    await act(async () => {
      readerLoadCallback!({ target: { result: badContent } } as any);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockOnError).toHaveBeenCalledWith('Failed to load project');
  });

  it('loadProject chama onError quando JSON.parse falha', async () => {
    const { result } = renderUnauthenticated();
    const file = new File(['not json'], 'bad.osmpro');

    let readerLoadCallback: ((e: ProgressEvent<FileReader>) => void) | null = null;
    const mockReader = { readAsText: vi.fn(), onload: null as any, onerror: null as any };
    Object.defineProperty(mockReader, 'onload', {
      set(cb) { readerLoadCallback = cb; }
    });
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader as any);

    act(() => { result.current.loadProject(file); });

    await act(async () => {
      readerLoadCallback!({ target: { result: 'not json' } } as any);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockOnError).toHaveBeenCalledWith('Failed to load project');
  });

  it('loadProject chama onError quando reader.onerror é disparado', async () => {
    const { result } = renderUnauthenticated();
    const file = new File(['data'], 'project.osmpro');

    let readerErrorCallback: (() => void) | null = null;
    const mockReader = { readAsText: vi.fn(), onload: null as any, onerror: null as any };
    Object.defineProperty(mockReader, 'onerror', {
      set(cb) { readerErrorCallback = cb; }
    });
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader as any);

    act(() => { result.current.loadProject(file); });

    await act(async () => { readerErrorCallback!(); });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockOnError).toHaveBeenCalledWith('Failed to read file');
  });

  // ── saveToCloud ──────────────────────────────────────────────────────────

  it('saveToCloud chama onError quando usuário não está autenticado', async () => {
    const { result } = renderUnauthenticated();

    await act(async () => { await result.current.saveToCloud(); });

    expect(mockOnError).toHaveBeenCalledWith('Você precisa estar logado para salvar na nuvem.');
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('saveToCloud salva documento no Firestore e chama onSuccess', async () => {
    (addDoc as any).mockResolvedValueOnce({ id: 'doc-123' });

    const { result } = renderAuthenticated('user-abc');

    await act(async () => { await result.current.saveToCloud(); });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user-abc',
        projectName: 'NOVA_FRIBURGO',
        version: '1.0.0'
      })
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('Projeto salvo na nuvem com sucesso!');
    expect(result.current.isLoading).toBe(false);
  });

  it('saveToCloud chama onError quando addDoc lança exceção', async () => {
    (addDoc as any).mockRejectedValueOnce(new Error('Firestore unavailable'));

    const { result } = renderAuthenticated();

    await act(async () => { await result.current.saveToCloud(); });

    expect(mockOnError).toHaveBeenCalledWith('Falha ao salvar na nuvem.');
    expect(result.current.isLoading).toBe(false);
  });
});
