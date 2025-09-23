import React from "react";
import ReactDOM from "react-dom";

export default function PortalTooltip({ text, children, side = "top" }) {
  const ref = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ x: 0, y: 0 });

  function place() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: r.left + r.width / 2,
      y: side === "top" ? r.top : r.bottom,
    });
  }

  return (
    <>
      <span
        ref={ref}
        className="inline-flex items-center"
        onMouseEnter={() => { place(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>

      {open &&
        ReactDOM.createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: pos.x,
              top: pos.y + (side === "top" ? -8 : 8),
              transform: `translate(-50%, ${side === "top" ? "-100%" : "0"})`,
            }}
            role="tooltip"
          >
            <div className="rounded-md bg-black/80 px-2 py-1 text-xs text-white shadow-lg w-56 max-w-[min(80vw,16rem)] whitespace-normal break-words text-left leading-snug">
              {text}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
