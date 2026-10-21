import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
    <SiteHeader active="guides" />
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-20 md:px-6">{children}</main>
    <SiteFooter />
  </div>;
}
