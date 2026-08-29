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

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div aria-label={title} aria-modal="true" className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="dialog">
      <div className={styles.content}>
        <button aria-label="Close image viewer" className={styles.close} onClick={onClose} ref={closeButton} type="button">×</button>
        <div className={styles.image}>{children}</div>
        <p>{title}</p>
      </div>
    </div>,
    document.body,
  );
}
