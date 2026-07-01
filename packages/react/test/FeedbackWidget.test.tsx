import { render, screen, fireEvent } from "@testing-library/react";
import { FeedbackWidget } from "../src/FeedbackWidget";
import type { FeedbackCaseInput, AssistRequest, AssistResult } from "@feedbackkit/core";

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

it("shows no AI controls when assist is not configured", () => {
  render(<FeedbackWidget submit={{ onCase: () => {} }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  expect(screen.queryByRole("button", { name: "Send til AI" })).toBeNull();
});

it("runs the AI interview: chat → categories → draft → edit → send", async () => {
  const cases: FeedbackCaseInput[] = [];
  const onAssist = vi.fn(
    async (req: AssistRequest): Promise<AssistResult> =>
      req.mode === "chat"
        ? { reply: "Hvilken side?", categories: ["bug", "nonsense"] } // "nonsense" må filtreres bort
        : { draft: "Knappen er ødelagt på forsiden." },
  );
  render(
    <FeedbackWidget
      submit={{ onCase: (c) => { cases.push(c); } }}
      assist={{ onAssist }}
      categories={[{ code: "bug", label: "Feil" }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));      // open
  fireEvent.click(screen.getByRole("button", { name: "Velg" }));                // select mode
  document.body.appendChild(
    Object.assign(document.createElement("button"), { textContent: "Kjøp", ariaLabel: "Kjøp-knapp" }),
  );
  fireEvent.click(document.querySelector('[aria-label="Kjøp-knapp"]') as HTMLElement); // point
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "funker ikke" } });
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));

  await screen.findByText("Hvilken side?");
  expect((screen.getByLabelText("Feil") as HTMLInputElement).checked).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Lag utkast" }));
  const ta = (await screen.findByLabelText("Utkast")) as HTMLTextAreaElement;
  expect(ta.value).toBe("Knappen er ødelagt på forsiden.");
  fireEvent.change(ta, { target: { value: "Kjøp-knappen er ødelagt." } });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Sendt ✓" });

  expect(cases).toHaveLength(1);
  const c = cases[0];
  expect(c.message).toBe("Kjøp-knappen er ødelagt.");
  expect(c.elements).toEqual([{ label: "Kjøp-knapp", text: "Kjøp" }]);
  expect(c.categories).toEqual(["bug"]);
  const chatReq = onAssist.mock.calls[0][0];
  expect(chatReq.mode).toBe("chat");
  expect(chatReq.elements).toEqual([{ label: "Kjøp-knapp", text: "Kjøp" }]);
  expect(chatReq.messages).toHaveLength(1);
  expect(chatReq.messages[0].role).toBe("user");
  expect(chatReq.messages[0].content).toContain("Kjøp-knapp");
  expect(chatReq.messages[0].content).toContain("funker ikke");
});

it("degrades to manual send when the AI call fails", async () => {
  const cases: FeedbackCaseInput[] = [];
  const onAssist = vi.fn(async (): Promise<AssistResult> => { throw new Error("down"); });
  render(<FeedbackWidget submit={{ onCase: (c) => { cases.push(c); } }} assist={{ onAssist }} />);
  fireEvent.click(screen.getByRole("button", { name: /Tilbakemelding/ }));
  fireEvent.change(screen.getByLabelText("Tilbakemelding"), { target: { value: "noe er galt" } });
  fireEvent.click(screen.getByRole("button", { name: "Send til AI" }));

  await screen.findByRole("status");
  expect((screen.getByLabelText("Tilbakemelding") as HTMLTextAreaElement).value).toBe("noe er galt");

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Sendt ✓" });
  expect(cases).toHaveLength(1);
  expect(cases[0].message).toBe("noe er galt");
});
