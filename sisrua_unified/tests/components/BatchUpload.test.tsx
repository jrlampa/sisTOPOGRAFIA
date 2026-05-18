import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import BatchUpload from '@/components/BatchUpload';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dxfService from '@/services/dxfService';

// Mock dependencies
vi.mock('@/services/dxfService');

describe('BatchUpload component', () => {
  const mockOnError = vi.fn();
  const mockOnInfo = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders correctly in initial state', () => {
    render(<BatchUpload onError={mockOnError} onInfo={mockOnInfo} />);
    expect(screen.getAllByText(/Processamento em Lote/i)[0]).toBeDefined();
    expect(screen.getByText(/Arraste CSV ou Planilha Excel/i)).toBeDefined();
  });

  it('handles successful file upload and starts polling', async () => {
    const mockBatchResponse = {
      results: [
        { name: 'Job 1', status: 'queued', jobId: 'j1', progress: 0 }
      ],
      errors: []
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify(mockBatchResponse),
      status: 200
    } as any);

    vi.mocked(dxfService.getDxfJobStatus).mockResolvedValue({ 
        status: 'completed', 
        result: { url: 'http://test.com/1.dxf' } 
    } as any);

    render(<BatchUpload onError={mockOnError} onInfo={mockOnInfo} />);
    
    const file = new File(['name,lat,lng\nP1,0,0'], 'batch.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Arraste CSV ou Planilha Excel/i);
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText('Job 1')).toBeDefined();
    expect(screen.getByText('Na fila')).toBeDefined();

    // Advance timers for polling
    await act(async () => {
      vi.advanceTimersByTime(5001);
    });

    expect(screen.getByText(/Conclu[íi]do/i)).toBeDefined();
    expect(screen.getByText('Baixar')).toBeDefined();
    expect(mockOnInfo).toHaveBeenCalledWith(expect.stringContaining("concluído"));
  });

  it('handles validation error for invalid file type', async () => {
    render(<BatchUpload onError={mockOnError} onInfo={mockOnInfo} />);
    
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/Arraste CSV ou Planilha Excel/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining("Formato inválido"));
  });

  it('handles API error during upload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ error: 'Server Overload' }),
      status: 503
    } as any);

    render(<BatchUpload onError={mockOnError} onInfo={mockOnInfo} />);
    
    const file = new File(['test'], 'batch.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/Arraste CSV ou Planilha Excel/i);
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getAllByText(/Server Overload/i)[0]).toBeDefined();
    expect(mockOnError).toHaveBeenCalledWith('Server Overload');
  });

  it('handles job failure during polling', async () => {
    const mockBatchResponse = {
      results: [{ name: 'Job 1', status: 'queued', jobId: 'j1' }],
      errors: []
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify(mockBatchResponse),
      status: 200
    } as any);

    vi.mocked(dxfService.getDxfJobStatus).mockResolvedValue({ 
        status: 'failed', 
        error: 'Engine crash' 
    } as any);

    render(<BatchUpload onError={mockOnError} onInfo={mockOnInfo} />);
    
    const file = new File(['test'], 'batch.csv', { type: 'text/csv' });
    await act(async () => {
        fireEvent.change(screen.getByLabelText(/Arraste CSV ou Planilha Excel/i), { target: { files: [file] } });
    });

    await act(async () => {
        vi.advanceTimersByTime(5001);
    });

    expect(screen.getByText('Erro')).toBeDefined();
    expect(screen.getByText('Engine crash')).toBeDefined();
  });
});
