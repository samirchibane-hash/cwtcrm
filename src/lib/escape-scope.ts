/**
 * Radix overlays (Sheet, Dialog) close on Escape during the capture phase, before an inline
 * editor inside them can react. Mark the editor with `data-escape-scope` and pass this to the
 * overlay's `onEscapeKeyDown`: Esc then cancels the editor instead of closing the whole panel.
 */
export const keepLocalEscape = (event: KeyboardEvent) => {
  if (event.target instanceof Element && event.target.closest('[data-escape-scope]')) {
    event.preventDefault();
  }
};
