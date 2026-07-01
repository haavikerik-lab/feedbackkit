import type {
  CategoryConfig,
  Scenario,
  FeedbackCaseInput,
  AssistRequest,
  AssistResult,
} from "@feedbackkit/core";

export type SubmitConfig =
  | { url: string }
  | { onCase: (c: FeedbackCaseInput) => Promise<void> | void };

export type AssistConfig =
  | { url: string }
  | { onAssist: (req: AssistRequest) => Promise<AssistResult> };

export type Identity = { id?: string; email?: string; anonymous?: boolean };

export type FeedbackWidgetProps = {
  submit: SubmitConfig;
  assist?: AssistConfig;
  accent?: string;
  locale?: "no" | "en";
  categories?: CategoryConfig[];
  scenarios?: Scenario[];
  identity?: Identity;
};
