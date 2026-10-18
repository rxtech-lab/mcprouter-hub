"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Button } from "@/components/m3/button";
import { Dialog } from "@/components/m3/dialog";

/** One API's details. Opened by `?api=<id>`; closing goes back to the list with the same filters. */
export function ApiDialog({ title, description, closeHref, actions, children }: { title: string; description: ReactNode; closeHref: string; actions?: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [, startTransition] = useTransition();

  function close() {
    setOpen(false);
    startTransition(() => router.replace(closeHref, { scroll: false }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title={title}
      description={description}
      className="w-[min(600px,calc(100vw-32px))]"
      actions={
        <>
          <Button variant="text" onClick={close}>
            Close
          </Button>
          {actions}
        </>
      }
    >
      {children}
    </Dialog>
  );
}
