import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./glassLens.css";
import GlassLensDemo from "./GlassLensDemo.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GlassLensDemo />
  </StrictMode>,
);
