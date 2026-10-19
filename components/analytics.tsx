"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsPath, trackEvent, trackFeatureView, trackPageView } from "@/lib/analytics";

/** Mounted once in the root layout; explicit labels avoid collecting user content. */
export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigation = `${pathname}?${searchParams.toString()}`;
  const lastPath = useRef<string | null>(null);
  const lastFeaturePath = useRef<string | null>(null);
  useEffect(() => {
    if (lastFeaturePath.current === pathname) return;
    lastFeaturePath.current = pathname;
    trackFeatureView(pathname);
  }, [pathname]);
  useEffect(() => {
    if (lastPath.current === navigation) return;
    lastPath.current = navigation;
    trackPageView(pathname);
  }, [pathname, navigation]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-analytics-event]");
      if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
      const name = target.dataset.analyticsEvent;
      if (name) trackEvent(name, { label: target.dataset.analyticsLabel ?? "", page_path: analyticsPath(window.location.pathname) });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
