"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/campingplaetze", label: "Campingplätze" },
  { href: "/ladepunkte", label: "Ladepunkte" },
  { href: "/routenplaner", label: "Route planen" },
  { href: "/community", label: "Community" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        className="rounded-md border border-black/10 p-2 dark:border-white/10"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          {open ? (
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-black/10 bg-background px-4 py-3 dark:border-white/10">
          <ul className="flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
