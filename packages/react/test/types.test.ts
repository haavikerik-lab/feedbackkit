import type { SubmitConfig, AssistConfig, FeedbackWidgetProps } from "../src/types";

// Type-level test: these assignments must compile. A runtime assertion keeps
// the test file non-empty so the runner reports a pass.
it("SubmitConfig accepts both url and onCase shapes", () => {
  const a: SubmitConfig = { url: "/x" };
  const b: SubmitConfig = { onCase: async () => {} };
  const props: FeedbackWidgetProps = { submit: a };
  expect(typeof props.submit).toBe("object");
  expect("onCase" in b).toBe(true);
});

it("AssistConfig accepts both url and onAssist shapes", () => {
  const a: AssistConfig = { url: "/assist" };
  const b: AssistConfig = { onAssist: async () => ({ reply: "hei", categories: [] }) };
  const props: FeedbackWidgetProps = { submit: { url: "/s" }, assist: a };
  expect("url" in a).toBe(true);
  expect("onAssist" in b).toBe(true);
  expect(props.assist).toBeDefined();
});
