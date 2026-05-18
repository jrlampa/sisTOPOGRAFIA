import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DgWizardModal } from "../../src/components/DgWizardModal";
import type { BtPoleNode } from "../../src/types";

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock focus trap
vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// Mock analytics
vi.mock("@/utils/analytics", () => ({
  trackModalAbandonment: vi.fn(),
  trackDgParameterDivergence: vi.fn(),
}));

const MOCK_POLES: BtPoleNode[] = [
  { id: "p1", lat: -22.9, lng: -43.1, title: "Poste 1", ramais: [] },
  { id: "p2", lat: -22.91, lng: -43.11, title: "Poste 2", ramais: [{ id: "r1", quantity: 1 }, { id: "r2", quantity: 1 }] },
];

describe("DgWizardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite navegar por todas as etapas e executar", () => {
    const onExecute = vi.fn();
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={vi.fn()} 
        onExecute={onExecute} 
      />
    );

    // Passo 1: Demanda
    fireEvent.change(screen.getByLabelText(/dgWizard.demanda.labelClientesPorPoste/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /common.next/i }));
    
    // Passo 2: Expansão
    expect(screen.getByText(/dgWizard.expansao.title/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/dgWizard.expansao.labelAreaClandestina/i), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: /common.next/i }));
    
    // Passo 3: Técnico
    expect(screen.getByText(/dgWizard.tecnico.title/i)).toBeInTheDocument();
    // Toggle a trafo option (e.g. 15 kVA)
    fireEvent.click(screen.getByText("15"));
    fireEvent.click(screen.getByRole("button", { name: /common.next/i }));
    
    // Passo 4: Revisão
    expect(screen.getByText(/dgWizard.revisao.title/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /dgWizard.revisao.btnExecute/i }));
    
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({
        clientesPorPoste: 5,
        areaClandestinaM2: 100
    }));
  });

  it("exibe erro de validação para campos inválidos", () => {
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={vi.fn()} 
        onExecute={vi.fn()} 
      />
    );

    const input = screen.getByLabelText(/dgWizard.demanda.labelClientesPorPoste/i);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input); // Touch field
    
    expect(screen.getByText(/dgWizard.validation.minClientes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common.next/i })).toBeDisabled();
  });

  it("permite voltar para a etapa anterior", () => {
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={vi.fn()} 
        onExecute={vi.fn()} 
      />
    );

    // Avança para Expansão
    fireEvent.click(screen.getByRole("button", { name: /common.next/i }));
    expect(screen.getByText(/dgWizard.expansao.title/i)).toBeInTheDocument();

    // Volta para Demanda
    fireEvent.click(screen.getByRole("button", { name: /common.back/i }));
    expect(screen.getByText(/dgWizard.demanda.title/i)).toBeInTheDocument();
  });

  it("chama onClose ao cancelar na primeira etapa", () => {
    const onClose = vi.fn();
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={onClose} 
        onExecute={vi.fn()} 
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /common.cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("chama onClose ao clicar no botão X", () => {
    const onClose = vi.fn();
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={onClose} 
        onExecute={vi.fn()} 
      />
    );

    fireEvent.click(screen.getByTitle(/common.close/i));
    expect(onClose).toHaveBeenCalled();
  });
});

