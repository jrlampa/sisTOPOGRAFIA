import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { DgWizardModal } from "../../src/components/DgWizardModal";

describe("DgWizardModal", () => {
  it("bloqueia avanço quando a faixa de kVA fica vazia", () => {
    render(
      React.createElement(DgWizardModal, {
        isOpen: true,
        onClose: vi.fn(),
        onExecute: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));

    fireEvent.click(screen.getByRole("button", { name: "15" }));
    fireEvent.click(screen.getByRole("button", { name: "30" }));
    fireEvent.click(screen.getByRole("button", { name: "45" }));
    fireEvent.click(screen.getByRole("button", { name: "75" }));
    fireEvent.click(screen.getByRole("button", { name: "112.5" }));

    expect(
      screen.getByText(/selecione ao menos uma faixa de kva permitida/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximo/i })).toBeDisabled();
  });
});
