import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ConfirmationModal } from '../../src/components/ConfirmationModal';

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ConfirmationModal', () => {
    const defaultProps = {
        isOpen: true,
        title: 'Confirm Action',
        message: 'Are you sure?',
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
    };

    it('should render title and message when open', () => {
        render(<ConfirmationModal {...defaultProps} />);
        
        expect(screen.getByText('Confirm Action')).toBeDefined();
        expect(screen.getByText('Are you sure?')).toBeDefined();
    });

    it('should not render anything when closed', () => {
        const { container } = render(<ConfirmationModal {...defaultProps} isOpen={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('should call onConfirm when confirm button is clicked', () => {
        render(<ConfirmationModal {...defaultProps} confirmLabel="Do it" />);
        
        fireEvent.click(screen.getByText('Do it'));
        expect(defaultProps.onConfirm).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
        render(<ConfirmationModal {...defaultProps} cancelLabel="Abort" />);
        
        fireEvent.click(screen.getByText('Abort'));
        expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should apply correct styles for "danger" variant', () => {
        render(<ConfirmationModal {...defaultProps} variant="danger" />);
        const confirmButton = screen.getByText('Confirmar');
        expect(confirmButton).toHaveClass('bg-rose-600');
    });

    it('should apply correct styles for "warning" variant', () => {
        render(<ConfirmationModal {...defaultProps} variant="warning" />);
        const confirmButton = screen.getByText('Confirmar');
        expect(confirmButton).toHaveClass('bg-amber-600');
    });
});
