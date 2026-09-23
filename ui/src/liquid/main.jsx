import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import "../glass/liquidGlass.css";
import "./liquidDemo.css";
import LiquidDemo from "./LiquidDemo.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LiquidDemo />
  </StrictMode>,
);
