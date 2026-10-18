import { registerClient } from "@/lib/mcp/oauth";
import { corsPreflight, noStoreJson, oauthResponse, readJson } from "@/lib/mcp/oauth-http";

/** RFC 7591 dynamic client registration, for public clients only. */
export async function POST(request: Request) {
  return oauthResponse(async () => noStoreJson(await registerClient(await readJson(request)), { status: 201 }));
}

export const OPTIONS = corsPreflight;
