import { useEffect } from "react";
import type { RefObject } from "react";
import { shouldInterceptClick, type PickerMode, type PickedElement } from "@feedbackkit/core";
import { describeElement } from "./describeElement";

export function useElementPicker(
  mode: PickerMode,
  onPick: (el: PickedElement) => void,
  rootRef: RefObject<HTMLElement | null>,
  accent: string,
): void {
  useEffect(() => {
    if (mode === "browse") return;
    let hovered: HTMLElement | null = null;
    let prevOutline = "";
    const isInside = (t: Element | null) =>
      !!(t && rootRef.current && rootRef.current.contains(t));

    const restore = () => {
      if (hovered) {
        hovered.style.outline = prevOutline;
        hovered = null;
      }
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || isInside(t)) return;
      restore();
      hovered = t;
      prevOutline = t.style.outline;
      t.style.outline = `2px solid ${accent}`;
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (!shouldInterceptClick(mode, isInside(t), e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      e.stopPropagation();
      onPick(describeElement(t));
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", restore, true);
    document.addEventListener("click", onClick, true);
    return () => {
      restore();
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", restore, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [mode, onPick, rootRef, accent]);
}
