/**
 * Breadcrumb.test.tsx — Testes Vitest para o componente Breadcrumb.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumb } from "../../src/components/Breadcrumb";

function renderAt(
  path: string,
  props: Partial<React.ComponentProps<typeof Breadcrumb>> = {},
) {
  return render(
    React.createElement(
      MemoryRouter,
      { initialEntries: [path] },
      React.createElement(Breadcrumb, props),
    ),
  );
}

describe("Breadcrumb", () => {
  it("renderiza nav com aria-label", () => {
    renderAt("/app");
    expect(
      screen.getByRole("navigation", { name: /trilha de navegação/i }),
    ).toBeInTheDocument();
  });

  it('mostra "Início" como primeiro item em qualquer rota', () => {
    renderAt("/dashboard");
    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it('mostra "Projeto" para /app', () => {
    renderAt("/app");
    expect(screen.getByText("Projeto")).toBeInTheDocument();
  });

  it('mostra "Dashboard" para /dashboard', () => {
    renderAt("/dashboard");
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it('mostra "Admin SaaS" para /saas-admin', () => {
    renderAt("/saas-admin");
    expect(screen.getByText("Admin SaaS")).toBeInTheDocument();
  });

  it('o último segmento tem aria-current="page"', () => {
    renderAt("/app");
    const current = screen.getByText("Projeto");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it('"Início" é um link em rotas internas', () => {
    renderAt("/app");
    const homeLink = screen.getByRole("link", { name: /início/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("o segmento atual não é um link", () => {
    renderAt("/app");
    // "Projeto" deve ser um span, não um link
    const projetoEl = screen.getByText("Projeto");
    expect(projetoEl.tagName).toBe("SPAN");
  });

  it("adiciona subContext como segmento extra não clicável", () => {
    renderAt("/app", { subContext: "Editor BT" });
    expect(screen.getByText("Editor BT")).toBeInTheDocument();
    const subEl = screen.getByText("Editor BT");
    expect(subEl).toHaveAttribute("aria-current", "page");
  });

  it('exibe apenas "Início" na rota "/"', () => {
    renderAt("/");
    expect(screen.getByText("Início")).toBeInTheDocument();
    // Não deve haver segundo segmento
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renderiza corretamente em modo escuro (isDark=true)", () => {
    const { container } = renderAt("/dashboard", { isDark: true });
    // Verifica apenas que renderiza sem erros e contém o nav
    expect(container.querySelector("nav")).toBeTruthy();
  });
});
