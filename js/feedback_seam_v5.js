import { createFeedbackHelpers } from "./feedback_helpers_v5.js";

export function createFeedbackSeam({
  escapeHtml,
  lockBodyScroll,
  unlockBodyScroll,
  focusFirstFocusable
}){
  return createFeedbackHelpers({
    escapeHtml,
    lockBodyScroll,
    unlockBodyScroll,
    focusFirstFocusable
  });
}
