import { CheckCircle2, AlertCircle } from "lucide-react"
import { TOAST_DURATION_DEFAULT, useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={TOAST_DURATION_DEFAULT} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, variant, duration, ...props }) {
        const Icon =
          variant === "success"
            ? CheckCircle2
            : variant === "destructive"
              ? AlertCircle
              : null
        const descStr = typeof description === "string" ? description.trim() : ""
        const compact = Boolean(title && descStr && descStr.length <= 48)

        return (
          <Toast key={id} variant={variant} duration={duration} {...props}>
            <div className="flex gap-2 items-start min-w-0 flex-1">
              {Icon ? (
                <Icon
                  className={
                    variant === "success"
                      ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"
                      : "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive-foreground"
                  }
                  aria-hidden
                />
              ) : null}
              {compact ? (
                <p className="text-xs leading-snug min-w-0">
                  <span className="font-semibold text-foreground">{title}</span>
                  {description ? (
                    <span className="text-muted-foreground group-[.success]:text-emerald-100/80 group-[.destructive]:text-destructive-foreground/85">
                      {" · "}
                      {description}
                    </span>
                  ) : null}
                </p>
              ) : (
                <div className="grid gap-0.5 min-w-0">
                  {title ? <ToastTitle>{title}</ToastTitle> : null}
                  {description ? <ToastDescription>{description}</ToastDescription> : null}
                </div>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
