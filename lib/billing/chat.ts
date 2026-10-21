import "server-only";
import { createHash } from "node:crypto";
import { billingConfig } from "@/lib/billing/config";
import { debitBalance } from "@/lib/billing/subscription";

export class DuplicateChatMessageError extends Error {
  constructor() {
    super("This message has already been submitted. Send a new message to continue.");
  }
}

/** Every message must spend one chat credit, including plans with unlimited usage. */
export async function consumeChatMessage(input: { userId: string; messageId: string; channel: "web" | "telegram" | "whatsapp" }) {
  if (!billingConfig.enabled) return;
  // Stable across retries and surfaces, scoped to identity. Keep untrusted ids out of metadata.
  const key = createHash("sha256").update(JSON.stringify([input.userId, input.messageId])).digest("hex");
  const result = await debitBalance({
    rxlabUserId: input.userId,
    unit: billingConfig.chatCreditUnit,
    description: "Chat message",
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
    ? "You have no chat credits left. Top up at /billing to keep chatting."
    : "Chat billing is temporarily unavailable. Please try again shortly.";
}
