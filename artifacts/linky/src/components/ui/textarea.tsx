import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-[16px] border-[2.5px] border-db-ink bg-db-bg px-4 py-3",
        "font-body text-base text-db-ink shadow-[3px_3px_0_var(--db-ink)]",
        "placeholder:text-db-mute",
        "focus-visible:outline-none focus-visible:shadow-[5px_5px_0_var(--db-cobalt),5px_5px_0_2.5px_var(--db-ink)]",
        "transition-shadow duration-100 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
