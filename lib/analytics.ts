import type { Analytics, logEvent } from "firebase/analytics";

let analyticsPromise: Promise<{ analytics: Analytics; logEvent: typeof logEvent } | null> | undefined;

/** Public Firebase web configuration. No server credentials belong here. */
const firebaseConfig = {
  apiKey: "AIzaSyBor3WiXNoZ80d9z274PGN9vz1w9vI_HnA",
  authDomain: "mcprouter.firebaseapp.com",
  projectId: "mcprouter",
  storageBucket: "mcprouter.firebasestorage.app",
  messagingSenderId: "599466514800",
  appId: "1:599466514800:web:d68854313b4f6111ad17b5",
  measurementId: "G-F4NMJNMGMF",
};

function getAnalytics() {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "false") return Promise.resolve(null);
  return analyticsPromise ??= Promise.all([import("firebase/app"), import("firebase/analytics")])
    .then(async ([app, sdk]) => {
      if (!(await sdk.isSupported())) return null;
      const firebase = app.getApps().find((entry) => entry.name === "mcprouter-analytics") ?? app.initializeApp(firebaseConfig, "mcprouter-analytics");
      const analytics = sdk.initializeAnalytics(firebase, {
        config: {
          send_page_view: false,
          page_location: `${window.location.origin}${analyticsPath(window.location.pathname)}`,
          page_title: analyticsPath(window.location.pathname),
          page_referrer: document.referrer ? new URL(document.referrer).origin : "",
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        },
      });
      return { analytics, logEvent: sdk.logEvent };
    })
    .catch(() => null); // Blocked storage or analytics must never break the app.
}

/** Omit query strings, fragments and private conversation identifiers. */
export function analyticsPath(pathname: string) {
  return pathname.split(/[?#]/)[0].replace(/^\/chat\/[^/]+/, "/chat/[id]");
}

export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  const path = analyticsPath(window.location.pathname);
  const page = {
    page_location: `${window.location.origin}${path}`,
    page_referrer: document.referrer ? new URL(document.referrer).origin : "",
    page_title: path === "/" ? "mcprouter" : `${path} · mcprouter`,
  };
  void getAnalytics().then((sdk) => {
    if (!sdk) return;
    sdk.logEvent(sdk.analytics, name, { ...page, ...params });
  }).catch(() => {});
}

export function trackPageView(pathname: string) {
  if (typeof window === "undefined") return;
  const path = analyticsPath(pathname);
  trackEvent("page_view", {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: path === "/" ? "mcprouter" : `${path} · mcprouter`,
    page_referrer: document.referrer ? new URL(document.referrer).origin : "",
  });
}
