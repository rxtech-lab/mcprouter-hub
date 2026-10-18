import { ArrowLeftRight, Ban, MessageCircle, ReceiptText, Unlink } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/m3/button";
import { getCurrentUser } from "@/lib/auth";
import { findLink, maskedNumber, readLinkToken } from "@/lib/whatsapp/link";
import { confirmWhatsAppLink } from "./actions";
import { LinkButtons } from "./link-buttons";

export const metadata = { title: "Link WhatsApp", robots: { index: false, follow: false } };

/** Opened from the sign-in link the WhatsApp bot sends: signs the user in, then asks to link the number. */
export default async function LinkWhatsAppPage({ searchParams }: PageProps<"/whatsapp/link">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : null;
  const claims = readLinkToken(value);

  if (!claims) {
    return (
      <Shell>
        <span className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <Ban size={24} />
        </span>
        <h1 className="mt-6 type-headline-small">This link has expired</h1>
        <p className="mt-2 type-body-large text-on-surface-variant">
          Links from the WhatsApp bot work for 30 minutes. Send the bot any message to get a new one.
        </p>
        <ButtonLink href="/dashboard" variant="tonal" className="mt-8 self-start">Go to dashboard</ButtonLink>
      </Shell>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/whatsapp/link?${new URLSearchParams({ token: value! })}` })}`);

  const number = maskedNumber(claims.phoneHint);
  const existing = await findLink(claims.phoneHash);
  if (existing?.userId === user.id) {
    return (
      <Shell>
        <Header />
        <h1 className="mt-6 type-headline-small">WhatsApp {number} is already linked</h1>
        <p className="mt-2 type-body-large text-on-surface-variant">Go back to WhatsApp and ask away.</p>
        <ButtonLink href="/keys/whatsapp" variant="tonal" className="mt-8 self-start">Manage linked numbers</ButtonLink>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header />
      <h1 className="mt-6 type-headline-small">
        Link WhatsApp <span className="text-primary">{number}</span> to your account?
      </h1>
      <p className="mt-2 type-body-large text-on-surface-variant">
        Signed in as <span className="text-on-surface">{user.email || user.name}</span>.
      </p>

      <ul className="stagger mt-6 flex flex-col gap-4 rounded-md bg-surface-container-low p-4">
        <li className="flex items-start gap-3 type-body-medium">
          <ReceiptText size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>The bot answers as you. Its tool calls count against your plan, the same as the agent on the web.</span>
        </li>
        <li className="flex items-start gap-3 type-body-medium">
          <Unlink size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            {existing ? "This number is linked to another account now; linking moves it to yours. " : ""}
            Unlink it any time under API keys → WhatsApp.
          </span>
        </li>
      </ul>

      <form action={confirmWhatsAppLink} className="mt-8">
        <input type="hidden" name="token" value={value!} />
        <LinkButtons />
      </form>
    </Shell>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3 text-on-surface-variant" aria-hidden>
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <MessageCircle size={22} />
      </span>
      <ArrowLeftRight size={18} />
      <Logo size={48} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <section className="flex w-full max-w-lg animate-page-in flex-col rounded-xl bg-surface-container-lowest p-6 shadow-elevation-1 sm:p-10">
        {children}
      </section>
    </main>
  );
}
