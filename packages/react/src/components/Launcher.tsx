export function Launcher({
  open,
  onToggle,
  accent,
}: {
  open: boolean;
  onToggle: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "Lukk Tilbakemelding" : "Åpne Tilbakemelding"}
      aria-expanded={open}
      onClick={onToggle}
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        width: 48,
        height: 48,
        borderRadius: 24,
        border: "none",
        background: accent,
        color: "#fff",
        cursor: "pointer",
        zIndex: 2147483000,
      }}
    >
      💬
    </button>
  );
}
