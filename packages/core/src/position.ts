export const FEEDBACK_POS_STORAGE_KEY = "feedbackkit:pos";

export type Point = { x: number; y: number };

/**
 * Clamp a fixed panel's top-left so the whole panel stays within the viewport,
 * keeping `margin` px clear on every edge. If the panel is larger than the
 * viewport on an axis, the upper bound goes below the lower bound; we let the
 * lower bound (margin) win via Math.max(min, Math.min(max, v)) ordering so the
 * panel anchors to the top/left margin instead of drifting off-screen.
 */
export function clampPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number,
  margin = 16,
): Point {
  const clamp = (v: number, size: number, viewport: number) =>
    Math.max(margin, Math.min(v, viewport - size - margin));
  return { x: clamp(x, w, vw), y: clamp(y, h, vh) };
}

/** Parse a stored JSON point; null/invalid/non-finite input → null. */
export function parseStoredPosition(raw: string | null): Point | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === "object" &&
      v !== null &&
      Number.isFinite((v as Point).x) &&
      Number.isFinite((v as Point).y)
    ) {
      return { x: (v as Point).x, y: (v as Point).y };
    }
  } catch {
    // fall through
  }
  return null;
}
