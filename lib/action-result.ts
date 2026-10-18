import { ZodError } from "zod";
import { getT } from "@/lib/i18n/server";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Runs a server action body and turns thrown errors into a message the dialog can show. */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    const t = await getT();
    if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? t("Invalid input") };
    if (error instanceof Error && error.message === "UNAUTHORIZED") return { ok: false, error: t("Your session has expired. Sign in again.") };
    if (error instanceof Error && error.message === "FORBIDDEN") return { ok: false, error: t("You don't have permission to do that.") };
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, error: t("That item no longer exists.") };
    console.error("[action]", error);
    return { ok: false, error: t("Something went wrong. Please try again.") };

  }
}
