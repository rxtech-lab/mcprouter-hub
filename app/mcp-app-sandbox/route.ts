/**
 * Sandbox proxy for MCP Apps, used by the chat's `experimental_MCPAppRenderer`.
 *
 * The chat frames this page, sends it the app HTML with
 * `ui/notifications/sandbox-resource-ready`, and this page renders that HTML in
 * an inner iframe with the app's CSP, then relays JSON-RPC between the two.
 * The inner frame never gets `allow-same-origin`, so app code runs in an opaque
 * origin with no access to this site's cookies or storage, whatever the host
 * asks for; and only the site's own pages may hand this page HTML to render.
 */

// When an app sends no CSP: inline code and data: images only, no network.
const DEFAULT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";

// Sandbox tokens an app may be given. allow-same-origin and top navigation are never passed on.
const ALLOWED_SANDBOX = ["allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox", "allow-modals"];

function hostOrigins(request: Request) {
  const origins = new Set([new URL(request.url).origin]);
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) origins.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  } catch {
    // An invalid site URL just isn't allowed to host apps.
  }
  return [...origins];
}

function page(hosts: string[]) {
  const config = JSON.stringify({ hosts, defaultCsp: DEFAULT_CSP, allowedSandbox: ALLOWED_SANDBOX }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>MCP App sandbox</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent}iframe{display:block;width:100%;height:100%;border:0;color-scheme:normal}</style>
</head>
<body>
<script>
(() => {
  const config = ${config};
  let inner = null;
  let host = null;

  const escapeAttribute = (text) => String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  function load(params) {
    const html = typeof params?.html === "string" ? params.html : "";
    const sandbox = String(params?.sandbox || "allow-scripts").split(/\\s+/).filter((token) => config.allowedSandbox.includes(token));
    const meta = '<meta http-equiv="Content-Security-Policy" content="' + escapeAttribute(params?.csp || config.defaultCsp) + '">';
    // The policy goes first in <head>, before anything in the app can run.
    const doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (tag) => tag + meta) : meta + html;
    inner?.remove();
    inner = document.createElement("iframe");
    inner.setAttribute("sandbox", sandbox.join(" "));
    inner.setAttribute("title", "MCP App");
    if (typeof params?.allow === "string" && params.allow) inner.setAttribute("allow", params.allow);
    inner.srcdoc = doc;
    document.body.appendChild(inner);
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source === window.parent) {
      if (!config.hosts.includes(event.origin) || message?.jsonrpc !== "2.0") return;
      host = event.origin;
      if (message.method === "ui/notifications/sandbox-resource-ready") load(message.params);
      else inner?.contentWindow?.postMessage(message, "*");
    } else if (inner && event.source === inner.contentWindow && host && message?.jsonrpc === "2.0") {
      window.parent.postMessage(message, host);
    }
  });

  // The host starts listening in an effect after it mounts this frame, so a cached copy of this page
  // can announce itself too early. Keep announcing until the app's HTML arrives.
  let announcements = 0;
  (function announce() {
    if (inner || announcements++ > 40) return;
    for (const origin of config.hosts) {
      window.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/sandbox-proxy-ready", params: {} }, origin);
    }
    setTimeout(announce, Math.min(50 * announcements, 500));
  })();
})();
</script>
</body>
</html>`;
}

export function GET(request: Request) {
  return new Response(page(hostOrigins(request)), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
