import type { CategoryConfig } from "@feedbackkit/core";

export function CategoryPicker({
  categories,
  selected,
  onToggle,
}: {
  categories: CategoryConfig[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {categories.map((c) => (
        <label key={c.code} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={selected.includes(c.code)}
            onChange={() => onToggle(c.code)}
          />
          {c.label}
        </label>
      ))}
    </div>
  );
}
