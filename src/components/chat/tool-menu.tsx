"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

import styles from "./tool-menu.module.css";

export type UploadPurpose = "image" | "document" | "pdf";

type ToolMenuProps = {
  disabled?: boolean;
  onGenerateImage: () => void;
  onUpload: (file: File, purpose: UploadPurpose) => void;
};

export function ToolMenu({ disabled = false, onGenerateImage, onUpload }: ToolMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectFile(input: HTMLInputElement | null) {
    setOpen(false);
    input?.click();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, purpose: UploadPurpose) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUpload(file, purpose);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open AI tools"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        ＋
      </button>
      {open && (
        <div aria-label="AI tools" className={styles.menu} role="menu">
          <ToolItem detail="JPEG, PNG, or WebP" icon="▧" label="Upload image" onClick={() => selectFile(imageInputRef.current)} />
          <ToolItem detail="PDF or plain text" icon="▤" label="Upload document" onClick={() => selectFile(documentInputRef.current)} />
          <ToolItem detail="Extract or OCR a PDF" icon="⌕" label="Scan / analyze PDF" onClick={() => selectFile(pdfInputRef.current)} />
          <ToolItem detail="Create an image from a prompt" icon="✦" label="Generate image" onClick={() => { setOpen(false); onGenerateImage(); }} />
          <ToolItem detail="More tools coming soon" disabled icon="•••" label="More tools" onClick={() => undefined} />
        </div>
      )}
      <input accept="image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={(event) => handleFile(event, "image")} ref={imageInputRef} type="file" />
      <input accept="application/pdf,text/plain,.pdf,.txt" className={styles.fileInput} onChange={(event) => handleFile(event, "document")} ref={documentInputRef} type="file" />
      <input accept="application/pdf,.pdf" className={styles.fileInput} onChange={(event) => handleFile(event, "pdf")} ref={pdfInputRef} type="file" />
    </div>
  );
}

function ToolItem({ detail, disabled = false, icon, label, onClick }: { detail: string; disabled?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button className={styles.item} disabled={disabled} onClick={onClick} role="menuitem" type="button">
      <span aria-hidden="true" className={styles.icon}>{icon}</span>
      <span className={styles.copy}><strong>{label}</strong><small>{detail}</small></span>
    </button>
  );
}
