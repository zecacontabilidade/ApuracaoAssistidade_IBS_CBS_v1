import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Suprime animações em jsdom: motion.div e AnimatePresence tornam-se wrappers transparentes,
// permitindo que o conteúdo das abas renderize sincronamente sem depender de requestAnimationFrame.
vi.mock("motion/react", () => ({
  motion: { div: (p: { children?: unknown }) => p.children },
  AnimatePresence: (p: { children?: unknown }) => p.children,
}));

import App from "./App";

describe("App — estado inicial limpo (sem dados mockados)", () => {
  it("campo Razão Social inicia vazio (placeholder visível, value vazio)", () => {
    render(<App />);
    expect(screen.getByPlaceholderText("Ex: Empresa Exemplo Ltda")).toHaveValue("");
  });

  it("campo CNPJ inicia vazio (placeholder visível, value vazio)", () => {
    render(<App />);
    expect(screen.getByPlaceholderText("Ex: 00.000.000/0001-00")).toHaveValue("");
  });

  it("simulador exibe faturamento e compras em R$ 0 ao abrir", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Simulador de Parâmetros"));
    // Os dois displays monetários (totalSales e totalPurchases) devem mostrar "R$ 0"
    const monetaryDisplays = screen.getAllByText("R$ 0");
    expect(monetaryDisplays.length).toBeGreaterThanOrEqual(2);
  });

  it("simulador exibe percentuais de fornecedor/cliente em 0% ao abrir", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Simulador de Parâmetros"));
    // Os dois displays de percentual (purchasesFromSimplesRatio e salesToCompaniesRatio) devem mostrar "0%"
    const percentDisplays = screen.getAllByText("0%");
    expect(percentDisplays.length).toBeGreaterThanOrEqual(2);
  });
});
