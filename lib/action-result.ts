import { ZodError } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Runs a server action body and turns thrown errors into a message the dialog can show. */
export async function runAction<T>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
    if (error instanceof Error && error.message === "UNAUTHORIZED") return { ok: false, error: "Your session has expired. Sign in again." };
    if (error instanceof Error && error.message === "FORBIDDEN") return { ok: false, error: "You don't have permission to do that." };
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, error: "That item no longer exists." };
    console.error("[action]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
