import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FEEDBACK_POS_STORAGE_KEY,
  parseStoredPosition,
  clampPosition,
  type Point,
} from "@feedbackkit/core";

export function Panel({ accent, children }: { accent: string; children: ReactNode }) {
  const [pos, setPos] = useState<Point>({ x: 24, y: 24 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(FEEDBACK_POS_STORAGE_KEY); } catch {}
    const stored = parseStoredPosition(raw);
    if (stored) {
      const w = ref.current?.offsetWidth ?? 360;
      const h = ref.current?.offsetHeight ?? 480;
      setPos(clampPosition(stored.x, stored.y, w, h, window.innerWidth, window.innerHeight));
    }
  }, []);

  const onDragStart = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = pos;
    const move = (ev: PointerEvent) =>
      setPos({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      setPos((p) => {
        try { localStorage.setItem(FEEDBACK_POS_STORAGE_KEY, JSON.stringify(p)); } catch {}
        return p;
      });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Tilbakemeldingspanel"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 360,
        background: "#fff",
        border: `1px solid ${accent}`,
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        padding: 12,
        zIndex: 2147483000,
      }}
    >
      <div
        role="button"
        aria-label="Flytt panel"
        onPointerDown={onDragStart}
        style={{ height: 14, cursor: "move", marginBottom: 8, background: accent, borderRadius: 4, touchAction: "none" }}
      />
      {children}
    </div>
  );
}
