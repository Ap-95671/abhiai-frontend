"use client";

import { useEffect, useRef } from "react";

import styles from "./scroll-motion.module.css";

const MOBILE_BREAKPOINT = 620;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ScrollMotion() {
  const progressRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const progress = progressRef.current;
    const navbar = document.querySelector<HTMLElement>("[data-scroll-navbar]");
    const parallaxLayers = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function render() {
      frame = 0;
      const scrollableHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const pageProgress = clamp(window.scrollY / scrollableHeight, 0, 1);
      progress?.style.setProperty("--scroll-progress", `${pageProgress}`);
      navbar?.toggleAttribute("data-scrolled", window.scrollY > 28);

      const simplifyMotion = reducedMotion.matches || window.innerWidth <= MOBILE_BREAKPOINT;
      if (simplifyMotion) {
        parallaxLayers.forEach((layer) => layer.style.setProperty("--parallax-y", "0px"));
        return;
      }

      const viewportHeight = window.innerHeight;
      const positions = parallaxLayers.map((layer) => {
        const bounds = layer.getBoundingClientRect();
        const distance = Number(layer.dataset.parallax) || 16;
        const sectionProgress = clamp(
          (viewportHeight - bounds.top) / (viewportHeight + bounds.height),
          0,
          1,
        );
        return { layer, offset: (sectionProgress - 0.5) * distance * 2 };
      });

      positions.forEach(({ layer, offset }) => {
        layer.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
      });
    }

    function requestRender() {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    }

    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    reducedMotion.addEventListener("change", requestRender);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      reducedMotion.removeEventListener("change", requestRender);
    };
  }, []);

  return <span aria-hidden="true" className={styles.progress} ref={progressRef} />;
}
