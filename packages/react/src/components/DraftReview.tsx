const LABELS = {
  no: { label: "Utkast", back: "Tilbake til chat" },
  en: { label: "Draft", back: "Back to chat" },
} as const;

export function DraftReview({
  draft,
  locale,
  accent,
  onChange,
  onBack,
}: {
  draft: string;
  locale: "no" | "en";
  accent: string;
  onChange: (text: string) => void;
  onBack: () => void;
}) {
  const t = LABELS[locale];
  return (
    <div>
      <textarea
        aria-label={t.label}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: 6,
          border: `1px solid ${accent}`,
          borderRadius: 6,
          padding: "2px 8px",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        {t.back}
      </button>
    </div>
  );
}
