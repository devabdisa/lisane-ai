import type * as React from "react";
import { cn } from "@/lib/cn";
import { fieldClassName } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClassName, "min-h-24 resize-none", className)} {...props} />;
}

export { Textarea };
