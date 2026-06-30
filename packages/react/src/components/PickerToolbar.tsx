import type { PickerMode } from "@feedbackkit/core";

const MODES: { mode: PickerMode; label: string }[] = [
  { mode: "select", label: "Velg" },
  { mode: "multi", label: "Flervalg" },
  { mode: "browse", label: "Bla" },
];

export function PickerToolbar({
  mode,
  onMode,
}: {
  mode: PickerMode;
  onMode: (m: PickerMode) => void;
}) {
  return (
    <div role="group" aria-label="Pekemodus" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          aria-pressed={mode === m.mode}
          onClick={() => onMode(m.mode)}
          style={{ padding: "2px 10px", cursor: "pointer" }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
