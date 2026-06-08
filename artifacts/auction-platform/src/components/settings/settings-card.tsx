import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsCardProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

export function SettingsCard({
  title,
  description,
  icon,
  children,
  className,
  contentClassName,
  headerClassName,
}: SettingsCardProps) {
  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      {title ? (
        <CardHeader className={cn("pb-3 pt-4 px-4 sm:px-5", headerClassName)}>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {description ? <CardDescription className="text-xs leading-relaxed">{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(title ? "px-4 sm:px-5 pb-4 sm:pb-5 space-y-3" : "p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
