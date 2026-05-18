import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BtPoleVerificationSection from '@/components/BtTopologyPanel/BtPoleVerificationSection';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BtPoleVerificationSection component', () => {
  const mockPoles = [
    { id: 'p1', title: 'Pole 1', verified: false, ramais: [] },
    { id: 'p2', title: 'Pole 2', verified: true, ramais: [{ id: 'r1', quantity: 1, ramalType: 'monofasico' }] }
  ];

  const defaultProps: any = {
    locale: 'pt-BR',
    btTopology: { poles: mockPoles, transformers: [], edges: [] },
    projectType: 'ramais',
    selectedPoleId: 'p1',
    selectedPole: mockPoles[0],
    isPoleDropdownOpen: false,
    setIsPoleDropdownOpen: vi.fn(),
    selectPole: vi.fn(),
    onBtRenamePole: vi.fn(),
    updatePoleVerified: vi.fn(),
    updatePoleRamais: vi.fn(),
    updatePoleSpec: vi.fn(),
    updatePoleBtStructures: vi.fn(),
    updatePoleConditionStatus: vi.fn(),
    updatePoleEquipmentNotes: vi.fn(),
    updatePoleGeneralNotes: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with selected pole', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    expect(screen.getByText(/Postes \/ Verificação/i)).toBeDefined();
    expect(screen.getByDisplayValue('Pole 1')).toBeDefined();
  });

  it('toggles pole verified status', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    const verifyBtn = screen.getByText(/Marcar poste como verificado/i);
    fireEvent.click(verifyBtn);
    expect(defaultProps.updatePoleVerified).toHaveBeenCalledWith('p1', true);
  });

  it('renames pole', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    const input = screen.getByDisplayValue('Pole 1');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(defaultProps.onBtRenamePole).toHaveBeenCalledWith('p1', 'New Name');
  });

  it('opens dropdown and selects another pole', () => {
    const { rerender } = render(<BtPoleVerificationSection {...defaultProps} isPoleDropdownOpen={true} />);
    
    // Dropdown contains all poles
    const poleButtons = screen.getAllByRole('button');
    const pole2Btn = poleButtons.find(b => b.textContent === 'Pole 2');
    if (pole2Btn) fireEvent.click(pole2Btn);
    expect(defaultProps.selectPole).toHaveBeenCalledWith('p2');
  });

  it('updates pole spec (height and effort)', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    
    const heightInput = screen.getByPlaceholderText(/ex: 11/i);
    fireEvent.change(heightInput, { target: { value: '12' } });
    expect(defaultProps.updatePoleSpec).toHaveBeenCalledWith('p1', expect.objectContaining({ heightM: 12 }));

    const effortInput = screen.getByPlaceholderText(/ex: 400/i);
    fireEvent.change(effortInput, { target: { value: '600' } });
    expect(defaultProps.updatePoleSpec).toHaveBeenCalledWith('p1', expect.objectContaining({ nominalEffortDan: 600 }));
  });

  it('adds a new ramal', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    const addBtn = screen.getByText(/Ramal/i);
    fireEvent.click(addBtn);
    expect(defaultProps.updatePoleRamais).toHaveBeenCalled();
  });

  it('removes a ramal', () => {
    const propsWithRamal = { ...defaultProps, selectedPoleId: 'p2', selectedPole: mockPoles[1] };
    render(<BtPoleVerificationSection {...propsWithRamal} />);
    
    const removeBtn = screen.getByTitle(/Remover ramal/i);
    fireEvent.click(removeBtn);
    expect(defaultProps.updatePoleRamais).toHaveBeenCalledWith('p2', []);
  });

  it('updates ramal quantity and type', () => {
    const propsWithRamal = { ...defaultProps, selectedPoleId: 'p2', selectedPole: mockPoles[1] };
    render(<BtPoleVerificationSection {...propsWithRamal} />);
    
    const qtyInput = screen.getByTitle(/Quantidade do ramal/i);
    fireEvent.change(qtyInput, { target: { value: '3' } });
    // Should have been called with quantity 3
    expect(defaultProps.updatePoleRamais).toHaveBeenCalledWith('p2', expect.arrayContaining([expect.objectContaining({ quantity: 3 })]));

    const typeSelect = screen.getByTitle(/Tipo do ramal/i);
    fireEvent.change(typeSelect, { target: { value: '13 TX 6 AWG' } });
    expect(defaultProps.updatePoleRamais).toHaveBeenLastCalledWith('p2', expect.arrayContaining([expect.objectContaining({ ramalType: '13 TX 6 AWG' })]));
  });

  it('applies quick notes to ramal', () => {
    const propsWithRamal = { ...defaultProps, selectedPoleId: 'p2', selectedPole: mockPoles[1] };
    render(<BtPoleVerificationSection {...propsWithRamal} />);
    
    const noteBtn = screen.getByText(/Deteriorado/i);
    fireEvent.click(noteBtn);
    expect(defaultProps.updatePoleRamais).toHaveBeenCalledWith('p2', expect.arrayContaining([expect.objectContaining({ notes: 'Deteriorado' })]));
  });

  it('updates condition status', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    const statusSelect = screen.getByTitle(/Estado físico do poste/i);
    fireEvent.change(statusSelect, { target: { value: 'desaprumado' } });
    expect(defaultProps.updatePoleConditionStatus).toHaveBeenCalledWith('p1', 'desaprumado');
  });

  it('updates notes', () => {
    render(<BtPoleVerificationSection {...defaultProps} />);
    
    const equipNotes = screen.getByPlaceholderText(/chave fusível/i);
    fireEvent.change(equipNotes, { target: { value: 'Trafo 75kVA' } });
    expect(defaultProps.updatePoleEquipmentNotes).toHaveBeenCalledWith('p1', 'Trafo 75kVA');

    const genNotes = screen.getByPlaceholderText(/acesso restrito/i);
    fireEvent.change(genNotes, { target: { value: 'Terreno inclinado' } });
    expect(defaultProps.updatePoleGeneralNotes).toHaveBeenCalledWith('p1', 'Terreno inclinado');
  });
});
