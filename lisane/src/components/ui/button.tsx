import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-4 rounded-full p-3 text-label font-semibold transition-[background-color,border-color,opacity] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      hierarchy: {
        primary: "bg-action text-on-action hover:opacity-90",
        secondary: "border border-line text-fg hover:bg-field",
      },
      width: {
        auto: "px-6",
        full: "w-full",
      },
    },
    defaultVariants: {
      hierarchy: "primary",
      width: "auto",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  hierarchy,
  width,
  asChild = false,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ hierarchy, width }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
