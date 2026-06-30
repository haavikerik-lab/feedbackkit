import { render, screen, fireEvent } from "@testing-library/react";
import { FeedbackWidget } from "../src/FeedbackWidget";
import type { FeedbackCaseInput } from "@feedbackkit/core";

it("stops intercepting host clicks once the panel is closed", () => {
  render(<FeedbackWidget submit={{ onCase: () => {} }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ })); // open
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));            // enter select
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ })); // close
  const host = document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "host", ariaLabel: "host-el" }),
  );
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  host.dispatchEvent(ev);
  expect(ev.defaultPrevented).toBe(false);
});

it("runs the full point+write+category+send flow and builds a FeedbackCaseInput", async () => {
  const cases: FeedbackCaseInput[] = [];
  render(
    <FeedbackWidget
      submit={{ onCase: (c) => { cases.push(c); } }}
      scenarios={[{ id: "cv", title: "Lag en CV", prompt: "..." }]}
      categories={[{ code: "bug", label: "Feil" }]}
    />,
  );

  // open
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  // select a scenario
  fireEvent.click(screen.getByRole("button", { name: "Lag en CV" }));
  // enter select mode and point at an outside element
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));
  document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "Del", ariaLabel: "Del feed" }),
  );
  fireEvent.click(document.querySelector('[aria-label="Del feed"]') as HTMLElement);
  // write text
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "for mye" } });
  // tag a category
  fireEvent.click(screen.getByLabelText("Feil"));
  // send
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await screen.findByRole("button", { name: "Sendt ✓" });
  expect(cases).toHaveLength(1);
  const c = cases[0];
  expect(c.message).toContain("«Del feed»");
  expect(c.message).toContain("for mye");
  expect(c.elements).toEqual([{ label: "Del feed", text: "Del" }]);
  expect(c.categories).toEqual(["bug"]);
  expect(c.scenario).toEqual({ id: "cv", title: "Lag en CV" });
  expect(c.page).toBe(window.location.pathname);
});
