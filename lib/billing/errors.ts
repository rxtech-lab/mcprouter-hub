/** rx-subscription refused a metered call. */
export class UsageLimitError extends Error {
  constructor(
    readonly item: string,
    /** `limit_exceeded`: the plan's allowance is used up. `insufficient_balance`: overage credits ran out. */
    readonly reason: "limit_exceeded" | "insufficient_balance",
    readonly used: number | null,
    readonly limit: number | null,
    readonly resetsAt: string | null = null,
  ) {
    super("USAGE_LIMIT_REACHED");
    this.name = "UsageLimitError";
  }
}
