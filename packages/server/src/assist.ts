import type { AssistRequest, AssistResult, CategoryConfig } from "@feedbackkit/core";
import { DEFAULT_CATEGORIES } from "@feedbackkit/core";
import type { AnthropicLike } from "./anthropic";
import { defaultClient } from "./anthropic";
import { FeedbackError } from "./errors";
import { capAssistRequest } from "./cap";
import { buildSystemPrompt, buildRespondTool, buildMessages } from "./prompt";
import { parseRespond } from "./parse";

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

export type AssistOptions = {
  anthropicKey: string;
  model?: string;
  categories?: CategoryConfig[];
  kb?: string;
  gate?: (req: AssistRequest) => boolean | Promise<boolean>;
  rateLimit?: (req: AssistRequest) => boolean | Promise<boolean>;
  client?: AnthropicLike;
};

export function createAssistHandler(
  opts: AssistOptions,
): (req: AssistRequest) => Promise<AssistResult> {
  const categories = opts.categories ?? DEFAULT_CATEGORIES;
  const model = opts.model ?? DEFAULT_MODEL;
  return async (req) => {
    if (opts.gate && !(await opts.gate(req))) {
      throw new FeedbackError(401, "Ikke autorisert.");
    }
    if (opts.rateLimit && !(await opts.rateLimit(req))) {
      throw new FeedbackError(429, "For mange forespørsler.");
    }
    if (!opts.anthropicKey) {
      throw new FeedbackError(503, "AI er ikke tilgjengelig.");
    }
    const client = opts.client ?? defaultClient(opts.anthropicKey);
    const capped = capAssistRequest(req);
    const res = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(categories, opts.kb),
      messages: buildMessages(capped),
      tools: [buildRespondTool(capped.mode, categories)],
      tool_choice: { type: "tool", name: "respond" },
    });
    return parseRespond(res, capped.mode, categories);
  };
}
