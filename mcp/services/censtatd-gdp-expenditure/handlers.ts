import type { ResponseTransformer } from "@/lib/mcp/types";
import { normalizeGdpTable } from "../censtatd-gdp/handlers";

/** Same official GDP observation format; table-specific inputs live in YAML. */
export const normalizeExpenditureTable: ResponseTransformer = normalizeGdpTable;
