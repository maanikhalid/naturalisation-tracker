"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/submit", label: "Submit" },
  { href: "/data", label: "Data explorer" },
  { href: "/about", label: "About" },
  { href: "/contributors", label: "Contributors" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="govuk-header app-site-header" role="banner">
      <div className="govuk-width-container app-site-header__inner">
        <Link
          href="/"
          className="govuk-header__link govuk-header__link--service-name app-site-header__title"
        >
          Naturalisation Tracker
        </Link>
        <div className="app-site-header__actions">
          <Link href="/submit" className="govuk-button app-site-header__submit-button">
            Submit your timeline
          </Link>
          <div className="app-site-header__menu-wrap" ref={wrapRef}>
            <button
              type="button"
              className="govuk-button govuk-button--secondary app-site-header__menu-button"
              aria-expanded={open}
              aria-haspopup="true"
              aria-controls="site-header-menu"
              id="site-header-menu-button"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
            {open ? (
              <ul
                id="site-header-menu"
                className="app-site-header__dropdown"
                role="menu"
                aria-labelledby="site-header-menu-button"
              >
                {NAV_LINKS.map(({ href, label }) => (
                  <li key={href} className="app-site-header__dropdown-item" role="none">
                    <Link
                      href={href}
                      className="govuk-link app-site-header__dropdown-link"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
