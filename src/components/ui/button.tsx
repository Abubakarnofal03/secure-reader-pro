import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-md)] hover:bg-primary/90 hover:shadow-[var(--shadow-lg)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-md)] hover:bg-destructive/90",
        outline:
          "border-2 border-border bg-background hover:bg-secondary hover:border-primary/20 hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-sm)] hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-gradient-to-r from-[hsl(43_74%_49%)] to-[hsl(38_72%_55%)] text-[hsl(222_47%_11%)] shadow-[var(--shadow-gold)] hover:shadow-lg hover:from-[hsl(43_74%_52%)] hover:to-[hsl(38_72%_58%)]",
        "premium-outline": "border-2 border-[hsl(var(--gold))] text-[hsl(var(--gold))] bg-transparent hover:bg-[hsl(var(--gold)/0.1)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-md px-4 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
