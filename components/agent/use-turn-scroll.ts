"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Reserve a viewport for the newest turn, then scroll its question to the top once. */
export function useTurnScroll(lastTurnId?: string, layout = "default") {
  const scroller = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      setViewportHeight(element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout]);

  useLayoutEffect(() => {
    const element = scroller.current;
    const turn = lastTurnId ? element?.querySelector<HTMLElement>(`[data-turn="${CSS.escape(lastTurnId)}"]`) : null;
    if (!element || !turn || !viewportHeight) return;
    const padding = parseFloat(getComputedStyle(element).paddingTop);
    const top = element.scrollTop + turn.getBoundingClientRect().top - element.getBoundingClientRect().top - element.clientTop - padding;
    element.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [lastTurnId, viewportHeight, layout]);

  return { scroller, viewportHeight };
}
