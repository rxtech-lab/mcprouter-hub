import Link from "@/components/localized-link";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export async function SiteFooter() {
  const t = await getT();
  return (
    <footer className="border-t border-outline-variant">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 type-body-small text-on-surface-variant md:px-6">
        <span className="flex items-center gap-2">
          <Logo size={20} /> mcprouter · <a href="https://rxlab.app" className="hover:text-on-surface">RxLab</a>
        </span>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/sources" className="hover:text-on-surface">{t("Data sources")}</Link>
          <Link href="/guides" className="hover:text-on-surface">{t("Setup guides")}</Link>
          <a href="mailto:support@rxlab.app" className="hover:text-on-surface">support@rxlab.app</a>
          <span>{t("Data from DATA.GOV.HK and its providers.")}</span>
        </nav>
      </div>
    </footer>
  );
}
