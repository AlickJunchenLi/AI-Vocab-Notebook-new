import { useEffect, useRef } from "react";
import { useIsPresent } from "motion/react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// `returnFocusTo` is a selector for where focus goes on closing when the
// control that opened the dialog is no longer on the page.
export function useDialogFocus(onClose, returnFocusTo) {
  const dialogRef = useRef(null);
  const isPresent = useIsPresent();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    if (!dialog || !isPresent) {
      return undefined;
    }

    document.body.style.overflow = "hidden";

    const autofocusTarget = dialog.querySelector("[data-autofocus]");
    const firstFocusable = dialog.querySelector(FOCUSABLE_SELECTOR);
    const focusFrame = window.requestAnimationFrame(() => {
      (autofocusTarget ?? firstFocusable ?? dialog).focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.closest("[inert]"));
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    dialog.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      dialog.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      // Safari doesn't focus a button when it is clicked, so the opener can
      // be the page itself; that counts as no opener.
      const opener = previouslyFocused instanceof HTMLElement &&
        previouslyFocused !== document.body && previouslyFocused.isConnected
        ? previouslyFocused
        : null;
      const returnTarget = opener ?? (returnFocusTo && document.querySelector(returnFocusTo));
      returnTarget?.focus({ preventScroll: true });
    };
  }, [onClose, isPresent, returnFocusTo]);

  return dialogRef;
}
