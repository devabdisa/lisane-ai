import type * as React from "react";
import { cn } from "@/lib/cn";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-label font-medium text-fg", className)} {...props} />;
}

function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-caption text-fg-muted", className)} {...props} />;
}

export { Label, FieldHint };
