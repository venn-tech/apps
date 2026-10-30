import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

// Variantes no padrão shadcn. "primary" = tinta; "brand" = ação (violeta); "mint" = destaque da landing; "danger" = destrutivo.
const variants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-canvas hover:bg-ink/85",
        brand: "bg-accent text-accent-fg hover:bg-accent/85",
        mint: "bg-mint font-semibold text-[#052e1f] hover:bg-mint/85",
        outline: "border border-line bg-surface text-ink hover:bg-subtle",
        secondary: "bg-subtle text-ink hover:bg-subtle/70",
        ghost: "text-ink hover:bg-subtle",
        danger: "bg-danger-soft text-danger hover:opacity-80",
        success: "bg-success-soft text-success hover:opacity-80",
      },
      size: { default: "", sm: "min-h-8 px-3 text-[13px]", lg: "min-h-11 px-6 text-sm", icon: "size-9 min-h-9 px-0" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp ref={ref} className={cn(variants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {asChild ? children : (<>{loading && <Loader2 className="animate-spin" aria-hidden />}{children}</>)}
    </Comp>
  );
});
Button.displayName = "Button";
