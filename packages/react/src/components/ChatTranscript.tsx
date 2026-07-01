import type { AssistMessage } from "@feedbackkit/core";

export function ChatTranscript({ transcript }: { transcript: AssistMessage[] }) {
  if (transcript.length === 0) return null;
  return (
    <div
      role="log"
      aria-label="AI-samtale"
      style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}
    >
      {transcript.map((m, i) => (
        <div
          key={i}
          style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            padding: "4px 8px",
            borderRadius: 8,
            background: m.role === "user" ? "#eee" : "#f5f5f5",
            whiteSpace: "pre-wrap",
          }}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
