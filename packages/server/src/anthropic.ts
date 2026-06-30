import Anthropic from "@anthropic-ai/sdk";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type CreateParams = {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: AnthropicTool[];
  tool_choice: { type: "tool"; name: string };
};

export type ToolUseBlock = { type: "tool_use"; name: string; input: unknown };
export type ContentBlock = ToolUseBlock | { type: string };
export type MessageResponse = { content: ContentBlock[] };

export interface AnthropicLike {
  messages: { create(params: CreateParams): Promise<MessageResponse> };
}

export function defaultClient(apiKey: string): AnthropicLike {
  const sdk = new Anthropic({ apiKey });
  return {
    messages: {
      // Adapter boundary: bind the SDK method to its Messages instance so
      // `this` survives extraction, and narrow the SDK's rich types to our
      // minimal AnthropicLike here, in one place, so the rest of the package
      // stays fully typed against the small interface (and trivially mockable).
      create: (params) =>
        (
          sdk.messages.create.bind(sdk.messages) as unknown as AnthropicLike["messages"]["create"]
        )(params),
    },
  };
}
