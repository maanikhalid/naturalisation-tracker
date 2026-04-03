"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark-mode", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark-mode", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button type="button" className="govuk-button govuk-button--secondary" onClick={toggle}>
      {dark ? "Switch to light mode" : "Switch to dark mode"}
    </button>
  );
}
