import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MapSelectorTransformersLayer from '@/components/MapLayers/MapSelectorTransformersLayer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapContainer } from 'react-leaflet';

describe('MapSelectorTransformersLayer component', () => {
  const mockTransformers = [
    { id: 't1', lat: -23, lng: -46, title: 'TR 1', projectPowerKva: 75, verified: true, dataSource: 'imported' }
  ];

  const mockPoles = new Map([
    ['p1', { id: 'p1', lat: -23, lng: -46, title: 'Pole 1' }]
  ]);

  const createProps = () => ({
    paneName: 'test-pane',
    transformers: mockTransformers as any,
    btEditorMode: 'none' as const,
    polesById: mockPoles as any,
    locale: 'pt-BR' as const,
    layerConfig: { labels: true } as any,
    onBtRenameTransformer: vi.fn(),
    onBtDeleteTransformer: vi.fn(),
    onBtSetTransformerChangeFlag: vi.fn(),
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MapContainer center={[0, 0]} zoom={13}>{children}</MapContainer>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all transformers as Markers', () => {
    render(<MapSelectorTransformersLayer {...createProps()} />, { wrapper });
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('shows tooltip with title and power', () => {
    render(<MapSelectorTransformersLayer {...createProps()} />, { wrapper });
    // Use getAllByText for ambiguity (Tooltip + Popup)
    expect(screen.getAllByText('TR 1')).toBeDefined();
    expect(screen.getAllByText(/75 kVA/i)).toBeDefined();
  });

  it('calls onRenameTransformer when title changes', () => {
    const onRename = vi.fn();
    const props = { ...createProps(), onBtRenameTransformer: onRename };
    render(<MapSelectorTransformersLayer {...props} />, { wrapper });
    
    const input = screen.getByTitle(/Nome do transformador t1/i);
    fireEvent.change(input, { target: { value: 'New TR Name' } });
    
    expect(onRename).toHaveBeenCalledWith('t1', 'New TR Name');
  });

  it('calls onBtSetTransformerChangeFlag when flag button clicked', () => {
    const onSetFlag = vi.fn();
    const props = { ...createProps(), onBtSetTransformerChangeFlag: onSetFlag };
    render(<MapSelectorTransformersLayer {...props} />, { wrapper });
    
    // Flag buttons are in the popup. Use getAllByText for ambiguity
    const buttons = screen.getAllByText(/Existente/i);
    fireEvent.click(buttons[0]);
    
    expect(onSetFlag).toHaveBeenCalledWith('t1', 'existing');
  });

  it('calls onDeleteTransformer when delete button clicked', () => {
    const onDelete = vi.fn();
    const props = { ...createProps(), onBtDeleteTransformer: onDelete };
    render(<MapSelectorTransformersLayer {...props} />, { wrapper });
    
    const deleteBtn = screen.getByTitle('Deletar transformador');
    fireEvent.click(deleteBtn);
    
    expect(onDelete).toHaveBeenCalledWith('t1');
  });
});
