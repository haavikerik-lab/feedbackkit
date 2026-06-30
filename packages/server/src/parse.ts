import type {
  AssistResult,
  AssistChatResult,
  AssistDraftResult,
  CategoryConfig,
} from "@feedbackkit/core";
import type { MessageResponse, ToolUseBlock } from "./anthropic";
import { FeedbackError } from "./errors";

function findRespond(res: MessageResponse): ToolUseBlock {
  const block = res.content.find(
    (b): b is ToolUseBlock =>
      b.type === "tool_use" && (b as ToolUseBlock).name === "respond",
  );
  if (!block) {
    throw new FeedbackError(503, "AI ga ikke et brukbart svar.");
  }
  return block;
}

export function parseRespond(
  res: MessageResponse,
  mode: "chat" | "draft",
  categories: CategoryConfig[],
): AssistResult {
  const input = findRespond(res).input as Record<string, unknown>;
  if (mode === "draft") {
    const draft = typeof input.draft === "string" ? input.draft : "";
    return { draft } satisfies AssistDraftResult;
  }
  const reply = typeof input.reply === "string" ? input.reply : "";
  const known = new Set(categories.map((c) => c.code));
  const cats = Array.isArray(input.categories)
    ? input.categories.filter(
        (c): c is string => typeof c === "string" && known.has(c),
      )
    : [];
  return { reply, categories: cats } satisfies AssistChatResult;
}
