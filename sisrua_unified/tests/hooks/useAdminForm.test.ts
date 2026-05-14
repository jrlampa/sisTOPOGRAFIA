import { renderHook, act } from '@testing-library/react';
import { useAdminForm } from '@/hooks/useAdminForm';
import { describe, it, expect, vi } from 'vitest';
import type { AdminSettings } from '@/types';

describe('useAdminForm hook', () => {
  const initialValues: AdminSettings = {
    theme: 'light',
    language: 'pt-BR',
    autoSave: true,
    debugMode: false,
    serviceTiers: [
      {
        serviceName: 'Core Engine',
        tier: 'platinum',
        supportHours: '24/7',
        slaAvailabilityPct: 99.9,
        sloLatencyP95Ms: 50,
        supportChannel: 'internal'
      }
    ],
    billing: { provider: 'stripe' }
  } as any;

  it('initializes correctly', () => {
    const { result } = renderHook(() => useAdminForm(initialValues));
    expect(result.current.form).toEqual(initialValues);
    expect(result.current.errors).toEqual({});
  });

  it('updates flat fields', () => {
    const { result } = renderHook(() => useAdminForm(initialValues));
    
    act(() => {
      result.current.handleChange('theme', 'dark');
    });

    expect(result.current.form.theme).toBe('dark');
  });

  it('updates nested fields in arrays', () => {
    const { result } = renderHook(() => useAdminForm(initialValues));
    
    act(() => {
      result.current.handleChange('serviceTiers.0.serviceName', 'Fast Engine');
    });

    expect(result.current.form.serviceTiers[0].serviceName).toBe('Fast Engine');
  });

  it('validates on blur', () => {
    const { result } = renderHook(() => useAdminForm(initialValues));
    
    act(() => {
        // Set invalid value
        result.current.handleChange('serviceTiers.0.slaAvailabilityPct', 150);
    });

    act(() => {
      result.current.handleBlur('serviceTiers.0.slaAvailabilityPct');
    });

    expect(result.current.touched['serviceTiers.0.slaAvailabilityPct']).toBe(true);
    expect(result.current.errors['serviceTiers.0.slaAvailabilityPct']).toBeDefined();
  });

  it('submits valid form', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useAdminForm(initialValues));
    
    const mockEvent = { preventDefault: vi.fn() } as any;

    await act(async () => {
      await result.current.handleSubmit(onSubmit)(mockEvent);
    });

    expect(onSubmit).toHaveBeenCalledWith(initialValues);
    expect(result.current.isSubmitting).toBe(false);
  });

  it('blocks invalid form submission', async () => {
    const onSubmit = vi.fn();
    const invalidValues = { ...initialValues, theme: 'invalid' as any };
    const { result } = renderHook(() => useAdminForm(invalidValues));
    
    const mockEvent = { preventDefault: vi.fn() } as any;

    await act(async () => {
      await result.current.handleSubmit(onSubmit)(mockEvent);
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors['theme']).toBeDefined();
  });

  it('resets form', () => {
    const { result } = renderHook(() => useAdminForm(initialValues));
    
    act(() => {
      result.current.handleChange('theme', 'dark');
    });
    expect(result.current.form.theme).toBe('dark');

    act(() => {
      result.current.reset();
    });
    expect(result.current.form.theme).toBe('light');
  });
});
