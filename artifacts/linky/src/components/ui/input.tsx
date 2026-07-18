import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[16px] border-[2.5px] border-db-ink bg-db-bg px-4 py-2",
          "font-body text-base text-db-ink shadow-[3px_3px_0_var(--db-ink)]",
          "placeholder:text-db-mute file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:outline-none focus-visible:shadow-[5px_5px_0_var(--db-cobalt),5px_5px_0_2.5px_var(--db-ink)]",
          "transition-shadow duration-100 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
