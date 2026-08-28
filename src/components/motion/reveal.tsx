"use client";

import {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./reveal.module.css";

type RevealPhase = "idle" | "pending" | "visible";
type RevealTag = "article" | "div" | "footer" | "li" | "nav" | "p" | "section" | "small";
type RevealVariant = "fade" | "left" | "mask" | "right" | "scale" | "up";

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: RevealTag;
  children: ReactNode;
  delay?: number;
  threshold?: number;
  variant?: RevealVariant;
};

export function Reveal({
  as = "div",
  children,
  className = "",
  delay = 0,
  style,
  threshold = 0.18,
  variant = "up",
  ...attributes
}: RevealProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const captureElement = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let observer: IntersectionObserver | undefined;
    const setupFrame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (reducedMotion.matches || !("IntersectionObserver" in window)) {
        setPhase("visible");
        return;
      }

      const bounds = element.getBoundingClientRect();
      const visiblePixels = Math.max(0, Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0));
      const visibleRatio = visiblePixels / Math.max(Math.min(bounds.height, window.innerHeight), 1);
      if (visibleRatio >= threshold) {
        setPhase("visible");
        return;
      }

      setPhase("pending");
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setPhase("visible");
          observer?.unobserve(element);
        },
        {
          rootMargin: "0px 0px -4% 0px",
          threshold,
        },
      );
      observer.observe(element);
    });

    return () => {
      window.cancelAnimationFrame(setupFrame);
      observer?.disconnect();
    };
  }, [threshold]);

  const revealStyle = {
    ...style,
    "--reveal-delay": `${Math.max(0, delay)}ms`,
  } as CSSProperties;
  const revealClassName = [
    styles.reveal,
    styles[variant],
    phase === "pending" ? styles.pending : "",
    phase === "visible" ? styles.visible : "",
    className,
  ].filter(Boolean).join(" ");
  const Element = as;

  return (
    <Element
      {...attributes}
      className={revealClassName}
      data-reveal-state={phase}
      data-reveal-variant={variant}
      ref={captureElement}
      style={revealStyle}
    >
      {children}
    </Element>
  );
}
