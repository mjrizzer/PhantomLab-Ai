import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import App from "./App";
vi.mock("./offline", () => ({
  cached: vi.fn(async () => undefined),
  cache: vi.fn(async () => {}),
  cacheLaboratory: vi.fn(async () => {}),
  sync: vi.fn(async () => {}),
  saveNote: vi.fn(async () => {}),
  request: vi.fn(async () => {
    throw Error("Backend disconnected");
  }),
  local: { operations: { count: vi.fn(async () => 0) } },
}));
afterEach(() => {
  cleanup();
  location.hash = "";
});
describe("offline laboratory shell", () => {
  it("offers a saved draft instead of executing tests when the backend is disconnected", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /Begin a New Experiment/ }),
    );
    expect(
      screen.getByRole("button", { name: "Save offline draft" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save offline draft" }));
    expect(await screen.findByText(/Plan saved on this device/)).toBeTruthy();
  });
  it("exposes every room from an accessible navigation index", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "All laboratory rooms" }),
    );
    for (const label of [
      "Product Registry",
      "Persona Theatre",
      "Collision Atlas",
      "Risk Atelier",
      "Local Services",
    ])
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).toBeTruthy();
  });
});
