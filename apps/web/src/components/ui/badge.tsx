import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground bg-paper",
        accent: "border-transparent bg-terracotta/10 text-terracotta-dark",
        sage: "border-transparent bg-sage/12 text-sage",
        amber: "border-transparent bg-amber/15 text-[#8a6a22]",
        clay: "border-transparent bg-clay/12 text-clay",
        slate: "border-transparent bg-slate/15 text-[#56606b]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
