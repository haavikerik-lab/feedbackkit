import type { AiStatus } from "../session";

const LABELS = {
  no: { send: "Send til AI", draft: "Lag utkast", thinking: "AI tenker…" },
  en: { send: "Ask AI", draft: "Draft it", thinking: "AI thinking…" },
} as const;

export function AiBar({
  aiStatus,
  aiError,
  canSendToAi,
  canDraft,
  locale,
  accent,
  onSendToAi,
  onDraft,
}: {
  aiStatus: AiStatus;
  aiError: string | null;
  canSendToAi: boolean;
  canDraft: boolean;
  locale: "no" | "en";
  accent: string;
  onSendToAi: () => void;
  onDraft: () => void;
}) {
  const t = LABELS[locale];
  const thinking = aiStatus === "thinking";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
      <button
        type="button"
        onClick={onSendToAi}
        disabled={thinking || !canSendToAi}
        style={{
          border: `1px solid ${accent}`,
          borderRadius: 6,
          padding: "4px 10px",
          background: "transparent",
          cursor: thinking || !canSendToAi ? "not-allowed" : "pointer",
        }}
      >
        {t.send}
      </button>
      {canDraft && (
        <button
          type="button"
          onClick={onDraft}
          disabled={thinking}
          style={{
            border: "none",
            borderRadius: 6,
            padding: "4px 10px",
            background: accent,
            color: "#fff",
            cursor: thinking ? "not-allowed" : "pointer",
          }}
        >
          {t.draft}
        </button>
      )}
      {thinking && <span style={{ opacity: 0.7 }}>{t.thinking}</span>}
      {aiError && (
        <span role="status" style={{ color: "#b00", flexBasis: "100%" }}>
          {aiError}
        </span>
      )}
    </div>
  );
}
