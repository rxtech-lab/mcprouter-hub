"use client";

import { Copy } from "lucide-react";
import { Button, IconButton } from "./button";
import { useSnackbar } from "./snackbar";

export function useCopy() {
  const snackbar = useSnackbar();
  return async (value: string, what = "Copied") => {
    try {
      await navigator.clipboard.writeText(value);
      snackbar.show(`${what} to the clipboard`, { tone: "success" });
    } catch {
      snackbar.show("Could not copy. Select the text and copy it manually.", { tone: "error" });
    }
  };
}

export function CopyIconButton({ value, label = "Copy", what }: { value: string; label?: string; what?: string }) {
  const copy = useCopy();
  return (
    <IconButton label={label} onClick={() => copy(value, what)}>
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
