import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SourcesLayout({ children }: LayoutProps<"/sources">) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-on-surface">
      <SiteHeader active="sources" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-20 md:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
