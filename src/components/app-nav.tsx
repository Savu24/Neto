"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/config";
import { AssetsIcon, DashboardIcon, GoalsIcon, MoreIcon, PlusIcon, SettingsIcon } from "./icons";

type Item = { href: string; label: MessageKey<"nav">; Icon: ComponentType<SVGProps<SVGSVGElement>> };

const main: Item[] = [
  { href: "/dashboard", label: "dashboard", Icon: DashboardIcon },
  { href: "/assets", label: "assets", Icon: AssetsIcon },
  { href: "/goals", label: "goals", Icon: GoalsIcon },
  { href: "/settings", label: "settings", Icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pasek boczny od 1024 px, dolny pasek poniżej. Te same pozycje w obu (SPEC sekcja 6). */
export function AppNav() {
  const t = useT("nav");
  const tc = useT("common");
  const pathname = usePathname();
  const current = (href: string) => (isActive(pathname, href) ? ("page" as const) : undefined);

  return (
    <>
      <nav
        aria-label={t("mainNavigation")}
        className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface px-3.5 py-5 lg:flex"
      >
        <Link href="/dashboard" className="px-2.5 pb-4 text-[22px] font-bold tracking-tight text-brand">
          {tc("appName")}
        </Link>
        {main.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={current(href)}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-ink-2 hover:bg-bg aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand"
          >
            <Icon />
            {t(label)}
          </Link>
        ))}
        <Link
          href="/add"
          className="mt-3.5 flex items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand"
        >
          <PlusIcon width={18} height={18} />
          {t("add")}
        </Link>
      </nav>

      <nav
        aria-label={t("mainNavigation")}
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 items-end border-t border-line bg-surface px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] lg:hidden"
      >
        {[main[0], main[1]].map(({ href, label, Icon }) => (
          <BottomLink key={href} href={href} label={t(label)} current={current(href)}>
            <Icon width={24} height={24} />
          </BottomLink>
        ))}
        <Link href="/add" aria-label={t("add")} className="flex justify-center">
          <span className="-mt-4.5 grid size-12 place-items-center rounded-full bg-brand text-on-brand">
            <PlusIcon width={24} height={24} />
          </span>
        </Link>
        <BottomLink href="/goals" label={t("goals")} current={current("/goals")}>
          <GoalsIcon width={24} height={24} />
        </BottomLink>
        <BottomLink href="/settings" label={t("more")} current={current("/settings")}>
          <MoreIcon width={24} height={24} />
        </BottomLink>
      </nav>
    </>
  );
}

function BottomLink({
  href,
  label,
  current,
  children,
}: {
  href: string;
  label: string;
  current: "page" | undefined;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current}
      className="flex flex-col items-center gap-0.5 py-1 text-[11px] text-ink-3 aria-[current=page]:font-semibold aria-[current=page]:text-brand"
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}
