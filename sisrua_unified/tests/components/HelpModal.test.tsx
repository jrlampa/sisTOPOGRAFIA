import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HelpModal } from "../../src/components/HelpModal";

describe("HelpModal", () => {
  it("renderiza conteúdo de onboarding e atalhos", () => {
    render(<HelpModal isOpen locale="pt-BR" onClose={vi.fn()} />);

    expect(
      screen.getByText("Central de Ajuda e Onboarding"),
    ).toBeInTheDocument();
    expect(screen.getByText("Teclas de Atalho")).toBeInTheDocument();
    expect(screen.getByText("Passo a Passo Recomendado")).toBeInTheDocument();
    expect(screen.getAllByText("Abrir ajuda rápida").length).toBeGreaterThan(0);
    expect(screen.getByText("1. Defina área e contexto")).toBeInTheDocument();
  });

  it("fecha quando usuário clica em fechar", () => {
    const onClose = vi.fn();
    render(<HelpModal isOpen locale="en-US" onClose={onClose} />);

    const closeButtons = screen.getAllByRole("button", { name: "Close help" });
    fireEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não renderiza quando fechado", () => {
    render(<HelpModal isOpen={false} locale="es-ES" onClose={vi.fn()} />);

    expect(
      screen.queryByText("Centro de Ayuda y Onboarding"),
    ).not.toBeInTheDocument();
  });
});
