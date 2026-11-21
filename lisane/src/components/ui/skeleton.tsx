import type * as React from "react";
import { cn } from "@/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-12 bg-field", className)} {...props} />;
}

export { Skeleton };
