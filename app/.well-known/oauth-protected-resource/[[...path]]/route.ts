import { oauthOrigin, protectedResourceMetadata } from "@/lib/mcp/oauth";
import { corsPreflight, noStoreJson } from "@/lib/mcp/oauth-http";

/**
 * RFC 9728 metadata. `/.well-known/oauth-protected-resource/api/mcp/s/kmb/streamable`
 * describes that endpoint; the bare path describes the all-services one.
 */
export async function GET(request: Request, { params }: RouteContext<"/.well-known/oauth-protected-resource/[[...path]]">) {
  const { path = [] } = await params;
  return noStoreJson(protectedResourceMetadata(oauthOrigin(request), `/${path.join("/")}`));
}

export const OPTIONS = corsPreflight;
