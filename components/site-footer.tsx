import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-outline-variant">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 type-body-small text-on-surface-variant md:px-6">
        <span className="flex items-center gap-2">
          <Logo size={20} /> mcprouter
        </span>
        <nav className="flex gap-4">
          <Link href="/sources" className="hover:text-on-surface">Data sources</Link>
          <span>Data from DATA.GOV.HK and its providers.</span>
        </nav>
      </div>
    </footer>
  );
}
