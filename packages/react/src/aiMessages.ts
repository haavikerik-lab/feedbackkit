import { AssistError } from "./assistClient";

const COPY: Record<"no" | "en", Record<"503" | "429" | "401" | "other", string>> = {
  no: {
    "503": "AI er utilgjengelig akkurat nå.",
    "429": "For mange forespørsler — vent litt.",
    "401": "AI er ikke tilgjengelig her.",
    other: "Kunne ikke nå AI-en.",
  },
  en: {
    "503": "AI is unavailable right now.",
    "429": "Too many requests — please wait.",
    "401": "AI is not available here.",
    other: "Could not reach the AI.",
  },
};

export function messageForError(err: unknown, locale: "no" | "en"): string {
  const status = err instanceof AssistError ? err.status : -1;
  const key = status === 503 ? "503" : status === 429 ? "429" : status === 401 ? "401" : "other";
  return COPY[locale][key];
}
