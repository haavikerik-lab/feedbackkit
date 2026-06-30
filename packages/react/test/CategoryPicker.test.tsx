import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryPicker } from "../src/components/CategoryPicker";

const categories = [
  { code: "bug", label: "Feil" },
  { code: "idea", label: "Idé" },
];

it("renders a checkbox per category, reflects selection, and toggles", () => {
  const onToggle = vi.fn();
  render(<CategoryPicker categories={categories} selected={["bug"]} onToggle={onToggle} />);
  const bug = screen.getByLabelText("Feil") as HTMLInputElement;
  const idea = screen.getByLabelText("Idé") as HTMLInputElement;
  expect(bug.checked).toBe(true);
  expect(idea.checked).toBe(false);
  fireEvent.click(idea);
  expect(onToggle).toHaveBeenCalledWith("idea");
});
