import type { AssistRequest, AssistResult } from "@feedbackkit/core";
import type { AssistConfig } from "./types";

export class AssistError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AssistError";
    this.status = status;
  }
}

export async function requestAssist(
  assist: AssistConfig,
  req: AssistRequest,
): Promise<AssistResult> {
  if ("url" in assist) {
    let res: Response;
    try {
      res = await fetch(assist.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
      });
    } catch {
      throw new AssistError(0, "Kunne ikke nå AI-en.");
    }
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string };
        detail = body?.error ?? "";
      } catch {
        detail = "";
      }
      throw new AssistError(res.status, detail || `Assist failed: ${res.status}`);
    }
    return (await res.json()) as AssistResult;
  }
  return assist.onAssist(req);
}
