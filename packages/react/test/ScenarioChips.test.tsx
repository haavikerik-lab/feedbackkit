import { render, screen, fireEvent } from "@testing-library/react";
import { ScenarioChips } from "../src/components/ScenarioChips";

const scenarios = [
  { id: "cv", title: "Lag en CV", prompt: "..." },
  { id: "job", title: "Finn jobb", prompt: "..." },
];

it("renders a chip per scenario and fires onSelect", () => {
  const onSelect = vi.fn();
  render(<ScenarioChips scenarios={scenarios} selectedId={null} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: "Lag en CV" }));
  expect(onSelect).toHaveBeenCalledWith(scenarios[0]);
});

it("renders nothing when there are no scenarios", () => {
  const { container } = render(<ScenarioChips scenarios={[]} selectedId={null} onSelect={() => {}} />);
  expect(container.firstChild).toBeNull();
});
