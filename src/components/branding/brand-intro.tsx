"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import styles from "./brand-intro.module.css";

const INTRO_SESSION_KEY = "abhiai.brand-intro-played";

export function BrandIntro() {
  const [phase, setPhase] = useState<"hidden" | "enter" | "leave">("hidden");

  useEffect(() => {
    if (window.sessionStorage.getItem(INTRO_SESSION_KEY)) return;

    window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const enterTimer = window.setTimeout(() => setPhase("enter"), 0);
    const leaveTimer = window.setTimeout(() => setPhase("leave"), reducedMotion ? 450 : 1050);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), reducedMotion ? 720 : 1450);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div aria-hidden="true" className={`${styles.intro} ${phase === "leave" ? styles.leaving : ""}`}>
      <div className={styles.glow} />
      <div className={styles.identity}>
        <div className={styles.logo}>
          <Image alt="" height={112} priority src="/abhiai-logo.png" width={112} />
        </div>
        <span>AbhiAI</span>
      </div>
    </div>
  );
}
