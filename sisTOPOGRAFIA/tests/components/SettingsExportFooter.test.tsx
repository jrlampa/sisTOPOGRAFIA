import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import SettingsExportFooter from '../../src/components/settings/SettingsExportFooter';

describe('SettingsExportFooter', () => {
  it('exibe mensagem de placeholder quando hasData=false', () => {
    render(<SettingsExportFooter hasData={false} />);
    expect(screen.getByText(/Realize uma análise primeiro/)).toBeDefined();
  });

  it('exibe mensagem de placeholder quando hasData não é fornecido', () => {
    render(<SettingsExportFooter />);
    expect(screen.getByText(/Realize uma análise primeiro/)).toBeDefined();
  });

  it('exibe botões de exportação quando hasData=true', () => {
    render(<SettingsExportFooter hasData={true} onExportDxf={vi.fn()} onExportGeoJSON={vi.fn()} />);
    expect(screen.getByText('GeoJSON')).toBeDefined();
    expect(screen.getByText('DXF (CAD)')).toBeDefined();
  });

  it('chama onExportGeoJSON ao clicar no botão GeoJSON', () => {
    const onExportGeoJSON = vi.fn();
    render(<SettingsExportFooter hasData={true} onExportGeoJSON={onExportGeoJSON} onExportDxf={vi.fn()} />);
    fireEvent.click(screen.getByText('GeoJSON'));
    expect(onExportGeoJSON).toHaveBeenCalledTimes(1);
  });

  it('chama onExportDxf ao clicar no botão DXF', () => {
    const onExportDxf = vi.fn();
    render(<SettingsExportFooter hasData={true} onExportDxf={onExportDxf} onExportGeoJSON={vi.fn()} />);
    fireEvent.click(screen.getByText('DXF (CAD)'));
    expect(onExportDxf).toHaveBeenCalledTimes(1);
  });

  it('botões ficam desabilitados quando isDownloading=true', () => {
    render(
      <SettingsExportFooter
        hasData={true}
        isDownloading={true}
        onExportDxf={vi.fn()}
        onExportGeoJSON={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('exibe ícone de loading quando isDownloading=true', () => {
    const { container } = render(
      <SettingsExportFooter hasData={true} isDownloading={true} onExportDxf={vi.fn()} onExportGeoJSON={vi.fn()} />
    );
    // The Loader2 icon has animate-spin class
    const loader = container.querySelector('.animate-spin');
    expect(loader).not.toBeNull();
  });

  it('botões ficam desabilitados quando callbacks não são fornecidos', () => {
    render(<SettingsExportFooter hasData={true} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(btn => {
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });
});
