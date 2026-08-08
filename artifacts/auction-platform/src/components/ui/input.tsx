import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlClass, fieldControlSizeClass } from "@/components/ui/field-control"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          fieldControlClass,
          fieldControlSizeClass,
          "py-1",
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
