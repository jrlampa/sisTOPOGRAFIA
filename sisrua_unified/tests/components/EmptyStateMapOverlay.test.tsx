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
    expect(screen.getByText("Selecionar no Mapa")).toBeInTheDocument();
    
    // Verifica Microinstrução
    expect(screen.getByText(/Clique no mapa ou pesquise o endereço para iniciar a seleção/i)).toBeInTheDocument();
  });

  it("renderiza o botão de pesquisa como opção secundária", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    expect(screen.getByText("Pesquisar Endereço")).toBeInTheDocument();
  });

  it("chama onMapClickAction ao clicar no CTA principal", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    const cta = screen.getByText("Selecionar no Mapa");
    fireEvent.click(cta);
    expect(defaultProps.onMapClickAction).toHaveBeenCalled();
  });

  it("chama onStartSearch ao clicar no botão de pesquisa", () => {
    render(<EmptyStateMapOverlay {...defaultProps} />);
    const searchBtn = screen.getByText("Pesquisar Endereço");
    fireEvent.click(searchBtn);
    expect(defaultProps.onStartSearch).toHaveBeenCalled();
  });

  it("respeita o idioma pt-BR", () => {
    render(<EmptyStateMapOverlay {...defaultProps} locale="pt-BR" />);
    expect(screen.getByText("Guia de Inicialização")).toBeInTheDocument();
  });

  it("respeita o idioma en-US", () => {
    render(<EmptyStateMapOverlay {...defaultProps} locale="en-US" />);
    expect(screen.getByText("Getting Started Guide")).toBeInTheDocument();
    expect(screen.getByText("1. Import KML")).toBeInTheDocument();
  });
});
