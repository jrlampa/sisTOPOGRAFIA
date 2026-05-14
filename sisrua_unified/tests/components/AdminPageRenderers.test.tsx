import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderTenants, renderQuotas, renderFlags } from '@/components/AdminPageRenderers/TenantRenderers';
import { describe, it, expect } from 'vitest';

describe('TenantRenderers functions', () => {
  it('renderTenants renders tenant list correctly', () => {
    const data = {
      tenants: [
        { id: '1', name: 'IM3 Brasil', slug: 'im3', isActive: true, plan: 'enterprise' },
        { id: '2', name: 'Legacy Co', slug: 'legacy', isActive: false, plan: 'community' }
      ]
    };
    render(<>{renderTenants(data)}</>);
    expect(screen.getByText('IM3 Brasil')).toBeDefined();
    expect(screen.getByText('Ativo')).toBeDefined();
    expect(screen.getByText('legacy')).toBeDefined();
    expect(screen.getByText('Inativo')).toBeDefined();
  });

  it('renderQuotas renders usage progress bars', () => {
    const data = {
      quotas: [
        { tenantId: '1', resource: 'dxf_exports', limitValue: 100, usageValue: 80 }
      ]
    };
    render(<>{renderQuotas(data)}</>);
    expect(screen.getByText('dxf_exports')).toBeDefined();
    expect(screen.getByText('80% usado')).toBeDefined();
    expect(screen.getByText('100')).toBeDefined();
  });

  it('renderFlags renders status badges', () => {
    const data = {
      flags: [
        { tenantId: '1', flagCode: 'ENABLE_AI', isEnabled: true },
        { tenantId: '1', flagCode: 'BETA_MODE', isEnabled: false }
      ]
    };
    render(<>{renderFlags(data)}</>);
    expect(screen.getByText('ENABLE_AI')).toBeDefined();
    expect(screen.getByText('BETA_MODE')).toBeDefined();
  });

  it('returns null for invalid data', () => {
    expect(renderTenants(null)).toBeNull();
    expect(renderQuotas(null)).toBeNull();
    expect(renderFlags(null)).toBeNull();
  });
});
