"use client";

import { memo } from "react";
import { m } from "motion/react";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import useNotebookMotion from "./useNotebookMotion.js";

const Surface = m.create(LiquidGlassSurface);

function MotionSurface({ motionPreset = "rise", delay = 0, reveal = false, ...props }) {
  const animation = useNotebookMotion(motionPreset, delay, reveal);
  return <Surface {...props} {...animation} />;
}

export default memo(MotionSurface);
