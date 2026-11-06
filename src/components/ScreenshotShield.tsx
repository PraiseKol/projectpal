import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import { EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ScreenshotShieldProps {
  /** Turn the protection on (e.g. for free-preview users). When false the children render untouched. */
  enabled: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Deterrents for free-preview content. A website can never fully block screenshots
 * (phone cameras and OS-level capture are out of reach), so this does the realistic things:
 *  - a tiled watermark with the viewer's email, so a leaked screenshot is traceable
 *  - blur the content when the tab loses focus or a capture shortcut is pressed
 *  - no text selection, copy, right-click, drag or printing
 */
export const ScreenshotShield = ({ enabled, children, className = "" }: ScreenshotShieldProps) => {
  const [email, setEmail] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;

    const hideBriefly = () => {
      setHidden(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(document.visibilityState === "hidden"), 2500);
    };
    const clearClipboard = () => {
      try {
        navigator.clipboard?.writeText("");
      } catch {
        /* clipboard not available */
      }
    };

    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState === "hidden");

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (key === "printscreen") {
        hideBriefly();
        clearClipboard();
      }
      // Print / save page
      if (mod && (key === "p" || key === "s")) {
        e.preventDefault();
        hideBriefly();
      }
      // Snipping shortcuts: Win+Shift+S, Cmd+Shift+3/4/5
      if (e.shiftKey && e.metaKey && ["s", "3", "4", "5"].includes(key)) {
        hideBriefly();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        hideBriefly();
        clearClipboard();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  const watermark = useMemo(() => {
    const label = `${email || "ProjectPal"} · free preview`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='190'>` +
      `<text x='20' y='110' transform='rotate(-25 170 95)' font-family='sans-serif' font-size='15' ` +
      `fill='rgba(128,128,128,0.25)'>${label}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [email]);

  if (!enabled) return <>{children}</>;

  const block = (e: SyntheticEvent) => e.preventDefault();
  const noSelect: CSSProperties = {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
  };

  return (
    <div
      className={`shield-root relative ${className}`}
      style={noSelect}
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
    >
      <style>{`@media print { .shield-root { display: none !important; } }`}</style>
      <div
        style={{
          filter: hidden ? "blur(20px)" : undefined,
          pointerEvents: hidden ? "none" : undefined,
          transition: "filter 60ms",
        }}
      >
        {children}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ backgroundImage: watermark, backgroundRepeat: "repeat" }}
      />
      {hidden && (
        <div className="absolute inset-0 z-20 flex items-start justify-center pt-24 pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium shadow">
            <EyeOff className="h-4 w-4" />
            Preview hidden while this page is not in focus
          </div>
        </div>
      )}
    </div>
  );
};
