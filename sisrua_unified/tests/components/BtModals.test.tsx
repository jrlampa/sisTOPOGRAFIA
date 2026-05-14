import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  NormalRamalModal, 
  ClandestinoToNormalModal, 
  NormalToClandestinoModal,
  ResetBtTopologyModal,
  CriticalActionModal
} from '@/components/BtModals';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('BtModals components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NormalRamalModal', () => {
    const mockModal = {
      poleId: 'p1',
      poleTitle: 'Pole 1',
      ramalType: 'monofasico',
      quantity: 1
    };

    it('renders and allows editing quantity', () => {
      const setModal = vi.fn();
      const onConfirm = vi.fn();
      render(<NormalRamalModal modal={mockModal} setModal={setModal} onConfirm={onConfirm} />);
      
      expect(screen.getByText('Pole 1')).toBeDefined();
      
      const input = screen.getByLabelText(/Quantidade de ramais/i);
      fireEvent.change(input, { target: { value: '5' } });
      
      expect(setModal).toHaveBeenCalledWith(expect.objectContaining({ quantity: 5 }));
    });

    it('calls onConfirm when Add button is clicked', () => {
      const onConfirm = vi.fn();
      render(<NormalRamalModal modal={mockModal} setModal={vi.fn()} onConfirm={onConfirm} />);
      fireEvent.click(screen.getByText('Adicionar'));
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('ClandestinoToNormalModal', () => {
    const mockPoles = [{ poleId: 'p1', poleTitle: 'P1', clandestinoClients: 10 }];

    it('renders pole list and calls actions', () => {
      const onClassifyLater = vi.fn();
      const onConvertNow = vi.fn();
      render(
        <ClandestinoToNormalModal 
          modal={{ poles: mockPoles }} 
          setModal={vi.fn()} 
          onClassifyLater={onClassifyLater} 
          onConvertNow={onConvertNow} 
        />
      );

      expect(screen.getByText('P1')).toBeDefined();
      expect(screen.getByText('10')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /Fazer Depois/i }));
      expect(onClassifyLater).toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /Migrar Agora/i }));
      expect(onConvertNow).toHaveBeenCalled();
    });
  });

  describe('NormalToClandestinoModal', () => {
    it('renders client count and handles actions', () => {
      const onKeep = vi.fn();
      const onZero = vi.fn();
      render(
        <NormalToClandestinoModal 
          modal={{ totalNormalClients: 15 }} 
          setModal={vi.fn()} 
          onKeepClients={onKeep} 
          onZeroNormalClients={onZero} 
        />
      );

      expect(screen.getByText(/Há 15 cliente\(s\) normal\(is\)/i)).toBeDefined();

      fireEvent.click(screen.getByText('Manter Clientes'));
      expect(onKeep).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Zerar Só Normais'));
      expect(onZero).toHaveBeenCalled();
    });
  });

  describe('ResetBtTopologyModal', () => {
    it('renders and handles confirmation', () => {
      const onConfirm = vi.fn();
      render(<ResetBtTopologyModal open={true} onConfirm={onConfirm} onCancel={vi.fn()} />);
      
      expect(screen.getByText(/Zerar topologia BT\?/i)).toBeDefined();
      fireEvent.click(screen.getByText('Zerar'));
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('CriticalActionModal', () => {
    it('renders custom title and message', () => {
      const onConfirm = vi.fn();
      const mockConfig = {
        title: 'Delete everything?',
        message: 'This is final.',
        confirmLabel: 'Yes, delete',
        onConfirm
      };
      render(<CriticalActionModal modal={mockConfig} onClose={vi.fn()} />);
      
      expect(screen.getByText('Delete everything?')).toBeDefined();
      expect(screen.getByText('This is final.')).toBeDefined();
      
      fireEvent.click(screen.getByText('Yes, delete'));
      expect(onConfirm).toHaveBeenCalled();
    });

    it('applies correct tone classes', () => {
      const { rerender } = render(
        <CriticalActionModal 
          modal={{ title: 'T', message: 'M', confirmLabel: 'C', onConfirm: vi.fn(), tone: 'danger' }} 
          onClose={vi.fn()} 
        />
      );
      expect(screen.getByRole('dialog').className).toContain('border-rose-500/30');

      rerender(
        <CriticalActionModal 
          modal={{ title: 'T', message: 'M', confirmLabel: 'C', onConfirm: vi.fn(), tone: 'info' }} 
          onClose={vi.fn()} 
        />
      );
      expect(screen.getByRole('dialog').className).toContain('border-blue-500/30');
    });
  });
});
