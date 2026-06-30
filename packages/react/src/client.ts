import type { FeedbackCaseInput } from "@feedbackkit/core";
import type { SubmitConfig } from "./types";

export async function submitCase(
  submit: SubmitConfig,
  input: FeedbackCaseInput,
): Promise<void> {
  if ("url" in submit) {
    const res = await fetch(submit.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
    return;
  }
  await submit.onCase(input);
}
