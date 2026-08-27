"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";

import styles from "./theme-toggle.module.css";

const THEME_STORAGE_KEY = "abhiai.theme";
const THEME_CHANGE_EVENT = "abhiai:theme-change";

type Theme = "dark" | "light";

type ThemeToggleProps = {
  compact?: boolean;
  menuItem?: boolean;
};

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ compact = false, menuItem = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    queueMicrotask(() => setTheme(currentTheme));

    function syncTheme(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = event.newValue === "light" ? "light" : "dark";
      applyTheme(nextTheme);
      setTheme(nextTheme);
    }

    function syncThemeControl(event: Event) {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      setTheme(nextTheme);
    }

    window.addEventListener("storage", syncTheme);
    window.addEventListener(THEME_CHANGE_EVENT, syncThemeControl);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener(THEME_CHANGE_EVENT, syncThemeControl);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still applies for this session if storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: nextTheme }));
  }

  const nextThemeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      aria-label={nextThemeLabel}
      aria-pressed={theme === "light"}
      className={`${styles.toggle} ${compact ? styles.compact : ""} ${menuItem ? styles.menuItem : ""}`}
      onClick={toggleTheme}
      role={menuItem ? "menuitem" : undefined}
      title={nextThemeLabel}
      type="button"
    >
      <AppIcon name={theme === "dark" ? "sun" : "moon"} />
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
