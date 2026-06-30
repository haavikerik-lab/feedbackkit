import { render, screen } from "@testing-library/react";

function Hello() {
  return <p>feedbackkit</p>;
}

it("renders React in jsdom", () => {
  render(<Hello />);
  expect(screen.getByText("feedbackkit")).toBeTruthy();
});
