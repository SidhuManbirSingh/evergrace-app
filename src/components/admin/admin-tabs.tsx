"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/reports", label: "Reports & Impact" },
  { href: "/admin/videos", label: "Videos" },
  { href: "/admin/content/calendar", label: "Content Calendar" },
  { href: "/admin/users", label: "Members" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="no-print mb-7 mt-6 flex flex-wrap gap-2.5 border-b-2 border-line"
    >
      {TABS.map((tab) => {
        const isCalendar = pathname.startsWith("/admin/content/calendar");
        const active =
          tab.href === "/admin/content/calendar"
            ? isCalendar
            : tab.href === "/admin/content"
              ? !isCalendar && (pathname === "/admin/content" || pathname.startsWith("/admin/content/"))
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-0.5 border-b-[3px] px-[22px] py-3.5 font-bold text-[1.08em]",
              active ? "border-accent text-accent-dark" : "border-transparent text-muted",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sub-tab row shared by the Videos and Content sections. */
export function SubTabs({
  tabs,
}: {
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <div className="no-print mb-5 flex flex-wrap gap-2.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "min-h-touch rounded-full border-2 px-5 py-2.5 font-bold",
            tab.active
              ? "border-accent bg-accent text-white"
              : "border-line text-muted hover:bg-accent-soft",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
