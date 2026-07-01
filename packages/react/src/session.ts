import { useReducer } from "react";
import { dedupeElements } from "@feedbackkit/core";
import type { PickerMode, PickedElement, ComposerSegment, AssistMessage } from "@feedbackkit/core";

export type SessionStatus = "idle" | "sending" | "sent" | "error";
export type AiStatus = "idle" | "thinking" | "error";

export type SessionState = {
  open: boolean;
  mode: PickerMode;
  segments: ComposerSegment[];
  scenario: { id: string; title: string } | null;
  categories: string[];
  status: SessionStatus;
  transcript: AssistMessage[];
  pickedElements: PickedElement[];
  categoriesTouched: boolean;
  aiStatus: AiStatus;
  aiError: string | null;
  draft: string | null;
};

export type SessionAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "setMode"; mode: PickerMode }
  | { type: "setDraftText"; text: string }
  | { type: "addElement"; element: PickedElement }
  | { type: "removeSegment"; index: number }
  | { type: "selectScenario"; scenario: { id: string; title: string } }
  | { type: "clearScenario" }
  | { type: "toggleCategory"; code: string }
  | { type: "sendStart" }
  | { type: "sendOk" }
  | { type: "sendError" }
  | { type: "aiChatStart" }
  | { type: "aiChatOk"; userContent: string; elements: PickedElement[]; reply: string; categories: string[] }
  | { type: "aiDraftStart" }
  | { type: "aiDraftOk"; draft: string }
  | { type: "setDraft"; text: string }
  | { type: "backToChat" }
  | { type: "aiError"; message: string };

export const initialState: SessionState = {
  open: false,
  mode: "browse",
  segments: [],
  scenario: null,
  categories: [],
  status: "idle",
  transcript: [],
  pickedElements: [],
  categoriesTouched: false,
  aiStatus: "idle",
  aiError: null,
  draft: null,
};

export function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "open":
      return { ...state, open: true };
    case "close":
      return { ...state, open: false, mode: "browse" };
    case "setMode":
      return { ...state, mode: action.mode };
    case "setDraftText": {
      const segs = [...state.segments];
      const last = segs[segs.length - 1];
      if (last && last.type === "text") {
        segs[segs.length - 1] = { type: "text", text: action.text };
      } else {
        segs.push({ type: "text", text: action.text });
      }
      return { ...state, segments: segs };
    }
    case "addElement":
      return {
        ...state,
        segments: [...state.segments, { type: "element", element: action.element }],
        mode: state.mode === "select" ? "browse" : state.mode,
      };
    case "removeSegment": {
      const segs = state.segments.filter((_, i) => i !== action.index);
      return { ...state, segments: segs };
    }
    case "selectScenario":
      return { ...state, scenario: action.scenario };
    case "clearScenario":
      return { ...state, scenario: null };
    case "toggleCategory": {
      const has = state.categories.includes(action.code);
      return {
        ...state,
        categoriesTouched: true,
        categories: has
          ? state.categories.filter((c) => c !== action.code)
          : [...state.categories, action.code],
      };
    }
    case "sendStart":
      return { ...state, status: "sending", aiStatus: "idle", aiError: null };
    case "sendOk":
      return { ...state, status: "sent" };
    case "sendError":
      return { ...state, status: "error" };
    case "aiChatStart":
      return { ...state, aiStatus: "thinking", aiError: null };
    case "aiChatOk":
      return {
        ...state,
        transcript: [
          ...state.transcript,
          { role: "user", content: action.userContent },
          { role: "assistant", content: action.reply },
        ],
        pickedElements: dedupeElements([...state.pickedElements, ...action.elements]),
        segments: [],
        aiStatus: "idle",
        aiError: null,
        categories: state.categoriesTouched ? state.categories : action.categories,
      };
    case "aiDraftStart":
      return { ...state, aiStatus: "thinking", aiError: null };
    case "aiDraftOk":
      return { ...state, draft: action.draft, aiStatus: "idle", aiError: null };
    case "setDraft":
      return { ...state, draft: action.text };
    case "backToChat":
      return { ...state, draft: null };
    case "aiError":
      return { ...state, aiStatus: "error", aiError: action.message };
  }
}

export function useFeedbackSession() {
  return useReducer(reducer, initialState);
}
