import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProjectPage } from '@/pages/ProjectPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '@/services/projectService';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/services/projectService');

describe('ProjectPage component', () => {
  const mockProjects = [
    { id: 'p1', name: 'Alpha Project', location: 'RJ', category: 'Urban', status: 'finalized', areaM2: 1000, updatedAt: new Date().toISOString(), isArchived: false },
    { id: 'p2', name: 'Beta Project', location: 'SP', category: 'Rural', status: 'draft', areaM2: 500, updatedAt: new Date().toISOString(), isArchived: false }
  ];

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(ui, { wrapper: BrowserRouter });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectService.listProjects).mockResolvedValue(mockProjects as any);
  });

  it('renders project list correctly after loading', async () => {
    renderWithRouter(<ProjectPage />);
    
    expect(screen.getByText(/Sincronizando/i)).toBeDefined();

    await act(async () => {});

    expect(screen.getByText('Alpha Project')).toBeDefined();
    expect(screen.getByText('Beta Project')).toBeDefined();
  });

  it('filters projects by search query', async () => {
    renderWithRouter(<ProjectPage />);
    await act(async () => {});

    const searchInput = screen.getByPlaceholderText(/Buscar projeto/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Alpha Project')).toBeDefined();
    expect(screen.queryByText('Beta Project')).toBeNull();
  });

  it('filters projects by category', async () => {
    renderWithRouter(<ProjectPage />);
    await act(async () => {});

    // There are multiple "Urban" texts (one in filter button, one in card)
    const filterButtons = screen.getAllByRole('button');
    const urbanFilter = filterButtons.find(b => b.textContent === 'Urban');
    if (urbanFilter) fireEvent.click(urbanFilter);

    expect(screen.getByText('Alpha Project')).toBeDefined();
    expect(screen.queryByText('Beta Project')).toBeNull();
  });

  it('handles archiving a project', async () => {
    vi.mocked(ProjectService.setArchived).mockResolvedValue(undefined as any);
    renderWithRouter(<ProjectPage />);
    await act(async () => {});

    // There are multiple archive buttons (one per card)
    const archiveBtns = screen.getAllByTitle('Arquivar');
    fireEvent.click(archiveBtns[0]);

    expect(ProjectService.setArchived).toHaveBeenCalledWith('p1', true);
  });

  it('handles cloning a project', async () => {
    vi.stubGlobal('alert', vi.fn());
    vi.mocked(ProjectService.cloneProject).mockResolvedValue('new-p1');
    renderWithRouter(<ProjectPage />);
    await act(async () => {});

    const cloneBtns = screen.getAllByTitle('Duplicar Projeto');
    fireEvent.click(cloneBtns[0]);

    expect(ProjectService.cloneProject).toHaveBeenCalledWith('p1');
    await act(async () => {});
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('sucesso'));
  });

  it('opens new project modal', async () => {
    renderWithRouter(<ProjectPage />);
    await act(async () => {});

    fireEvent.click(screen.getByText(/Novo Recorte/i));
    // Modal title is "Novo Recorte" (H2)
    expect(screen.getAllByText('Novo Recorte')).toHaveLength(2); // One in button, one in modal header
  });
});
