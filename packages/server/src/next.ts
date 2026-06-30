import type { AssistRequest, FeedbackCaseInput } from "@feedbackkit/core";
import type { AssistOptions } from "./assist";
import type { SubmitOptions } from "./submit";
import { createAssistHandler } from "./assist";
import { createSubmitHandler } from "./submit";
import { FeedbackError } from "./errors";

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new FeedbackError(400, "Ugyldig JSON.");
  }
}

function asAssistRequest(body: unknown): AssistRequest {
  const b = body as Partial<AssistRequest>;
  if ((b?.mode !== "chat" && b?.mode !== "draft") || !Array.isArray(b?.messages)) {
    throw new FeedbackError(400, "Ugyldig forespørsel.");
  }
  return body as AssistRequest;
}

function asFeedbackCaseInput(body: unknown): FeedbackCaseInput {
  const b = body as Partial<FeedbackCaseInput>;
  if (typeof b?.message !== "string") {
    throw new FeedbackError(400, "Ugyldig forespørsel.");
  }
  return body as FeedbackCaseInput;
}

function toResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(err: unknown): Response {
  if (err instanceof FeedbackError) {
    return toResponse({ error: err.message }, err.status);
  }
  console.error(err);
  return toResponse({ error: "Intern feil." }, 500);
}

export function createAssistRoute(
  opts: AssistOptions,
): (req: Request) => Promise<Response> {
  const handler = createAssistHandler(opts);
  return async (req) => {
    try {
      const body = asAssistRequest(await readJson(req));
      return toResponse(await handler(body));
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function createSubmitRoute(
  opts: SubmitOptions,
): (req: Request) => Promise<Response> {
  const handler = createSubmitHandler(opts);
  return async (req) => {
    try {
      const body = asFeedbackCaseInput(await readJson(req));
      return toResponse(await handler(body));
    } catch (err) {
      return errorResponse(err);
    }
  };
}
