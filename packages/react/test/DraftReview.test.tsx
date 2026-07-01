import { render, screen, fireEvent } from "@testing-library/react";
import { DraftReview } from "../src/components/DraftReview";

it("renders the draft as an editable field and fires onChange", () => {
  const onChange = vi.fn();
  render(
    <DraftReview draft="Første utkast" locale="no" accent="#f08a5d" onChange={onChange} onBack={() => {}} />,
  );
  const ta = screen.getByLabelText("Utkast") as HTMLTextAreaElement;
  expect(ta.value).toBe("Første utkast");
  fireEvent.change(ta, { target: { value: "Redigert" } });
  expect(onChange).toHaveBeenCalledWith("Redigert");
});

it("fires onBack from the back button", () => {
  const onBack = vi.fn();
  render(<DraftReview draft="x" locale="no" accent="#f08a5d" onChange={() => {}} onBack={onBack} />);
  fireEvent.click(screen.getByRole("button", { name: "Tilbake til chat" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
