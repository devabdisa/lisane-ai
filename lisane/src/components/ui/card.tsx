import type * as React from "react";
import { cn } from "@/lib/cn";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4 rounded-16 border border-line bg-card p-6 text-fg", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-label font-semibold text-fg", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-caption text-fg-muted", className)} {...props} />;
}

export { Card, CardTitle, CardDescription };
