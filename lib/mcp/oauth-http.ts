import { OAuthError } from "@/lib/mcp/oauth";

const MAX_BODY_BYTES = 16_384;

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, mcp-protocol-version",
};

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("pragma", "no-cache");
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return Response.json(body, { ...init, headers });
}

export function corsPreflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Runs an OAuth endpoint and turns errors into RFC 6749 error bodies. Never logs codes or tokens. */
export async function oauthResponse(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof OAuthError) {
      return noStoreJson({ error: error.code, error_description: error.message }, { status: error.status });
    }
    console.error("[oauth] request failed", (error as Error).message);
    return noStoreJson({ error: "server_error", error_description: "Could not complete the request." }, { status: 500 });
  }
}

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new OAuthError("invalid_request", "Request too large.", 413);
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new OAuthError("invalid_request", "Request too large.", 413);
  return text;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return JSON.parse(await readBody(request));
  } catch (error) {
    if (error instanceof OAuthError) throw error;
    throw new OAuthError("invalid_client_metadata", "Client metadata must be JSON.");
  }
}

export async function readForm(request: Request) {
  const type = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/x-www-form-urlencoded") {
    throw new OAuthError("invalid_request", "Send the request as application/x-www-form-urlencoded.", 415);
  }
  const params = new URLSearchParams(await readBody(request));
  for (const name of new Set(params.keys())) {
    if (params.getAll(name).length > 1) throw new OAuthError("invalid_request", `Repeated parameter: ${name}.`);
  }
  return params;
}

export function required(params: URLSearchParams, name: string) {
  const value = params.get(name);
  if (!value || value.length > 4096) throw new OAuthError("invalid_request", `${name} is required.`);
  return value;
}

/** Public clients send `client_id` in the body; some also send it as the Basic username with no password. */
export function clientIdFrom(request: Request, params: URLSearchParams) {
  const fromBody = params.get("client_id");
  if (fromBody) return fromBody;
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const id = decodeURIComponent(decoded.split(":", 1)[0] ?? "");
    if (id) return id;
  }
  throw new OAuthError("invalid_client", "client_id is required.", 401);
}
