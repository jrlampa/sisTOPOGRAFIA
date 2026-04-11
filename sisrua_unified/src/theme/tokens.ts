import type { AppTheme } from '../types';

export type ThemeTokenMap = Record<string, string>;

export const THEME_TOKENS: Record<AppTheme, ThemeTokenMap> = {
  light: {
    '--app-shell-bg': '#f8fafc',
    '--app-shell-fg': '#0f172a',
    '--app-header-bg': 'rgba(255, 255, 255, 0.84)',
    '--app-header-border': 'rgba(148, 163, 184, 0.35)',
    '--app-sidebar-bg': 'rgba(255, 255, 255, 0.96)',
    '--app-sidebar-border': 'rgba(148, 163, 184, 0.35)',
    '--text-app-title': '#0f172a',
    '--text-app-subtle': '#475569',
    '--glass-bg': 'rgba(255, 255, 255, 0.72)',
    '--glass-border': 'rgba(255, 255, 255, 0.34)',
    '--glass-shadow': '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
    '--enterprise-blue': '#1e3a8a',
    '--enterprise-blue-light': '#3b82f6',
    '--enterprise-accent': '#06b6d4',
    '--bg-gradient-start': '#e0f2fe',
    '--bg-gradient-mid': '#fbcfe8',
    '--bg-gradient-end': '#fef3c7',
  },
  dark: {
    '--app-shell-bg': '#020617',
    '--app-shell-fg': '#e2e8f0',
    '--app-header-bg': 'rgba(2, 6, 23, 0.84)',
    '--app-header-border': 'rgba(148, 163, 184, 0.2)',
    '--app-sidebar-bg': '#020617',
    '--app-sidebar-border': 'rgba(148, 163, 184, 0.2)',
    '--text-app-title': '#f8fafc',
    '--text-app-subtle': '#94a3b8',
    '--glass-bg': 'rgba(15, 23, 42, 0.64)',
    '--glass-border': 'rgba(51, 65, 85, 0.6)',
    '--glass-shadow': '0 10px 34px 0 rgba(2, 6, 23, 0.55)',
    '--enterprise-blue': '#60a5fa',
    '--enterprise-blue-light': '#93c5fd',
    '--enterprise-accent': '#22d3ee',
    '--bg-gradient-start': '#020617',
    '--bg-gradient-mid': '#0f172a',
    '--bg-gradient-end': '#1e293b',
  },
};