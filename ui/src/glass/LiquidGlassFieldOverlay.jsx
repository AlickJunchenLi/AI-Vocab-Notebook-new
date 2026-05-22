function LiquidGlassFieldOverlay({ canvasRef }) {
  return (
    <canvas
      ref={canvasRef}
      className="liquid-glass-field-overlay"
      aria-hidden="true"
    />
  );
}

export default LiquidGlassFieldOverlay;
