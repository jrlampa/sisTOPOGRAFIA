import React from 'react';
import { render, screen, act } from '@testing-library/react';
import DashboardPage from '@/pages/DashboardPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuth } from '@/auth/AuthProvider';
import { ProjectService } from '@/services/projectService';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/auth/AuthProvider');
vi.mock('@/services/projectService');

describe('DashboardPage component', () => {
  const mockUser = { email: 'engineer@im3brasil.com.br' };
  const mockProjects = [
    { id: 'p1', name: 'Project 1', isArchived: false, areaM2: 1000 },
    { id: 'p2', name: 'Project 2', isArchived: true, areaM2: 500 },
  ];
  const mockActivity = [
    { id: 'a1', projectName: 'Project 1', action: 'Criou', userName: 'Engineer', timestamp: new Date().toISOString() }
  ];

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: mockUser } as any);
    vi.mocked(ProjectService.listProjects).mockResolvedValue(mockProjects as any);
    vi.mocked(ProjectService.getRecentActivity).mockResolvedValue(mockActivity as any);
  });

  it('renders stats correctly after loading', async () => {
    renderWithRouter(<DashboardPage />);
    
    // Initial state shows dots
    expect(screen.getAllByText('...')).toBeDefined();

    // Wait for useEffect
    await act(async () => {});

    // Active project count (main stat)
    const stats = screen.getAllByText('1');
    expect(stats.length).toBeGreaterThan(0);
    
    expect(screen.getByText(/1 arquivados/i)).toBeDefined();
    expect(screen.getByText('1.0k m²')).toBeDefined(); // Total area
  });

  it('renders recent activity list', async () => {
    renderWithRouter(<DashboardPage />);
    
    await act(async () => {});

    expect(screen.getByText('Project 1')).toBeDefined();
    expect(screen.getByText(/Criou por/i)).toBeDefined();
    expect(screen.getByText('Engineer')).toBeDefined();
  });

  it('shows welcome message with user name', async () => {
    renderWithRouter(<DashboardPage />);
    
    await act(async () => {});

    // Match exactly the user span
    expect(screen.getByText('engineer')).toBeDefined();
    expect(screen.getByText(/Bem-vindo ao centro de comando/i)).toBeDefined();
  });

  it('handles empty activity list', async () => {
    vi.mocked(ProjectService.getRecentActivity).mockResolvedValue([]);
    renderWithRouter(<DashboardPage />);
    
    await act(async () => {});

    expect(screen.getByText(/Nenhuma atividade registrada/i)).toBeDefined();
  });
});
