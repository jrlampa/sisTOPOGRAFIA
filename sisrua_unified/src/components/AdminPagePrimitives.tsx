/**
 * AdminPagePrimitives.tsx — Componentes primitivos para o painel administrativo.
 *
 * Stub temporário para componentes reutilizáveis do AdminPage.
 */
import React from 'react';

interface PainelCardProps {
  children?: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  [key: string]: any;
}

export const PainelCard: React.FC<PainelCardProps> = ({ children, title, ...props }) => {
  return (
    <div className="p-4 border rounded-md" {...props}>
      {title && <h3 className="font-semibold mb-2">{title}</h3>}
      {children}
    </div>
  );
};
