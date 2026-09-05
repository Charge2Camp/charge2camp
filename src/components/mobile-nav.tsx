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
        className="flex h-11 w-11 items-center justify-center rounded-md border border-black/10 dark:border-white/10"
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
        <>
          {/* Unsichtbarer Hintergrund, damit ein Tap ausserhalb des Menues
              (nicht nur ein Tap auf einen Link) es ebenfalls schliesst --
              ohne :hover ist das auf einem Touchscreen der einzige Weg,
              "daneben tippen" zu erkennen. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <nav className="absolute inset-x-0 top-full z-50 border-b border-black/10 bg-background px-2 py-2 dark:border-white/10">
            <ul className="flex flex-col text-base">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center rounded-md px-3 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
