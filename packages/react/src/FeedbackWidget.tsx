import { useCallback, useRef } from "react";
import {
  serialize,
  toApiContent,
  dedupeElements,
  DEFAULT_CATEGORIES,
  type PickedElement,
  type FeedbackCaseInput,
  type AssistChatResult,
  type AssistDraftResult,
} from "@feedbackkit/core";
import type { FeedbackWidgetProps } from "./types";
import { useFeedbackSession } from "./session";
import { useElementPicker } from "./useElementPicker";
import { submitCase } from "./client";
import { requestAssist } from "./assistClient";
import { messageForError } from "./aiMessages";
import { Launcher } from "./components/Launcher";
import { Panel } from "./components/Panel";
import { ScenarioChips } from "./components/ScenarioChips";
import { PickerToolbar } from "./components/PickerToolbar";
import { Composer } from "./components/Composer";
import { CategoryPicker } from "./components/CategoryPicker";
import { SubmitBar } from "./components/SubmitBar";
import { ChatTranscript } from "./components/ChatTranscript";
import { AiBar } from "./components/AiBar";
import { DraftReview } from "./components/DraftReview";

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const accent = props.accent ?? "#f08a5d";
  const locale = props.locale ?? "no";
  const categories = props.categories ?? DEFAULT_CATEGORIES;
  const assist = props.assist;
  const [state, dispatch] = useFeedbackSession();
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePick = useCallback(
    (el: PickedElement) => dispatch({ type: "addElement", element: el }),
    [],
  );
  useElementPicker(state.open ? state.mode : "browse", handlePick, rootRef, accent);

  const sendToAi = async () => {
    if (!assist) return;
    const { content, elements } = serialize(state.segments);
    const userContent = toApiContent(content, elements);
    if (!userContent.trim() && elements.length === 0) return;
    dispatch({ type: "aiChatStart" });
    try {
      const res = (await requestAssist(assist, {
        mode: "chat",
        messages: [...state.transcript, { role: "user", content: userContent }],
        page: window.location.pathname,
        url: window.location.href,
        elements: dedupeElements([...state.pickedElements, ...elements]),
        categories: state.categories,
        scenario: state.scenario,
      })) as AssistChatResult;
      const valid = res.categories.filter((c) => categories.some((cfg) => cfg.code === c));
      dispatch({ type: "aiChatOk", userContent, elements, reply: res.reply, categories: valid });
    } catch (e) {
      dispatch({ type: "aiError", message: messageForError(e, locale) });
    }
  };

  const makeDraft = async () => {
    if (!assist) return;
    dispatch({ type: "aiDraftStart" });
    try {
      const res = (await requestAssist(assist, {
        mode: "draft",
        messages: state.transcript,
        page: window.location.pathname,
        url: window.location.href,
        elements: dedupeElements(state.pickedElements),
        categories: state.categories,
        scenario: state.scenario,
      })) as AssistDraftResult;
      dispatch({ type: "aiDraftOk", draft: res.draft });
    } catch (e) {
      dispatch({ type: "aiError", message: messageForError(e, locale) });
    }
  };

  const send = async () => {
    dispatch({ type: "sendStart" });
    try {
      const { content, elements } = serialize(state.segments);
      const input: FeedbackCaseInput = {
        message: state.draft ?? toApiContent(content, elements),
        page: window.location.pathname,
        url: window.location.href,
        scenario: state.scenario,
        categories: state.categories,
        elements: dedupeElements([...state.pickedElements, ...elements]),
        identity: props.identity ?? null,
      };
      await submitCase(props.submit, input);
      dispatch({ type: "sendOk" });
    } catch {
      dispatch({ type: "sendError" });
    }
  };

  const hasAssistantTurn = state.transcript.some((m) => m.role === "assistant");
  const composed = serialize(state.segments);
  const canSendToAi =
    toApiContent(composed.content, composed.elements).trim().length > 0 || composed.elements.length > 0;

  return (
    <div ref={rootRef} data-fbk="">
      <Launcher
        open={state.open}
        onToggle={() => dispatch({ type: state.open ? "close" : "open" })}
        accent={accent}
      />
      {state.open && (
        <Panel accent={accent}>
          <ScenarioChips
            scenarios={props.scenarios ?? []}
            selectedId={state.scenario?.id ?? null}
            onSelect={(s) => dispatch({ type: "selectScenario", scenario: { id: s.id, title: s.title } })}
          />
          {state.draft === null ? (
            <>
              <PickerToolbar mode={state.mode} onMode={(m) => dispatch({ type: "setMode", mode: m })} />
              <Composer
                segments={state.segments}
                onText={(t) => dispatch({ type: "setDraftText", text: t })}
                onRemove={(i) => dispatch({ type: "removeSegment", index: i })}
                accent={accent}
              />
            </>
          ) : (
            <DraftReview
              draft={state.draft}
              locale={locale}
              accent={accent}
              onChange={(t) => dispatch({ type: "setDraft", text: t })}
              onBack={() => dispatch({ type: "backToChat" })}
            />
          )}
          <ChatTranscript transcript={state.transcript} />
          <CategoryPicker
            categories={categories}
            selected={state.categories}
            onToggle={(c) => dispatch({ type: "toggleCategory", code: c })}
          />
          {assist && state.draft === null && (
            <AiBar
              aiStatus={state.aiStatus}
              aiError={state.aiError}
              canSendToAi={canSendToAi}
              canDraft={hasAssistantTurn}
              locale={locale}
              accent={accent}
              onSendToAi={sendToAi}
              onDraft={makeDraft}
            />
          )}
          <SubmitBar status={state.status} onSend={send} locale={locale} />
        </Panel>
      )}
    </div>
  );
}
