import { createContext, useContext } from "react";

// Whether what you type is written in by hand (the Handwriting switch in
// Appearance). Read by every InkField.
export const HandwritingContext = createContext(false);

export function useHandwriting() {
  return useContext(HandwritingContext);
}

const STORAGE_KEY = "notebook.handwriting";

export function loadHandwriting() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveHandwriting(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // The switch still applies for this visit.
  }
}
