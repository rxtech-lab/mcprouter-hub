"use client";

import { Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/m3/button";
import { useT } from "@/lib/i18n/client";

export function DecisionButtons() {
  const { pending, data } = useFormStatus();
  const choice = data?.get("decision");
  const t = useT();
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="submit" name="decision" value="deny" variant="text" disabled={pending} className="h-12">
        {pending && choice === "deny" ? t("Cancelling…") : t("Cancel")}
      </Button>
      <Button type="submit" name="decision" value="allow" icon={<Check size={18} />} disabled={pending} className="h-12 px-8">
        {pending && choice === "allow" ? t("Connecting…") : t("Allow")}
      </Button>
    </div>
  );
}
