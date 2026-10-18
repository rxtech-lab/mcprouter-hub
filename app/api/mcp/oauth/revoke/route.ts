import { revokeToken } from "@/lib/mcp/oauth";
import { clientIdFrom, CORS_HEADERS, corsPreflight, oauthResponse, readForm, required } from "@/lib/mcp/oauth-http";

/** RFC 7009 token revocation. Revoking either token ends the whole grant. */
export async function POST(request: Request) {
  return oauthResponse(async () => {
    const params = await readForm(request);
    await revokeToken(required(params, "token"), clientIdFrom(request, params));
    return new Response(null, { status: 200, headers: { ...CORS_HEADERS, "cache-control": "no-store" } });
  });
}

export const OPTIONS = corsPreflight;
