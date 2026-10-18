"use client";

import { Link2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/m3/button";

export function LinkButtons() {
  const { pending, data } = useFormStatus();
  const choice = data?.get("decision");
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="submit" name="decision" value="cancel" variant="text" disabled={pending} className="h-12">
        {pending && choice === "cancel" ? "Cancelling…" : "Cancel"}
      </Button>
      <Button type="submit" name="decision" value="link" icon={<Link2 size={18} />} disabled={pending} className="h-12 px-8">
        {pending && choice === "link" ? "Linking…" : "Link number"}
      </Button>
    </div>
  );
}
