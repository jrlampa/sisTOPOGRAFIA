import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { EmptyStateMapOverlay } from "../../src/components/EmptyStateMapOverlay";

describe("EmptyStateMapOverlay", () => {
  const defaultProps = {
    locale: "pt-BR" as const,
    onStartSearch: vi.fn(),
    onMapClickAction: vi.fn(),
  };

  it("renderiza o CTA principal e a microinstrução (UX-02)", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    
    // Verifica CTA Principal
    expect(screen.getByText("INICIAR PROJETO")).toBeInTheDocument();
    
    // Verifica Microinstrução
    expect(screen.getByText(/Clique em qualquer lugar do mapa ou pesquise um endereço/i)).toBeInTheDocument();
  });

  it("renderiza o botão de pesquisa como opção secundária", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    expect(screen.getByText("Pesquisar endereço")).toBeInTheDocument();
  });

  it("chama onMapClickAction ao clicar no CTA principal", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    const cta = screen.getByText("INICIAR PROJETO");
    fireEvent.click(cta);
    expect(defaultProps.onMapClickAction).toHaveBeenCalled();
  });

  it("chama onStartSearch ao clicar no botão de pesquisa", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    const searchBtn = screen.getByText("Pesquisar endereço");
    fireEvent.click(searchBtn);
    expect(defaultProps.onStartSearch).toHaveBeenCalled();
  });

  it("respeita o idioma pt-BR", () => {
    render(<EmptyStateMapOverlay {...defaultProps} locale="pt-BR" />);
    expect(screen.getByText("Pronto para começar?")).toBeInTheDocument();
  });

  it("respeita o idioma en-US", () => {
    render(<EmptyStateMapOverlay {...defaultProps} locale="en-US" />);
    expect(screen.getByText("Ready to start?")).toBeInTheDocument();
    expect(screen.getByText("START PROJECT")).toBeInTheDocument();
  });
});
