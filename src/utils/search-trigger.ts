/**
 * Dispatch a synthetic Cmd/Ctrl+K keyboard event to open the search modal.
 * Used by any button/element that should trigger the search overlay.
 */
export function openSearch(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    }),
  );
}
