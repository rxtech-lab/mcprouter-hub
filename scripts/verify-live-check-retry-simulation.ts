/** Run with the Postman live-check-retry simulation listening on port 4917. */
import assert from "node:assert/strict";
import { services } from "@/generated/registry";
import { executeTool } from "@/lib/mcp/runtime";
import { retryCheck } from "./live-check-retry";

const original = services.find((service) => service.id === "td-carpark")!;
const service = { ...original, baseUrl: "http://127.0.0.1:4917/td/v1", cacheTtl: 0 };
const tool = service.tools.find((tool) => tool.name === "carpark_info")!;
const onRetry = (attempt: number) => console.log(`Retry after attempt ${attempt}`);
const recovered = await retryCheck(() => executeTool(service, tool, { vehicleTypes: "privateCar", lang: "en" }), { attempts: 3, delayMs: 2000, onRetry });
assert.equal(recovered.attempts, 3);
assert.equal((recovered.value.data as Array<{ park_Id: string }>)[0].park_Id, "simulation-only");
let failures = 0;
await assert.rejects(retryCheck(() => executeTool(service, tool, { vehicleTypes: "HGV", lang: "en" }), { attempts: 3, delayMs: 2000, onRetry: () => { failures++; } }), /503/);
assert.equal(failures, 2);
console.log("PASS: real carpark executor recovered on attempt 3; persistent 503 exhausted 3 attempts.");
