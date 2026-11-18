"use client";

import { ArrowRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IntroArtwork } from "@/components/intro/intro-art";
import { Button, ButtonLink } from "@/components/m3/button";
import { Badge } from "@/components/m3/chip";
import { cn } from "@/components/m3/cn";
import { Dialog } from "@/components/m3/dialog";
import { useT } from "@/lib/i18n/client";
import type { IntroCard } from "@/lib/intro-cards";
import { markIntroRead } from "./actions";

/**
 * Tutorial and new-feature cards, one at a time. Each card the user pages to counts as read once the
 * dialog closes, so it isn't shown again; cards they never reached come back next time.
 */
type IntroDialogProps = {
  cards: IntroCard[];
  /** The whole tour, opened on request: closing it counts every card as read. */
  replay?: boolean;
};

export function IntroDialog({ cards, replay = false }: IntroDialogProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(cards.length > 0);
  const [index, setIndex] = useState(0);
  const seen = useRef(new Set<string>(cards[0] ? [cards[0].id] : []));
  const card = cards[index];
  if (!card) return null;

  const goTo = (next: number) => {
    seen.current.add(cards[next].id);
    setIndex(next);
  };
  /** `leaving` when a card's link is taking the user to another page, so there is no URL to tidy. */
  const close = (leaving = false) => {
    setOpen(false);
    const saved = markIntroRead({ ids: replay ? cards.map((item) => item.id) : [...seen.current] });
    // Drop `?intro=…` so a reload doesn't reopen it, once the reads are stored so the page doesn't list them as unread.
    if (!leaving && window.location.search) void saved.then(() => router.replace(pathname, { scroll: false }));
  };
  const last = index === cards.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t(card.title)}
      className="w-[min(600px,calc(100vw-32px))]"
      actions={
        <>
          {index > 0 ? (
            <Button variant="text" onClick={() => goTo(index - 1)}>{t("Back")}</Button>
          ) : cards.length > 1 ? (
            <Button variant="text" onClick={() => close()}>{t("Skip")}</Button>
          ) : null}
          {card.action ? (
            <ButtonLink href={card.action.href} variant="tonal" onClick={() => close(true)}>
              {t(card.action.label)}
            </ButtonLink>
          ) : null}
          {last ? (
            <Button onClick={() => close()}>{t("Done")}</Button>
          ) : (
            <Button onClick={() => goTo(index + 1)} icon={<ArrowRight size={18} />} className="flex-row-reverse pr-4 pl-6">
              {t("Next")}
            </Button>
          )}
        </>
      }
    >
      {/* Keyed so each card fades through and its illustration restarts from the first frame. */}
      <div key={card.id} className="flex flex-col gap-4 animate-fade-through" data-testid="intro-card">
        <IntroArtwork art={card.art} />
        <div className="flex flex-col gap-2">
          <Badge tone={card.kind === "feature" ? "primary" : "neutral"} className="self-start">{card.kind === "feature" ? t("New feature") : t("Tutorial")}</Badge>
          <p className="type-body-large text-on-surface-variant">{t(card.description)}</p>
        </div>
        {card.points ? (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {card.points.map((point) => (
              <div key={point.title}>
                <dt className="type-title-small">{t(point.title)}</dt>
                <dd className="type-body-small text-on-surface-variant">{t(point.body)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {cards.length > 1 ? (
        <div className="flex justify-center gap-1.5 pt-4" aria-label={t("Card {index} of {count}", { index: index + 1, count: cards.length })} role="img">
          {cards.map((item, dot) => (
            <span key={item.id} className={cn("h-2 rounded-full transition-[width,background-color] duration-300 ease-emphasized", dot === index ? "w-6 bg-primary" : "w-2 bg-outline-variant")} />
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
