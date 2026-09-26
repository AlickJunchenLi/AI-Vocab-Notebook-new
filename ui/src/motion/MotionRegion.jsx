"use client";

import { memo } from "react";
import { m } from "motion/react";
import useNotebookMotion from "./useNotebookMotion.js";

const ELEMENTS = {
  div: m.div,
  section: m.section,
  aside: m.aside,
  ul: m.ul,
  p: m.p,
  span: m.span,
};

function MotionRegion({ as = "div", motionPreset = "rise", delay = 0, reveal = false, ...props }) {
  const Element = ELEMENTS[as] ?? ELEMENTS.div;
  const animation = useNotebookMotion(motionPreset, delay, reveal);
  return <Element {...props} {...animation} />;
}

export default memo(MotionRegion);
