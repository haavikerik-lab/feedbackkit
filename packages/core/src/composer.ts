export type PickedElement = { label: string; text: string };

// Single-char placeholder for an inline element reference in a stored message.
// U+FFFC OBJECT REPLACEMENT CHARACTER — does not collide with normal typed text.
export const ELEMENT_MARKER = "￼";

export type ComposerSegment =
  | { type: "text"; text: string }
  | { type: "element"; element: PickedElement };

/** Collapse ordered composer segments into the stored form: text with one
 *  ELEMENT_MARKER per element, plus the elements in order. */
export function serialize(segments: ComposerSegment[]): {
  content: string;
  elements: PickedElement[];
} {
  let content = "";
  const elements: PickedElement[] = [];
  for (const seg of segments) {
    if (seg.type === "text") content += seg.text;
    else {
      content += ELEMENT_MARKER;
      elements.push(seg.element);
    }
  }
  return { content, elements };
}

/** Inverse of serialize: split stored content on the marker and interleave the
 *  elements in order, for rendering the transcript. A marker with no matching
 *  element (defensive) is dropped. */
export function parseContent(
  content: string,
  elements: PickedElement[] = [],
): ComposerSegment[] {
  const out: ComposerSegment[] = [];
  let idx = 0;
  let buf = "";
  for (const ch of content) {
    if (ch === ELEMENT_MARKER) {
      if (buf) {
        out.push({ type: "text", text: buf });
        buf = "";
      }
      const element = elements[idx++];
      if (element) out.push({ type: "element", element });
    } else {
      buf += ch;
    }
  }
  if (buf) out.push({ type: "text", text: buf });
  return out;
}

/** Plain text Claude reads: each marker → «label» at its position, preserving the
 *  user's order ("denne knappen («Last ned PDF») …"). */
export function toApiContent(
  content: string,
  elements: PickedElement[] = [],
): string {
  let idx = 0;
  let out = "";
  for (const ch of content) {
    if (ch === ELEMENT_MARKER) {
      const element = elements[idx++];
      out += element ? `«${element.label}»` : "";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Deduplicate elements by label+text, preserving first-seen order, capped — the
 *  referenced-element list sent to the model for content context. */
export function dedupeElements(elements: PickedElement[], cap = 10): PickedElement[] {
  const seen = new Set<string>();
  const out: PickedElement[] = [];
  for (const el of elements) {
    const key = `${el.label} ${el.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(el);
    if (out.length >= cap) break;
  }
  return out;
}
