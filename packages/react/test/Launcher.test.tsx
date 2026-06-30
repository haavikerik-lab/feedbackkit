import { render, screen, fireEvent } from "@testing-library/react";
import { Launcher } from "../src/components/Launcher";

it("renders a toggle button and fires onToggle on click", () => {
  const onToggle = vi.fn();
  render(<Launcher open={false} onToggle={onToggle} accent="#000" />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});
