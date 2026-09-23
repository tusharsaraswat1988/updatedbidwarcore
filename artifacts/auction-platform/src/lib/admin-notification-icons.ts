import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Gavel,
  Headphones,
  HelpCircle,
  Printer,
  Settings,
  ShieldCheck,
  Trophy,
  UserPlus,
} from "lucide-react";
import type { AdminNotificationCategory } from "@/lib/admin-notifications";

const CATEGORY_ICONS: Record<AdminNotificationCategory, LucideIcon> = {
  License: ShieldCheck,
  Registration: UserPlus,
  Tournament: Trophy,
  Contact: HelpCircle,
  Auction: Gavel,
  Payment: CreditCard,
  Support: Headphones,
  Printer: Printer,
  System: Settings,
};

export function getNotificationCategoryIcon(
  category: AdminNotificationCategory | undefined,
): LucideIcon {
  return CATEGORY_ICONS[category ?? "System"] ?? Settings;
}
