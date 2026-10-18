import { services } from "@/generated/registry";
import { createServiceRoute } from "@/lib/mcp/handler";

export const maxDuration = 60;

/**
 * Every service on one endpoint: `/api/mcp/streamable`. It lists only
 * `search_tools`, `read_tool` and `use_tool`, so clients aren't handed the
 * whole catalogue; `?tools=all` lists every tool instead.
 */
const handler = createServiceRoute(() => services, { defaultToolMode: "search" });

export { handler as GET, handler as POST, handler as DELETE };
