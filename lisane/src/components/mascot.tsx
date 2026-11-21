import { cn } from "@/lib/cn";

// Placeholder until the Lisane mascot art exists. Drawn on the accent-host
// surface so the lime features stay on Midnight in both themes.
function Mascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden
      className={cn("size-24 shrink-0", className)}
    >
      <circle cx="48" cy="48" r="47" className="fill-accent-host stroke-line" strokeWidth="2" />
      <circle cx="35" cy="42" r="6" className="fill-accent" />
      <circle cx="61" cy="42" r="6" className="fill-accent" />
      <path
        d="M34 60C38 66 58 66 62 60"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-accent"
      />
    </svg>
  );
}

export { Mascot };
