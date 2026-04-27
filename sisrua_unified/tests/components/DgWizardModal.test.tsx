/**
 * DgWizardModal.test.tsx — Vitest: teste do wizard DG.
 * Verifica edição de clientes global e individual.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DgWizardModal } from "../../src/components/DgWizardModal";
import type { BtPole } from "../../src/types";

const MOCK_POLES: BtPole[] = [
  { id: "p1", lat: -22.9, lng: -43.1, title: "Poste 1", ramais: [] },
  { id: "p2", lat: -22.91, lng: -43.11, title: "Poste 2", ramais: [{ id: "r1" }, { id: "r2" }] },
];

describe("DgWizardModal", () => {
  it("permite editar clientes globalmente e avançar etapas", () => {
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
    const input = screen.getByLabelText(/clientes por poste/i);
    fireEvent.change(input, { target: { value: "5" } });
    
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    
    // Passo 2: Expansão
    expect(screen.getByText(/área clandestina/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    
    // Passo 3: Técnico
    expect(screen.getByText(/vão máximo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    
    // Passo 4: Revisão
    expect(screen.getByText(/revisão final/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /executar projeto/i }));
    
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({
        clientesPorPoste: 5,
        poleOverrides: {}
    }));
  });

  it("permite expandir e editar clientes individualmente por poste", () => {
    const onExecute = vi.fn();
    render(
      <DgWizardModal 
        isOpen={true} 
        poles={MOCK_POLES} 
        onClose={vi.fn()} 
        onExecute={onExecute} 
      />
    );

    // Abre seção individual
    fireEvent.click(screen.getByText(/ajustar clientes por poste/i));
    
    // Verifica se os inputs individuais aparecem. 
    // Como usamos o mesmo valor padrão se não editado, buscamos o input pelo value ou seletor.
    const inputs = screen.getAllByRole("spinbutton"); 
    // Index 0 é o global, 1 é P1, 2 é P2
    
    fireEvent.change(inputs[1], { target: { value: "10" } }); // P1 = 10
    
    // Avança até o fim
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /executar projeto/i }));
    
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({
        poleOverrides: { "p1": 10 }
    }));
  });
});
