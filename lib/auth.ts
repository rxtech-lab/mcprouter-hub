import NextAuth, { type NextAuthResult } from "next-auth";
import { connection, type NextMiddleware } from "next/server";
import { createRxLabAuth, type RxLabAuthResult } from "@rxtech-lab/authjs-rxlab";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const rxLabConfigured = Boolean(
  process.env.AUTH_ISSUER &&
  process.env.AUTH_CLIENT_ID &&
  process.env.AUTH_CLIENT_SECRET &&
  process.env.AUTH_SECRET,
);

const authResult = rxLabConfigured
  ? createRxLabAuth({
      issuer: process.env.AUTH_ISSUER!,
      clientId: process.env.AUTH_CLIENT_ID!,
      clientSecret: process.env.AUTH_CLIENT_SECRET!,
      signInPage: "/login",
      trustHost: true,
    })
  : NextAuth({ providers: [], trustHost: true, secret: process.env.AUTH_SECRET ?? "local-development-only-secret-change-me" });

function hasRxLabProxy(result: NextAuthResult): result is RxLabAuthResult {
  return "proxy" in result;
}

export const { handlers, signIn, signOut, auth } = authResult;

/**
 * Auth.js's no-argument `auth()` refreshes the access token but never copies the
 * rotated session cookie onto an RSC response. Running this wrapped handler from
 * `proxy.ts` forces Auth.js's request/response path, which persists the cookie.
 */
export const proxy = (hasRxLabProxy(authResult)
  ? authResult.proxy
  : authResult.auth(() => undefined)) as NextMiddleware;

export type AppUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  isDevelopmentBypass?: boolean;
};

export const isDevelopmentBypass =
  process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true";

export const DEVELOPMENT_USER: AppUser = {
  id: "local-development-user",
  name: "Local developer",
  email: "developer@local.test",
  roles: ["user", "admin"],
  isDevelopmentBypass: true,
};

export const ADMIN_ROLE = "admin";

/** Tracker statuses are shared project state, so only admins may change them. */
export function isAdmin(user: Pick<AppUser, "roles">) {
  return user.roles.includes(ADMIN_ROLE);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  // Always per request, even when no session cookie is read (bypass or unconfigured auth),
  // so pages that depend on the user are never prerendered.
  await connection();
  if (isDevelopmentBypass) return DEVELOPMENT_USER;
  if (!rxLabConfigured) return null;
  // A cookie-free visitor cannot have an Auth.js browser session. Avoid
  // initializing auth while rendering the public page and its shared header.
  if (!(await headers()).has("cookie")) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "Member",
    email: session.user.email ?? "",
    roles: session.user.roles ?? [],
  };
}

export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions: throws instead of redirecting, so the caller can show the error. */
export async function requireActionUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export const authStatus = {
  configured: rxLabConfigured,
  developmentBypass: isDevelopmentBypass,
};
