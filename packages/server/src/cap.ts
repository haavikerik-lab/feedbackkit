import type { AssistRequest, FeedbackCaseInput, PickedElement } from "@feedbackkit/core";
import { dedupeElements } from "@feedbackkit/core";

export type Cap = {
  maxTurns: number;
  maxElements: number;
  maxFieldLen: number;
  maxElementLen: number;
};

export const DEFAULT_CAP: Cap = {
  maxTurns: 20,
  maxElements: 10,
  maxFieldLen: 4000,
  maxElementLen: 200,
};

export function capText(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

function capElements(els: PickedElement[], cap: Cap): PickedElement[] {
  return dedupeElements(els, cap.maxElements).map((el) => ({
    label: capText(el.label, cap.maxElementLen),
    text: capText(el.text, cap.maxElementLen),
  }));
}

export function capAssistRequest(
  req: AssistRequest,
  cap: Cap = DEFAULT_CAP,
): AssistRequest {
  return {
    ...req,
    messages: req.messages
      .slice(-cap.maxTurns)
      .map((m) => ({ role: m.role, content: capText(m.content, cap.maxFieldLen) })),
    elements: capElements(req.elements ?? [], cap),
  };
}

export function capCaseInput(
  input: FeedbackCaseInput,
  cap: Cap = DEFAULT_CAP,
): FeedbackCaseInput {
  return {
    ...input,
    message: capText(input.message, cap.maxFieldLen),
    elements: capElements(input.elements ?? [], cap),
  };
}
