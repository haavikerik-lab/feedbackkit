import { render, screen, fireEvent } from "@testing-library/react";
import { PickerToolbar } from "../src/components/PickerToolbar";

it("renders the three modes, marks the active one, and fires onMode", () => {
  const onMode = vi.fn();
  render(<PickerToolbar mode="select" onMode={onMode} />);
  expect((screen.getByRole("button", { name: "Velg" })).getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByRole("button", { name: "Bla" })).getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Flervalg" }));
  expect(onMode).toHaveBeenCalledWith("multi");
});
