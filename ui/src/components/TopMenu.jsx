import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";

function TopMenu() {
  return (
    <LiquidGlassSurface
      as="button"
      id="top-menu"
      type="button"
      className="top-menu"
      variant="menu"
      radius={18}
      intensity={0.92}
    >
      menu
    </LiquidGlassSurface>
  );
}

export default TopMenu;
