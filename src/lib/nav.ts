import {
  MessageSquare,
  Receipt,
  Users,
  Wallet,
  Settings,
  Info,
  ShieldCheck,
  Bell,
  HelpCircle,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      {
        label: "Chat",
        href: "/",
        icon: MessageSquare,
        description: "AI assistant",
      },
      {
        label: "Payments",
        href: "/payments",
        icon: Receipt,
        description: "Transaction history & status",
      },
      {
        label: "Recurring",
        href: "/recurring",
        icon: CalendarClock,
        description: "Scheduled & recurring payments",
      },
      {
        label: "Contacts",
        href: "/contacts",
        icon: Users,
        description: "Saved recipient address book",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Wallet",
        href: "/wallet",
        icon: Wallet,
        description: "Balances, networks & custom chains",
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "Alerts & payment updates",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Preferences & configuration",
      },
      {
        label: "Security",
        href: "/security",
        icon: ShieldCheck,
        description: "Audit logs & permissions",
      },
      {
        label: "About",
        href: "/about",
        icon: Info,
        description: "Project info & tech stack",
      },
      {
        label: "Help",
        href: "/help",
        icon: HelpCircle,
        description: "FAQ & support",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((i) => i.href === href);
}
