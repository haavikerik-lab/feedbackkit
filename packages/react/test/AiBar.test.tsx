import { render, screen, fireEvent } from "@testing-library/react";
import { AiBar } from "../src/components/AiBar";

const base = {
  aiStatus: "idle" as const,
  aiError: null,
  canSendToAi: true,
  canDraft: false,
  locale: "no" as const,
  accent: "#f08a5d",
  onSendToAi: () => {},
  onDraft: () => {},
};

it("shows Send til AI but hides Lag utkast until canDraft", () => {
  const { rerender } = render(<AiBar {...base} />);
  expect(screen.getByRole("button", { name: "Send til AI" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lag utkast" })).toBeNull();
  rerender(<AiBar {...base} canDraft />);
  expect(screen.getByRole("button", { name: "Lag utkast" })).toBeTruthy();
});

it("disables buttons while thinking and shows the thinking hint", () => {
  render(<AiBar {...base} canDraft aiStatus="thinking" />);
  expect((screen.getByRole("button", { name: "Send til AI" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Lag utkast" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("AI tenker…")).toBeTruthy();
});

it("disables Send til AI when there is nothing to send", () => {
  render(<AiBar {...base} canSendToAi={false} />);
  expect((screen.getByRole("button", { name: "Send til AI" }) as HTMLButtonElement).disabled).toBe(true);
});

it("shows the error as a status message and fires callbacks", () => {
  const onSendToAi = vi.fn();
  render(<AiBar {...base} aiError="Kunne ikke nå AI-en." onSendToAi={onSendToAi} />);
  expect(screen.getByRole("status").textContent).toBe("Kunne ikke nå AI-en.");
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));
  expect(onSendToAi).toHaveBeenCalledTimes(1);
});
