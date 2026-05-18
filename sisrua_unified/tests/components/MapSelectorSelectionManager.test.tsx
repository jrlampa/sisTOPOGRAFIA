import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SelectionManager from '@/components/MapSelectorSelectionManager';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMapEvents } from 'react-leaflet';
import L from 'leaflet';

describe('SelectionManager component', () => {
  const defaultProps: any = {
    locale: 'pt-BR',
    center: { lat: 0, lng: 0 },
    radius: 100,
    selectionMode: 'circle',
    polygonPoints: [],
    onLocationChange: vi.fn(),
    onPolygonChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles click in circle mode to update location', () => {
    render(<SelectionManager {...defaultProps} />);
    const handlers = (global as any).__latestMapHandlers;
    
    act(() => {
      handlers.click({ latlng: { lat: 10, lng: 20 }, originalEvent: { target: document.body } });
    });

    expect(defaultProps.onLocationChange).toHaveBeenCalledWith(expect.objectContaining({ lat: 10, lng: 20 }));
  });

  it('handles click in polygon mode to add points', () => {
    const props = { ...defaultProps, selectionMode: 'polygon', polygonPoints: [[0, 0]] };
    render(<SelectionManager {...props} />);
    const handlers = (global as any).__latestMapHandlers;
    
    act(() => {
      handlers.click({ latlng: { lat: 1, lng: 1 }, originalEvent: { target: document.body } });
    });

    expect(defaultProps.onPolygonChange).toHaveBeenCalledWith([[0, 0], [1, 1]]);
  });

  it('handles contextmenu to show BT options', () => {
    const onBtContext = vi.fn();
    render(<SelectionManager {...defaultProps} btEditorMode="add-pole" onBtContextAction={onBtContext} />);
    const handlers = (global as any).__latestMapHandlers;
    
    act(() => {
      handlers.contextmenu({ latlng: { lat: 5, lng: 5 } });
    });

    // Should show popup with actions
    expect(screen.getByText(/\+CONDUTOR/i)).toBeDefined();
    expect(screen.getByText(/\+TRAFO/i)).toBeDefined();
    
    fireEvent.click(screen.getByText(/\+POSTE/i));
    expect(onBtContext).toHaveBeenCalledWith('add-pole', expect.objectContaining({ lat: 5, lng: 5 }));
  });

  it('handles keyboard panning', () => {
    render(<SelectionManager {...defaultProps} keyboardPanEnabled={true} />);
    const mockMap = (global as any).__latestMapInstance;
    
    fireEvent.keyDown(window, { key: 'w' });
    expect(mockMap.panBy).toHaveBeenCalledWith([0, -80], { animate: false });

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(mockMap.panBy).toHaveBeenCalledWith([0, 80], { animate: false });
  });

  it('renders existing polygon points as markers', () => {
    const points: Array<[number, number]> = [[0, 0], [1, 1]];
    render(<SelectionManager {...defaultProps} selectionMode="polygon" polygonPoints={points} />);
    
    expect(screen.getAllByTestId('marker')).toHaveLength(2);
    // Polyline is rendered once for the border
    expect(screen.getAllByTestId('polyline').length).toBeGreaterThan(0);
  });

  it('handles box selection', () => {
    const onBoxSelect = vi.fn();
    render(<SelectionManager {...defaultProps} onBoxSelect={onBoxSelect} />);
    const handlers = (global as any).__latestMapHandlers;
    
    const mockBounds = { getNorth: () => 1 } as any;
    act(() => {
        handlers.boxzoomend({ boxZoomBounds: mockBounds });
    });

    expect(onBoxSelect).toHaveBeenCalledWith(mockBounds);
  });
});
