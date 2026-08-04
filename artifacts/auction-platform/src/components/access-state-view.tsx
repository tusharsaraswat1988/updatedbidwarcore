import { AlertCircle, Lock, LogIn, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AccessStateCode = 401 | 403 | 404 | 503;

const COPY: Record<
  AccessStateCode,
  { title: string; body: string; next: string; icon: typeof AlertCircle }
> = {
  401: {
    title: "Session expired",
    body: "Your session has expired.",
    next: "Please sign in again.",
    icon: LogIn,
  },
  403: {
    title: "Access denied",
    body: "You don't have permission to access this tournament.",
    next: "Sign in with the organizer account that owns this tournament, or contact your tournament administrator.",
    icon: ShieldOff,
  },
  404: {
    title: "Not found",
    body: "Tournament not found.",
    next: "Check the link and try again, or contact your tournament administrator.",
    icon: AlertCircle,
  },
  503: {
    title: "Unavailable",
    body: "Scoring is currently unavailable.",
    next: "Please contact your tournament administrator.",
    icon: Lock,
  },
};

export function AccessStateView({
  code,
  title,
  body,
  next,
  actionLabel,
  onAction,
}: {
  code: AccessStateCode;
  title?: string;
  body?: string;
  next?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const fallback = COPY[code];
  const Icon = fallback.icon;
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-3 items-start">
            <Icon className="h-7 w-7 text-destructive shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-2 min-w-0">
              <h1 className="text-xl font-semibold text-foreground">
                {title ?? fallback.title}
              </h1>
              <p className="text-sm text-muted-foreground">{body ?? fallback.body}</p>
              <p className="text-sm text-muted-foreground">{next ?? fallback.next}</p>
            </div>
          </div>
          {actionLabel && onAction ? (
            <Button type="button" className="w-full" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
