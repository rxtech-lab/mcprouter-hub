import "server-only";
import { createHash } from "node:crypto";
import { billingConfig } from "@/lib/billing/config";
import { recordUsage } from "@/lib/billing/subscription";

export class DuplicateChatMessageError extends Error {
  constructor() {
    super("This message has already been submitted. Send a new message to continue.");
  }
}

/** RxSubscription enforces the user's actual chat allowance and configured overage policy. */
export async function consumeChatMessage(input: { userId: string; messageId: string; channel: "web" | "telegram" | "whatsapp" }) {
  if (!billingConfig.enabled) return;
  // Stable across retries and surfaces, scoped to identity. Keep untrusted ids out of metadata.
  const key = createHash("sha256").update(JSON.stringify([input.userId, input.messageId])).digest("hex");
  const result = await recordUsage({
    rxlabUserId: input.userId,
    item: billingConfig.chatUsageItem,
    amount: 1,
    idempotencyKey: `chat:${key}`,
    metadata: { channel: input.channel },
  });
  // Reusing a message id must not allow another model run without consuming a unit.
  if (result.duplicate) throw new DuplicateChatMessageError();
  return result;
}

export function chatBillingMessage(error: unknown) {
  if (error instanceof DuplicateChatMessageError) return error.message;
  return error instanceof Error && error.message === "USAGE_LIMIT_REACHED"
    ? "Your chat allowance is used up. Review your usage and plan at /billing."
    : "Chat billing is temporarily unavailable. Please try again shortly.";
}
