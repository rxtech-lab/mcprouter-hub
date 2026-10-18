"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./config";

/** Saves the language picked in the language menu for a year; the caller refreshes to re-render in it. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) throw new Error(`Unsupported locale: ${locale}`);
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
