import type { PickedElement } from "@feedbackkit/core";

const LABEL_CAP = 60;
const TEXT_CAP = 200;

export function describeElement(el: Element): PickedElement {
  const aria = el.getAttribute("aria-label");
  const role = el.getAttribute("role");
  const label = (aria || role || el.tagName.toLowerCase()).slice(0, LABEL_CAP);
  const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, TEXT_CAP);
  return { label, text };
}
