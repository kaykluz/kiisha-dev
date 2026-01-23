import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors duration-100 overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 text-primary",
        secondary:
          "border-transparent bg-muted text-muted-foreground",
        destructive:
          "border-transparent bg-destructive/15 text-destructive",
        outline:
          "border-border text-muted-foreground bg-transparent",
        success:
          "border-transparent bg-success/15 text-success",
        warning:
          "border-transparent bg-warning/15 text-warning",
        info:
          "border-transparent bg-info/15 text-info",
        // Project lifecycle status variants
        prospecting:
          "border-transparent bg-pink-500/15 text-pink-400",
        development:
          "border-transparent bg-amber-500/15 text-amber-400",
        construction:
          "border-transparent bg-orange-500/15 text-orange-400",
        operational:
          "border-transparent bg-green-500/15 text-green-400",
        feasibility:
          "border-transparent bg-slate-500/15 text-slate-400",
        cod:
          "border-transparent bg-teal-500/15 text-teal-400",
        ntp:
          "border-transparent bg-blue-500/15 text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
