export type PickerMode = "select" | "multi" | "browse";

/**
 * Whether the picker should block a page click. The picker blocks page
 * activation so a "pick" tap doesn't also follow a link — in both select
 * (single) and multi (flervalg) mode. Browse mode keeps the page fully live
 * (navigate, open the menu); a Cmd/Ctrl click is a one-off navigate even while
 * picking; and the feedback UI's own clicks must always work.
 */
export function shouldInterceptClick(
  mode: PickerMode,
  insideFeedbackUi: boolean,
  hasModifier: boolean,
): boolean {
  if (insideFeedbackUi) return false;
  if (mode === "browse") return false;
  if (hasModifier) return false;
  return true;
}
