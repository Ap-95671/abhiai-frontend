"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import styles from "./image-lightbox.module.css";

type ImageLightboxProps = {
  children: ReactNode;
  open: boolean;
  title: string;
  onClose: () => void;
};

export function ImageLightbox({ children, open, title, onClose }: ImageLightboxProps) {
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])") ?? []);
      const first = focusable[0]; const last = focusable.at(-1);
      if (!first || !last) return event.preventDefault();
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeButton.current?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      queueMicrotask(() => previousFocus?.focus());
    };
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div aria-label={title} aria-modal="true" className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} ref={dialog} role="dialog">
      <div className={styles.content}>
        <button aria-label="Close image viewer" className={styles.close} onClick={onClose} ref={closeButton} type="button">×</button>
        <div className={styles.image}>{children}</div>
        <p>{title}</p>
      </div>
    </div>,
    document.body,
  );
}
