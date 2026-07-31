import { CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon =
          variant === "success"
            ? CheckCircle2
            : variant === "destructive"
              ? AlertCircle
              : null
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 items-start">
              {Icon ? (
                <Icon
                  className={
                    variant === "success"
                      ? "mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      : "mt-0.5 h-5 w-5 shrink-0 text-destructive-foreground"
                  }
                  aria-hidden
                />
              ) : null}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
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
