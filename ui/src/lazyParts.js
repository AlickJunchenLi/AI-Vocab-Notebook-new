import { lazy } from "react";

/*
 * Parts of the notebook that aren't needed for its first page: the other
 * three pages, the word dialogs and the tour. Each is its own small file,
 * fetched while the browser is idle just after the notebook opens, so it is
 * already there by the time it's asked for; if it's asked for sooner, it is
 * fetched then (the Suspense boundaries in App.jsx show nothing meanwhile).
 */
function lazyPart(load) {
  let loading = null;
  // A fetch that fails (the connection dropped) is forgotten, so the next
  // request for the part tries again.
  const preload = () => {
    loading ??= load().catch((error) => {
      loading = null;
      throw error;
    });
    return loading;
  };
  const Part = lazy(preload);
  Part.preload = preload;
  return Part;
}

export const LibraryPage = lazyPart(() => import("./pages/LibraryPage.jsx"));
export const PracticePage = lazyPart(() => import("./pages/PracticePage.jsx"));
export const ProgressPage = lazyPart(() => import("./pages/ProgressPage.jsx"));
export const AddWordModal = lazyPart(() => import("./components/AddWordModal.jsx"));
export const EditWordModal = lazyPart(() => import("./components/EditWordModal.jsx"));
export const DeleteConfirmModal = lazyPart(() => import("./components/DeleteConfirmModal.jsx"));
export const TourGuide = lazyPart(() => import("./tour/TourGuide.jsx"));

const PARTS = [
  LibraryPage,
  AddWordModal,
  PracticePage,
  ProgressPage,
  EditWordModal,
  DeleteConfirmModal,
  TourGuide,
];

// Fetches every part once the page has settled. Returns a cancel function.
export function preloadWhenIdle() {
  const load = () => {
    for (const part of PARTS) {
      part.preload().catch(() => {
        // Tried again when the part is actually opened.
      });
    }
  };

  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(load, { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }

  const handle = window.setTimeout(load, 800);
  return () => window.clearTimeout(handle);
}
