import { render, screen, fireEvent } from "@testing-library/react";
import { Composer } from "../src/components/Composer";
import type { ComposerSegment } from "@feedbackkit/core";

const segs: ComposerSegment[] = [
  { type: "text", text: "denne " },
  { type: "element", element: { label: "Last ned", text: "knapp" } },
];

it("renders committed text and an element chip, with an empty trailing textarea", () => {
  render(<Composer segments={segs} onText={() => {}} onRemove={() => {}} accent="#000" />);
  expect(screen.getByText("denne")).toBeTruthy();
  expect(screen.getByText(/Last ned/)).toBeTruthy();
  expect((screen.getByLabelText("Tilbakemelding") as HTMLTextAreaElement).value).toBe("");
});

it("typing fires onText and removing a chip fires onRemove with its index", () => {
  const onText = vi.fn();
  const onRemove = vi.fn();
  render(<Composer segments={segs} onText={onText} onRemove={onRemove} accent="#000" />);
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "hei" } });
  expect(onText).toHaveBeenCalledWith("hei");
  fireEvent.click(screen.getByRole("button", { name: /Fjern Last ned/ }));
  expect(onRemove).toHaveBeenCalledWith(1);
});
