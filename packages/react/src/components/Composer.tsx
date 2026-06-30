import type { ComposerSegment } from "@feedbackkit/core";

export function Composer({
  segments,
  onText,
  onRemove,
  accent,
}: {
  segments: ComposerSegment[];
  onText: (text: string) => void;
  onRemove: (index: number) => void;
  accent: string;
}) {
  const last = segments[segments.length - 1];
  const trailingIsText = !!last && last.type === "text";
  const head = trailingIsText ? segments.slice(0, -1) : segments;
  const trailingText = trailingIsText ? (last as { type: "text"; text: string }).text : "";

  return (
    <div>
      <div style={{ marginBottom: 6, lineHeight: 1.6 }}>
        {head.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              aria-label={`Fjern ${seg.element.label}`}
              onClick={() => onRemove(i)}
              style={{
                border: `1px solid ${accent}`,
                borderRadius: 12,
                padding: "1px 8px",
                margin: "0 2px",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              «{seg.element.label}» ×
            </button>
          ),
        )}
      </div>
      <textarea
        aria-label="Tilbakemelding"
        value={trailingText}
        onChange={(e) => onText(e.target.value)}
        rows={3}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
    </div>
  );
}
