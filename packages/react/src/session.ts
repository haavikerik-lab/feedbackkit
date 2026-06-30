import { useReducer } from "react";
import type { PickerMode, PickedElement, ComposerSegment } from "@feedbackkit/core";

export type SessionStatus = "idle" | "sending" | "sent" | "error";

export type SessionState = {
  open: boolean;
  mode: PickerMode;
  segments: ComposerSegment[];
  scenario: { id: string; title: string } | null;
  categories: string[];
  status: SessionStatus;
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
  | { type: "sendError" };

export const initialState: SessionState = {
  open: false,
  mode: "browse",
  segments: [],
  scenario: null,
  categories: [],
  status: "idle",
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
        categories: has
          ? state.categories.filter((c) => c !== action.code)
          : [...state.categories, action.code],
      };
    }
    case "sendStart":
      return { ...state, status: "sending" };
    case "sendOk":
      return { ...state, status: "sent" };
    case "sendError":
      return { ...state, status: "error" };
  }
}

export function useFeedbackSession() {
  return useReducer(reducer, initialState);
}
