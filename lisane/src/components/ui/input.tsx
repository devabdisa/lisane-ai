import type * as React from "react";
import { cn } from "@/lib/cn";

const fieldClassName =
  "w-full min-h-12 rounded-12 border border-line bg-field p-3 text-body text-fg transition-[border-color] duration-200 ease-out placeholder:text-fg-muted focus:border-2 focus:border-fg focus:p-[11px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-fg";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClassName, className)} {...props} />;
}

export { Input, fieldClassName };
