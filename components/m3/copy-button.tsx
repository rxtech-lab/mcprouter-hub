"use client";

import { Copy } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button, IconButton } from "./button";
import { useSnackbar } from "./snackbar";

export function useCopy() {
  const t = useT();
  const snackbar = useSnackbar();
  return async (value: string, what = t("Copied")) => {
    try {
      await navigator.clipboard.writeText(value);
      snackbar.show(t("{what} to the clipboard", { what }), { tone: "success" });
    } catch {
      snackbar.show(t("Could not copy. Select the text and copy it manually."), { tone: "error" });
    }
  };
}

export function CopyIconButton({ value, label, what }: { value: string; label?: string; what?: string }) {
  const t = useT();
  const copy = useCopy();
  return (
    <IconButton label={label ?? t("Copy")} onClick
={() => copy(value, what)}>
      <Copy size={18} />
    </IconButton>
  );
}

export function CopyButton({ value, children, what }: { value: string; children: React.ReactNode; what?: string }) {
  const copy = useCopy();
  return (
    <Button variant="tonal" icon={<Copy size={18} />} onClick={() => copy(value, what)}>
      {children}
    </Button>
  );
}
