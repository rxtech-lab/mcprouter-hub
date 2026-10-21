import { ArrowLeft } from "lucide-react";
import Link from "@/components/localized-link";

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="state-layer -ml-3 mb-4 inline-flex h-10 items-center gap-2 rounded-full px-3 type-label-large text-primary">
      <ArrowLeft size={18} /> {children}
    </Link>
  );
}
