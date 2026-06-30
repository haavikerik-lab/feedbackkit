import { useRef } from "react";
import { render } from "@testing-library/react";
import { useElementPicker } from "../src/useElementPicker";
import type { PickerMode, PickedElement } from "@feedbackkit/core";

function Harness({ mode, onPick }: { mode: PickerMode; onPick: (e: PickedElement) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useElementPicker(mode, onPick, ref, "#f08a5d");
  return (
    <div>
      <div ref={ref} data-fbk>
        <button aria-label="inside">in</button>
      </div>
      <button aria-label="outside">out</button>
    </div>
  );
}

it("picks an outside element in select mode and blocks the click", () => {
  const picks: PickedElement[] = [];
  render(<Harness mode="select" onPick={(e) => picks.push(e)} />);
  const outside = document.querySelector('[aria-label="outside"]') as HTMLElement;
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  outside.dispatchEvent(ev);
  expect(picks).toHaveLength(1);
  expect(picks[0].label).toBe("outside");
  expect(ev.defaultPrevented).toBe(true);
});

it("ignores clicks inside the feedback UI and in browse mode", () => {
  const picks: PickedElement[] = [];
  const { rerender } = render(<Harness mode="select" onPick={(e) => picks.push(e)} />);
  (document.querySelector('[aria-label="inside"]') as HTMLElement).click();
  expect(picks).toHaveLength(0);

  rerender(<Harness mode="browse" onPick={(e) => picks.push(e)} />);
  (document.querySelector('[aria-label="outside"]') as HTMLElement).click();
  expect(picks).toHaveLength(0);
});
