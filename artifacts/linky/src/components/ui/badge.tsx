import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap border-[2.5px] border-db-ink rounded-full px-3 py-1 " +
  "font-mono text-[11px] font-semibold uppercase tracking-[0.08em] " +
  "shadow-[3px_3px_0_var(--db-ink)] focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-db-cobalt text-db-cream",
        secondary: "bg-db-bg text-db-ink",
        destructive: "bg-db-coral text-db-ink",
        outline: "bg-db-bg text-db-ink",
        ink: "bg-db-ink text-db-bg",
        honey: "bg-db-honey text-db-ink",
        forest: "bg-db-forest text-db-cream",
        flat: "bg-db-bg text-db-ink shadow-none",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
