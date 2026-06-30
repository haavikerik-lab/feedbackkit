import type { SessionStatus } from "../session";

const LABELS: Record<"no" | "en", Record<SessionStatus, string>> = {
  no: { idle: "Send", sending: "Sender…", sent: "Sendt ✓", error: "Prøv igjen" },
  en: { idle: "Send", sending: "Sending…", sent: "Sent ✓", error: "Try again" },
};

export function SubmitBar({
  status,
  onSend,
  locale,
}: {
  status: SessionStatus;
  onSend: () => void;
  locale: "no" | "en";
}) {
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={status === "sending" || status === "sent"}
      style={{ marginTop: 8 }}
    >
      {LABELS[locale][status]}
    </button>
  );
}
