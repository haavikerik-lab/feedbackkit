import { useCallback, useRef } from "react";
import {
  serialize,
  toApiContent,
  dedupeElements,
  DEFAULT_CATEGORIES,
  type PickedElement,
  type FeedbackCaseInput,
} from "@feedbackkit/core";
import type { FeedbackWidgetProps } from "./types";
import { useFeedbackSession } from "./session";
import { useElementPicker } from "./useElementPicker";
import { submitCase } from "./client";
import { Launcher } from "./components/Launcher";
import { Panel } from "./components/Panel";
import { ScenarioChips } from "./components/ScenarioChips";
import { PickerToolbar } from "./components/PickerToolbar";
import { Composer } from "./components/Composer";
import { CategoryPicker } from "./components/CategoryPicker";
import { SubmitBar } from "./components/SubmitBar";

export function FeedbackWidget(props: FeedbackWidgetProps) {
  const accent = props.accent ?? "#f08a5d";
  const locale = props.locale ?? "no";
  const categories = props.categories ?? DEFAULT_CATEGORIES;
  const [state, dispatch] = useFeedbackSession();
  const rootRef = useRef<HTMLDivElement>(null);

  const handlePick = useCallback(
    (el: PickedElement) => dispatch({ type: "addElement", element: el }),
    [],
  );
  useElementPicker(state.open ? state.mode : "browse", handlePick, rootRef, accent);

  const send = async () => {
    dispatch({ type: "sendStart" });
    try {
      const { content, elements } = serialize(state.segments);
      const input: FeedbackCaseInput = {
        message: toApiContent(content, elements),
        page: window.location.pathname,
        url: window.location.href,
        scenario: state.scenario,
        categories: state.categories,
        elements: dedupeElements(elements),
        identity: props.identity ?? null,
      };
      await submitCase(props.submit, input);
      dispatch({ type: "sendOk" });
    } catch {
      dispatch({ type: "sendError" });
    }
  };

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
          <PickerToolbar mode={state.mode} onMode={(m) => dispatch({ type: "setMode", mode: m })} />
          <Composer
            segments={state.segments}
            onText={(t) => dispatch({ type: "setDraftText", text: t })}
            onRemove={(i) => dispatch({ type: "removeSegment", index: i })}
            accent={accent}
          />
          <CategoryPicker
            categories={categories}
            selected={state.categories}
            onToggle={(c) => dispatch({ type: "toggleCategory", code: c })}
          />
          <SubmitBar status={state.status} onSend={send} locale={locale} />
        </Panel>
      )}
    </div>
  );
}
