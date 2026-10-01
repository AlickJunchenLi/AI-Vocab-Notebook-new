import { createElement, lazy, useState } from "react";

/*
 * Parts of the notebook that aren't needed for its first page: the other
 * three pages, the word dialogs and the tour. Each is its own small file,
 * fetched while the browser is idle just after the notebook opens, or as
 * soon as the pointer or keyboard heads for a page tab or Add word, so it is
 * already there by the time it's asked for. A page asked for sooner still is
 * fetched before the notebook turns to it (whenPageReady), so a page never
 * turns in empty; a dialog simply opens once its file has arrived.
 *
 * Once a part's file is in, the part is drawn straight away. React's lazy()
 * would still hold it back the first time it is drawn, until a promise that
 * has already settled reports so, and then keep its (empty) fallback on
 * screen for a moment more: a page turned to for the first time would show
 * a blank page, and the notebook would shrink and grow again around it.
 * Each part keeps the way it was first drawn, so one that started loading
 * is never swapped out (and its state lost) when the file arrives.
 */
function lazyPart(load) {
  let loading = null;
  let loaded = null;
  // A fetch that fails (the connection dropped) is forgotten, so the next
  // request for the part tries again.
  const preload = () => {
    loading ??= load().then((module) => {
      loaded = module.default;
      return module;
    }, (error) => {
      loading = null;
      throw error;
    });
    return loading;
  };
  const Lazy = lazy(preload);

  function Part(props) {
    const [Component] = useState(() => loaded ?? Lazy);
    return createElement(Component, props);
  }

  Part.preload = preload;
  Part.isReady = () => loaded !== null;
  return Part;
}

export const LibraryPage = lazyPart(() => import("./pages/LibraryPage.jsx"));
export const PracticePage = lazyPart(() => import("./pages/PracticePage.jsx"));
export const ProgressPage = lazyPart(() => import("./pages/ProgressPage.jsx"));
export const AddWordModal = lazyPart(() => import("./components/AddWordModal.jsx"));
export const EditWordModal = lazyPart(() => import("./components/EditWordModal.jsx"));
export const DeleteConfirmModal = lazyPart(() => import("./components/DeleteConfirmModal.jsx"));
export const TourGuide = lazyPart(() => import("./tour/TourGuide.jsx"));

const PAGES = {
  library: LibraryPage,
  practice: PracticePage,
  progress: ProgressPage,
};

// Starts fetching a page's file, when the way there is about to be taken.
export function preloadPage(page) {
  PAGES[page]?.preload().catch(() => {
    // Tried again when the page is opened.
  });
}

// Null when the page can be shown at once; otherwise a promise that settles
// once its file has arrived (or failed, when Suspense takes over).
export function whenPageReady(page) {
  const part = PAGES[page];
  return !part || part.isReady() ? null : part.preload().catch(() => {});
}

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
    const handle = window.requestIdleCallback(load, { timeout: 1200 });
    return () => window.cancelIdleCallback(handle);
  }

  const handle = window.setTimeout(load, 800);
  return () => window.clearTimeout(handle);
}
