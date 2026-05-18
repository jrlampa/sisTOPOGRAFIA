import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MapSelectorEdgesLayer from '@/components/MapSelectorEdgesLayer';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapContainer } from 'react-leaflet';
import { SpatialJurisdictionService } from '@/services/spatialJurisdictionService';

// Mock SpatialJurisdictionService
vi.mock('@/services/spatialJurisdictionService', () => ({
  SpatialJurisdictionService: {
    isEdgeInterJurisdictional: vi.fn(() => false),
  }
}));

describe('MapSelectorEdgesLayer component', () => {
  const mockPoles = new Map([
    ['p1', { id: 'p1', lat: -23, lng: -46, title: 'P1' }],
    ['p2', { id: 'p2', lat: -23.001, lng: -46.001, title: 'P2' }]
  ]);

  const mockTopology = {
    edges: [
      { id: 'e1', fromPoleId: 'p1', toPoleId: 'p2', conductors: [], edgeChangeFlag: 'existing' }
    ]
  };

  const defaultProps = {
    paneName: 'test-pane',
    topology: mockTopology as any,
    polesById: mockPoles as any,
    locale: 'pt-BR' as const,
    layerConfig: { labels: true } as any,
    onBtDeleteEdge: vi.fn(),
    onBtSetEdgeChangeFlag: vi.fn(),
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MapContainer center={[0, 0]} zoom={13}>{children}</MapContainer>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all edges as Polylines', () => {
    render(<MapSelectorEdgesLayer {...defaultProps} />, { wrapper });
    // Polyline mock in setup.ts renders a div with data-testid="polyline"
    // The component renders 3 polylines per edge
    expect(screen.getAllByTestId('polyline')).toHaveLength(3);
  });

  it('renders removal markers for "remove" edges', () => {
    const removeTopology = {
      edges: [{ ...mockTopology.edges[0], edgeChangeFlag: 'remove' }]
    };
    render(<MapSelectorEdgesLayer {...defaultProps} topology={removeTopology as any} />, { wrapper });
    // Marker mock in setup.ts renders a div with data-testid="marker"
    expect(screen.getAllByTestId('marker')).toHaveLength(12);
  });

  it('shows tooltip with conductor info', () => {
    const topologyWithConductors = {
      edges: [{ 
        ...mockTopology.edges[0], 
        conductors: [{ id: 'c1', quantity: 3, conductorName: '70 Al' }] 
      }]
    };
    render(<MapSelectorEdgesLayer {...defaultProps} topology={topologyWithConductors as any} />, { wrapper });
    // Use getAllByText because Tooltip and Popup might both have it
    expect(screen.getAllByText('3x70 Al (BT)')).toBeDefined();
  });

  it('highlights inter-jurisdictional edges', () => {
    vi.mocked(SpatialJurisdictionService.isEdgeInterJurisdictional).mockReturnValue(true);
    render(<MapSelectorEdgesLayer {...defaultProps} />, { wrapper });
    // Use getAllByText for ambiguity
    expect(screen.getAllByText(/Cruzamento/i)).toBeDefined();
  });

  it('handles dragging state visual indicators', () => {
    render(
      <MapSelectorEdgesLayer 
        {...defaultProps} 
        draggedPole={{ id: 'p1', lat: -23.002, lng: -46.002 }} 
      />, 
      { wrapper }
    );
    // Use regex to match only the distance badge, avoiding other 'm' characters
    expect(screen.getByText(/^\d+\.\d+m$/)).toBeDefined();
  });
});
