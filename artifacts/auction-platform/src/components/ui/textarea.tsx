import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlClass } from "@/components/ui/field-control"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full px-3.5 py-2.5 text-base md:text-sm",
        fieldControlClass,
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
