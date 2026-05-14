import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock URL.createObjectURL
global.URL.createObjectURL = () => 'mock-url';
global.URL.revokeObjectURL = () => {};

// Mock IntersectionObserver
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock
});

// Mock framer-motion to avoid animation-related test failures
vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: (props: any) => React.createElement('div', props, props.children),
      form: (props: any) => React.createElement('form', props, props.children),
      aside: (props: any) => React.createElement('aside', props, props.children),
      p: (props: any) => React.createElement('p', props, props.children),
      button: (props: any) => React.createElement('button', props, props.children),
      span: (props: any) => React.createElement('span', props, props.children),
      h2: (props: any) => React.createElement('h2', props, props.children),
      section: (props: any) => React.createElement('section', props, props.children),
      nav: (props: any) => React.createElement('nav', props, props.children),
    },
    AnimatePresence: ({ children }: any) => children,
    useReducedMotion: () => false,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    Variants: {},
  };
});

// Mock Leaflet
const LMock: any = {
  latLng: (lat: number, lng: number) => ({
    lat,
    lng,
    distanceTo: () => 100,
  }),
  divIcon: (options: any) => ({ options }),
  DomEvent: {
    stopPropagation: vi.fn(),
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn(),
  },
};
(global as any).L = LMock;

// Mock react-leaflet
vi.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'map-container' }, children),
    TileLayer: () => React.createElement('div', { 'data-testid': 'tile-layer' }),
    Pane: ({ children }: any) => React.createElement('div', { 'data-testid': 'pane' }, children),
    CircleMarker: ({ children, eventHandlers }: any) => {
        const props: any = { 'data-testid': 'circle-marker' };
        if (eventHandlers?.click) props.onClick = eventHandlers.click;
        return React.createElement('div', props, children);
    },
    Polyline: ({ children }: any) => React.createElement('div', { 'data-testid': 'polyline' }, children),
    Tooltip: ({ children }: any) => React.createElement('div', { 'data-testid': 'tooltip' }, children),
    Marker: ({ children, eventHandlers, icon }: any) => {
        const props: any = { 'data-testid': 'marker' };
        if (eventHandlers?.click) props.onClick = eventHandlers.click;
        if (eventHandlers?.dragend) props.onDragEnd = eventHandlers.dragend;
        
        let iconHtml = null;
        if (icon?.options?.html) {
            iconHtml = React.createElement('div', { 
                'data-testid': 'marker-icon-html',
                dangerouslySetInnerHTML: { __html: icon.options.html } 
            });
        }
        
        return React.createElement('div', props, [iconHtml, children]);
    },
    Circle: ({ children }: any) => React.createElement('div', { 'data-testid': 'circle' }, children),
    useMap: () => ({
      flyTo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      getCenter: () => ({ lat: 0, lng: 0 }),
      getZoom: () => 13,
    }),
    useMapEvents: () => ({}),
    Popup: ({ children }: any) => React.createElement('div', { 'data-testid': 'popup' }, children),
  };
});

// Create a div with id 'root' for React Testing Library
const div = document.createElement('div');
div.setAttribute('id', 'root');
document.body.appendChild(div);
