import { describeElement } from "../src/describeElement";

function el(html: string): Element {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild as Element;
}

it("prefers aria-label, then role, then tag name for the label", () => {
  expect(describeElement(el(`<button aria-label="Last ned">x</button>`)).label).toBe("Last ned");
  expect(describeElement(el(`<div role="dialog">x</div>`)).label).toBe("dialog");
  expect(describeElement(el(`<section>x</section>`)).label).toBe("section");
});

it("captures trimmed, whitespace-collapsed text capped at 200 chars", () => {
  const r = describeElement(el(`<p>  hello   world  </p>`));
  expect(r.text).toBe("hello world");
  const long = "z".repeat(250);
  expect(describeElement(el(`<p>${long}</p>`)).text.length).toBe(200);
});

it("caps the label at 60 chars and falls through an empty aria-label to the tag", () => {
  expect(describeElement(el(`<button aria-label="${"a".repeat(80)}">x</button>`)).label.length).toBe(60);
  expect(describeElement(el(`<button aria-label="">hi</button>`)).label).toBe("button");
});
