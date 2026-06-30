import { render, screen } from "@testing-library/react";
import { Panel } from "../src/components/Panel";
import { FEEDBACK_POS_STORAGE_KEY } from "@feedbackkit/core";

it("renders children and a drag handle", () => {
  render(<Panel accent="#000">child-content</Panel>);
  expect(screen.getByText("child-content")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Flytt panel" })).toBeTruthy();
});

it("loads a stored position and clamps it into the viewport", () => {
  localStorage.setItem(FEEDBACK_POS_STORAGE_KEY, JSON.stringify({ x: 5, y: 5 }));
  render(<Panel accent="#000">x</Panel>);
  // jsdom offsetWidth/Height are 0; clampPosition keeps margin=16 minimum.
  const panel = screen.getByRole("dialog");
  expect(panel.style.left).toBe("16px");
  expect(panel.style.top).toBe("16px");
  localStorage.clear();
});
