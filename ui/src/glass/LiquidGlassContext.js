import { createContext, useContext } from "react";

export const LiquidGlassContext = createContext(null);

export function useLiquidGlassGroup() {
  return useContext(LiquidGlassContext);
}
