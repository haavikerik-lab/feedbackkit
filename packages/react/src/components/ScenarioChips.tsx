import type { Scenario } from "@feedbackkit/core";

export function ScenarioChips({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (s: Scenario) => void;
}) {
  if (!scenarios.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {scenarios.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={selectedId === s.id}
          onClick={() => onSelect(s)}
          style={{ borderRadius: 12, padding: "2px 10px", cursor: "pointer" }}
        >
          {s.title}
        </button>
      ))}
    </div>
  );
}
