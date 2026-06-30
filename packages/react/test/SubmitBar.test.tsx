import { render, screen, fireEvent } from "@testing-library/react";
import { SubmitBar } from "../src/components/SubmitBar";

it("labels the button by status and disables while sending", () => {
  const { rerender } = render(<SubmitBar status="idle" onSend={() => {}} locale="no" />);
  expect(screen.getByRole("button").textContent).toBe("Send");
  rerender(<SubmitBar status="sending" onSend={() => {}} locale="no" />);
  expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  rerender(<SubmitBar status="sent" onSend={() => {}} locale="no" />);
  expect(screen.getByRole("button").textContent).toBe("Sendt ✓");
});

it("fires onSend when clicked", () => {
  const onSend = vi.fn();
  render(<SubmitBar status="idle" onSend={onSend} locale="no" />);
  fireEvent.click(screen.getByRole("button"));
  expect(onSend).toHaveBeenCalledTimes(1);
});
