import { AccountMenu } from "@/components/account-menu";
import { AppShell } from "@/components/app-shell";
import { requirePageUser, signOut } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return <AppShell account={<AccountMenu name={user.name} email={user.email} signOut={user.isDevelopmentBypass ? undefined : logout} />}>{children}</AppShell>;
}
