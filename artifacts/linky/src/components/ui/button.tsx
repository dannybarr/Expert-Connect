import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-bold tracking-tight " +
  "border-[2.5px] border-db-ink disabled:pointer-events-none disabled:opacity-50 " +
  "transition-[transform,box-shadow] duration-100 ease-out " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-db-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-db-bg " +
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-db-cobalt text-db-cream shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)]",
        destructive:
          "bg-db-coral text-db-ink shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)]",
        outline:
          "bg-transparent text-db-ink shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)]",
        secondary:
          "bg-db-bg-alt text-db-ink shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[6px_6px_0_var(--db-ink)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)]",
        ink:
          "bg-db-ink text-db-cream shadow-[5px_5px_0_var(--db-ink)] hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--db-ink)]",
        ghost:
          "border-transparent shadow-none text-db-ink hover:bg-db-bg-alt",
        link: "border-transparent shadow-none text-db-cobalt underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 text-[15px] rounded-[16px]",
        sm: "h-9 px-4 text-sm rounded-[10px]",
        lg: "h-14 px-8 text-base rounded-[16px]",
        icon: "h-10 w-10 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
