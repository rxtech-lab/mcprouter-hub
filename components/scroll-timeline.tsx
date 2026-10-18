"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/m3/cn";

export type TimelineSection = { id: string; label: string };

/** How long the rail stays up after the last scroll event. */
const HIDE_AFTER_MS = 1200;
/** A section counts as current once its top passes this fraction of the viewport. */
const ANCHOR = 0.35;

/**
 * Vertical section timeline pinned beside the scrollbar. It fades in while the page scrolls
 * (or while hovered or focused), marks the current section and fills as you move through the page.
 * On wide screens it sits in the page margin, so hovering there brings it back without scrolling.
 */
export function ScrollTimeline({ sections }: { sections: TimelineSection[] }) {
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const [active, setActive] = useState(0);
  const [fill, setFill] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Section picked from the rail. It stays current until the user scrolls by hand, even if the page can't bring it to the top. */
  const pinned = useRef<number | null>(null);

  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
      const anchor = window.innerHeight * ANCHOR;
      const tops = sections.map(({ id }) => document.getElementById(id)?.getBoundingClientRect().top ?? Infinity);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let index = 0;
      tops.forEach((top, i) => {
        if (top <= anchor) index = i;
      });
      if (atBottom) index = sections.length - 1;
      if (pinned.current !== null) index = pinned.current;
      // Fractional position between the current section and the next, so the fill moves smoothly.
      const next = tops[index + 1];
      const span = next !== undefined ? next - tops[index] : 0;
      const within = !atBottom && span > 0 ? Math.min(1, Math.max(0, (anchor - tops[index]) / span)) : 0;
      setActive(index);
      setFill(sections.length > 1 ? (index + within) / (sections.length - 1) : 0);
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(measure);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    }

    function unpin() {
      pinned.current = null;
    }

    const manual = ["wheel", "touchstart", "keydown"] as const;
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    manual.forEach((type) => window.addEventListener(type, unpin, { passive: true }));
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      manual.forEach((type) => window.removeEventListener(type, unpin));
      if (frame) cancelAnimationFrame(frame);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [sections]);

  function jump(id: string, index: number) {
    pinned.current = index;
    setActive(index);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  const shown = visible || held;

  return (
    <nav
      aria-label="Page sections"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        "fixed top-1/2 right-1 z-30 -translate-y-1/2 transition-[opacity,translate] duration-300 ease-emphasized print:hidden md:right-3",
        shown ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-2 opacity-0 xl:pointer-events-auto",
      )}
    >
      <ol className="relative flex flex-col gap-10 px-2 py-3 md:gap-14">
        {/* Rail between the first and last dot centres, with the progress fill on top. */}
        <span aria-hidden className="absolute top-6 bottom-6 right-[19px] w-0.5 rounded-full bg-outline-variant" />
        <span
          aria-hidden
          className="absolute top-6 right-[19px] w-0.5 origin-top rounded-full bg-primary transition-[height] duration-150 ease-out"
          style={{ height: `calc((100% - 48px) * ${fill})` }}
        />
        {sections.map((section, index) => {
          const current = index === active;
          const passed = index < active;
          return (
            <li key={section.id} className="relative flex h-6 items-center justify-end">
              <a
                href={`#${section.id}`}
                aria-current={current ? "location" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  jump(section.id, index);
                }}
                className="group flex items-center gap-3 outline-none"
              >
                <span
                  className={cn(
                    "absolute right-8 rounded-full px-3 py-1 whitespace-nowrap type-label-medium shadow-elevation-1 transition-[opacity,translate,background-color] duration-200 ease-emphasized",
                    current ? "bg-primary text-on-primary" : "bg-surface-container-highest text-on-surface",
                    current || held ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-1 opacity-0",
                    "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                  )}
                >
                  {section.label}
                </span>
                <span className="flex size-6 items-center justify-center">
                  <span
                    className={cn(
                      "rounded-full transition-[width,height,background-color,box-shadow] duration-200 ease-emphasized group-hover:ring-4 group-hover:ring-primary/20 group-focus-visible:ring-4 group-focus-visible:ring-primary/40",
                      current ? "size-3.5 bg-primary ring-4 ring-primary/25" : passed ? "size-2.5 bg-primary" : "size-2.5 bg-outline",
                    )}
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
