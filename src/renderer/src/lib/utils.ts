import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type scale lives in styles.css @theme; without it tailwind-merge reads `text-hint` as a colour
// and drops it against `text-ink-2`.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["label", "hint", "meta", "body", "lead", "title-s", "title", "display"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
