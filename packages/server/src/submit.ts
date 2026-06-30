import type { FeedbackCase, FeedbackCaseInput } from "@feedbackkit/core";
import { FeedbackError } from "./errors";
import { capCaseInput } from "./cap";

export type SubmitOptions = {
  onCase: (c: FeedbackCase) => void | Promise<void>;
  gate?: (req: FeedbackCaseInput) => boolean | Promise<boolean>;
  now?: () => Date;
};

export function createSubmitHandler(
  opts: SubmitOptions,
): (req: FeedbackCaseInput) => Promise<{ ok: true }> {
  const now = opts.now ?? (() => new Date());
  return async (req) => {
    if (opts.gate && !(await opts.gate(req))) {
      throw new FeedbackError(401, "Ikke autorisert.");
    }
    const feedbackCase: FeedbackCase = {
      ...capCaseInput(req),
      createdAt: now().toISOString(),
    };
    await opts.onCase(feedbackCase);
    return { ok: true };
  };
}
