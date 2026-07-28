import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function WindowIcon({ kind }: { kind: "min" | "max" | "restore" | "close" }) {
  if (kind === "min") {
    return (
      <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "max") {
    return (
      <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true">
        <rect
          x="1.2"
          y="1.2"
          width="7.6"
          height="7.6"
          rx="0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
        />
      </svg>
    );
  }
  if (kind === "restore") {
    return (
      <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M3 3.5h4.25v4.25H3zM2.5 2h4.75v1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M2.2 2.2l5.6 5.6M7.8 2.2L2.2 7.8"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Overlay chrome — panels run full-bleed underneath. Transparent strip so
 * sidebar / main colors show through; only the floating controls paint.
 */
export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    void win.isMaximized().then(setMaximized);
    void win
      .onResized(() => {
        void win.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  const onDragDoubleClick = useCallback(() => {
    void getCurrentWindow().toggleMaximize();
  }, []);

  const btn =
    "inline-flex h-9 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground active:bg-white/[0.1]";

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-10 select-none items-stretch">
      <div
        className="pointer-events-auto min-w-0 flex-1"
        data-tauri-drag-region
        onDoubleClick={onDragDoubleClick}
      />

      <div className="pointer-events-auto flex items-center gap-0.5 pr-2.5 pt-0.5">
        <button
          type="button"
          className={btn}
          title="Minimize"
          aria-label="Minimize"
          onClick={() => void getCurrentWindow().minimize()}
        >
          <WindowIcon kind="min" />
        </button>
        <button
          type="button"
          className={btn}
          title={maximized ? "Restore" : "Maximize"}
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => void getCurrentWindow().toggleMaximize()}
        >
          <WindowIcon kind={maximized ? "restore" : "max"} />
        </button>
        <button
          type="button"
          className={`${btn} hover:bg-red-500/90 hover:text-white`}
          title="Close"
          aria-label="Close"
          onClick={() => void getCurrentWindow().close()}
        >
          <WindowIcon kind="close" />
        </button>
      </div>
    </header>
  );
}
