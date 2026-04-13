import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { Skeleton, SidebarSkeleton, MapSkeleton } from '../../src/components/Skeleton';

describe('Skeleton Components', () => {
    describe('Skeleton', () => {
        it('renders with default variant', () => {
            const { container } = render(<Skeleton />);
            const div = container.firstChild as HTMLElement;
            expect(div).toHaveClass('rounded-xl'); // rect
            expect(div).toHaveClass('animate-pulse');
            expect(div).toHaveAttribute('aria-hidden', 'true');
        });

        it('renders circle variant', () => {
            const { container } = render(<Skeleton variant="circle" />);
            const div = container.firstChild as HTMLElement;
            expect(div).toHaveClass('rounded-full');
        });

        it('renders text variant', () => {
            const { container } = render(<Skeleton variant="text" />);
            const div = container.firstChild as HTMLElement;
            expect(div).toHaveClass('h-3');
        });

        it('applies custom className', () => {
            const { container } = render(<Skeleton className="custom-test" />);
            expect(container.firstChild).toHaveClass('custom-test');
        });
    });

    describe('SidebarSkeleton', () => {
        it('renders without crashing', () => {
            const { container } = render(<SidebarSkeleton />);
            expect(container.firstChild).toBeDefined();
            expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
        });
    });

    describe('MapSkeleton', () => {
        it('renders with loading indicator', () => {
            const { container } = render(<MapSkeleton />);
            expect(container.querySelector('.animate-spin')).toBeDefined();
            expect(container).toHaveTextContent(''); // Should be empty/hidden for SR
        });
    });
});
