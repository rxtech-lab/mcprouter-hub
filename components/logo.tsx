import Image from "next/image";
import { cn } from "./m3/cn";

/**
 * The mcprouter mark: interlocking routes forming an abstract m.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/icon-v2.webp"
      width={size}
      height={size}
      alt="mcprouter"
      className={cn("shrink-0 rounded-[24%]", className)}
    />
  );
}
