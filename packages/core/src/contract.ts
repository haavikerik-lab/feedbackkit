import type { PickedElement } from "./composer";

export type CategoryConfig = { code: string; label: string };
export type Scenario = { id: string; title: string; prompt: string };
export type AssistMessage = { role: "user" | "assistant"; content: string };

export type FeedbackCase = {
  message: string;
  page: string | null;
  url?: string;
  scenario?: { id: string; title: string } | null;
  categories?: string[];
  elements?: PickedElement[];
  identity?: { id?: string; email?: string; anonymous?: boolean } | null;
  createdAt: string;
};
export type FeedbackCaseInput = Omit<FeedbackCase, "createdAt">;

export type AssistRequest = {
  mode: "chat" | "draft";
  messages: AssistMessage[];
  page?: string | null;
  url?: string;
  elements?: PickedElement[];
  categories?: string[];
  scenario?: { id: string; title: string } | null;
};
export type AssistChatResult = { reply: string; categories: string[] };
export type AssistDraftResult = { draft: string };
export type AssistResult = AssistChatResult | AssistDraftResult;

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { code: "bug", label: "Feil / bug" },
  { code: "confusing", label: "Forvirrende" },
  { code: "missing", label: "Mangler noe" },
  { code: "idea", label: "Idé / forslag" },
  { code: "other", label: "Annet" },
];
