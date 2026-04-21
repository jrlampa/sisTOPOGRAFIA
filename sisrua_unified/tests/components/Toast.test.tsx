/**
 * Toast.test.tsx — Vitest tests for the Toast component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import Toast from "../../src/components/Toast";

// framer-motion is mocked in tests/setup.ts via __mocks__/framer-motion.tsx
// If not, mock it here so animations don't block assertions
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
    button: ({
      children,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      children?: React.ReactNode;
    }) => React.createElement("button", props, children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza a mensagem corretamente", () => {
    render(
      <Toast message="Operação concluída" type="success" onClose={vi.fn()} />,
    );
    expect(screen.getByText("Operação concluída")).toBeInTheDocument();
  });

  it('tem role="alert" e aria-live="polite" para acessibilidade', () => {
    render(<Toast message="msg" type="info" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "polite");
  });

  it("chama onClose ao clicar no botão fechar", () => {
    const onClose = vi.fn();
    render(<Toast message="msg" type="warning" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Fechar notificação"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("chama onClose automaticamente após duration ms", () => {
    const onClose = vi.fn();
    render(
      <Toast
        message="auto-close"
        type="success"
        onClose={onClose}
        duration={3000}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("usa duration padrão de 4000ms quando não fornecido", () => {
    const onClose = vi.fn();
    render(<Toast message="default duration" type="info" onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([["success"], ["error"], ["info"], ["warning"], ["alert"]] as const)(
    "renderiza sem errors para type=%s",
    (type) => {
      expect(() =>
        render(<Toast message="teste" type={type} onClose={vi.fn()} />),
      ).not.toThrow();
    },
  );

  it("limpa o timer ao desmontar", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Toast message="msg" type="success" onClose={onClose} duration={5000} />,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000); // timer já cancelado
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
