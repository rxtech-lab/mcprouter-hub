"use client";

import { LogIn } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/m3/button";
import { Dialog } from "@/components/m3/dialog";
import { SnackbarProvider } from "@/components/m3/snackbar";
import { useT } from "@/lib/i18n/client";

type Props = {
  name: string;
  /** Already translated by the caller. */
  kind: string;
  signInHref: string;
  /** Server-rendered setup steps. */
  children: ReactNode;
};

/** Setup preview for signed-out visitors. Opened by `?client=<id>`; closing drops the param. */
export function ClientSetupDialog({ name, kind, signInHref, children }: Props) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();

  function close() {
    setOpen(false);
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  // The landing page has no app shell, so the copy buttons need their own snackbar host.
  return (
    <SnackbarProvider>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t("Set up {name}", { name })}
        description={t("{kind}. Sign in first so mcprouter can approve access, then follow these steps.", { kind })}
        className="w-[min(640px,calc(100vw-32px))]"
        actions={
          <>
            <Button variant="text" onClick={close}>
              {t("Close")}
            </Button>
            <ButtonLink href={signInHref} icon={<LogIn size={18} />}>
              {t("Sign in to continue")}
            </ButtonLink>
          </>
        }
      >
        {children}
      </Dialog>
    </SnackbarProvider>
  );
}
