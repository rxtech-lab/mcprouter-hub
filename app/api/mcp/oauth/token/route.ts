import { exchangeCode, exchangeRefresh, findClient, OAuthError, oauthOrigin } from "@/lib/mcp/oauth";
import { clientIdFrom, corsPreflight, noStoreJson, oauthResponse, readForm, required } from "@/lib/mcp/oauth-http";

/** Exchanges an authorization code (with its PKCE verifier) or rotates a refresh token. */
export async function POST(request: Request) {
  return oauthResponse(async () => {
    const params = await readForm(request);
    const clientId = clientIdFrom(request, params);
    if (!(await findClient(clientId))) throw new OAuthError("invalid_client", "Unknown client. Register it again.", 401);
    const origin = oauthOrigin(request);
    const resource = params.get("resource");
    const grantType = required(params, "grant_type");
    if (grantType === "authorization_code") {
      return noStoreJson(
        await exchangeCode({
          code: required(params, "code"),
          clientId,
          redirectUri: required(params, "redirect_uri"),
          verifier: required(params, "code_verifier"),
          resource,
          origin,
        }),
      );
    }
    if (grantType === "refresh_token") {
      return noStoreJson(await exchangeRefresh({ token: required(params, "refresh_token"), clientId, resource, origin }));
    }
    throw new OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  });
}

export const OPTIONS = corsPreflight;
