"use server";

import { runAction } from "@/lib/action-result";
import { currentFreeChatQuota } from "@/lib/free-chat";

export async function getFreeChatQuota() {
  return runAction(() => currentFreeChatQuota());
}
