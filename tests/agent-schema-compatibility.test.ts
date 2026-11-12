import { describe, expect, it } from "vitest";
import { z } from "zod";
import { uiSpecSchema } from "@/lib/agent/ui-catalog";
import { scriptSchema } from "@/lib/tasks/definition";

describe("agent schema compatibility", () => {
  it("omits unsupported propertyNames from UI and workflow schemas", () => {
    for (const schema of [uiSpecSchema, scriptSchema]) {
      expect(JSON.stringify(z.toJSONSchema(schema))).not.toContain('"propertyNames"');
    }
  });

  it("preserves arbitrary nested tool arguments", () => {
    const steps = [{ tool: "example", arguments: { arbitrary: { nested: [1, true, null] } } }];
    expect(scriptSchema.parse(steps)).toEqual(steps);
  });
});
