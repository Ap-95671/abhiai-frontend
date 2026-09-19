"use client";

import { Children, isValidElement, type SelectHTMLAttributes, type ReactElement, ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const menuId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    items?.[initialFocus.current === "last" ? items.length - 1 : 0]?.focus();
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function handleMenuKeys(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (!items.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectFile(input: HTMLInputElement | null) {
    closeMenu();
    input?.click();
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, purpose: UploadPurpose) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onUpload(file, purpose);
  }

  return (
    <div className={styles.root} ref={rootRef} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        ref={triggerRef}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open AI tools"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => { initialFocus.current = "first"; setOpen((current) => !current); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }
        }}
        title="Open AI tools"
        type="button"
      >
        <AppIcon name="plus" />
      </button>
      {open && (
        <div aria-label="AI tools" className={styles.menu} id={menuId} onKeyDown={handleMenuKeys} ref={menuRef} role="menu">
          <ToolItem detail="JPEG, PNG, or WebP · up to 5 MB" icon={<AppIcon name="image" />} label="Upload image" onClick={() => selectFile(imageInputRef.current)} />
          <ToolItem detail="Extract text or OCR · up to 10 MB" icon={<AppIcon name="document" />} label="Upload PDF" onClick={() => selectFile(pdfInputRef.current)} />
          <ToolItem detail="UTF-8 plain text · up to 10 MB" icon={<AppIcon name="article" />} label="Upload text file" onClick={() => selectFile(textInputRef.current)} />
          <ToolItem detail="Create an image from a prompt" icon={<AppIcon name="image" />} label="Generate image" onClick={() => { closeMenu(); onGenerateImage(); }} />
          <ToolItem detail="Not available yet" disabled icon={<AppIcon name="more" />} label="More tools" onClick={() => undefined} />
        </div>
      )}
      <input accept="image/jpeg,image/png,image/webp" className={styles.fileInput} onChange={(event) => handleFile(event, "image")} ref={imageInputRef} type="file" />
      <input accept="text/plain,.txt" className={styles.fileInput} onChange={(event) => handleFile(event, "document")} ref={textInputRef} type="file" />
      <input accept="application/pdf,.pdf" className={styles.fileInput} onChange={(event) => handleFile(event, "pdf")} ref={pdfInputRef} type="file" />
    </div>
  );
}

function ToolItem({ detail, disabled = false, icon, label, onClick }: { detail: string; disabled?: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={styles.item} disabled={disabled} onClick={onClick} role="menuitem" tabIndex={-1} type="button">
      <span aria-hidden="true" className={styles.icon}>{icon}</span>
      <span className={styles.copy}><strong>{label}</strong><small>{detail}</small></span>
    </button>
  );
}


type SelectControlProps = SelectHTMLAttributes<HTMLSelectElement>;

// Select presentation extends the existing tools-menu panel and icon primitives.
// The native select retains the form value and original React change handler.
export function SelectControl({ children, className = "", id, disabled, ...props }: SelectControlProps) {
  const generatedId = useId();
  const listId = `${generatedId}-choices`;
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ left: 0, top: 0, width: 240, maxHeight: 280 });
  const options = Children.toArray(children).filter(isValidElement).map(child => {
    const option = child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>;
    return { value: String(option.props.value ?? Children.toArray(option.props.children).join("")), label: Children.toArray(option.props.children).join(""), disabled: option.props.disabled };
  });
  const value = String(props.value ?? props.defaultValue ?? options[0]?.value ?? "");
  const selected = options.find(option => option.value === value);
  const label = props["aria-label"];

  function close() { setOpen(false); trigger.current?.focus(); }
  function show() {
    if (disabled) return;
    const bounds = trigger.current!.getBoundingClientRect();
    const width = Math.min(Math.max(bounds.width, 260), innerWidth - 24);
    const below = innerHeight - bounds.bottom - 16;
    const above = bounds.top - 16;
    const height = Math.min(280, Math.max(below, above));
    setPlacement({ left: Math.max(12, Math.min(bounds.left, innerWidth - width - 12)), top: below >= Math.min(200, above) ? bounds.bottom + 6 : Math.max(12, bounds.top - height - 6), width, maxHeight: height });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const current = list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)')
      ?? list.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
    current?.focus();
    const dismiss = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const reposition = () => setOpen(false);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", reposition);
    return () => { document.removeEventListener("pointerdown", dismiss); window.removeEventListener("resize", reposition); };
  }, [open]);
  function choose(next: string) {
    const element = native.current;
    if (!element) return;
    element.value = next;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    close();
  }
  return <span className={`${styles.selectRoot} ${className}`} ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button aria-label={label} aria-labelledby={props["aria-labelledby"]} aria-controls={open ? listId : undefined} aria-expanded={open} aria-haspopup="listbox" aria-required={props.required} className={styles.selectTrigger} disabled={disabled} id={id} onClick={() => open ? close() : show()} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); show(); }
    }} ref={trigger} role="combobox" type="button"><span>{selected?.label ?? value}</span><AppIcon name="chevron-down" /></button>
    <select {...props} aria-hidden="true" aria-label={undefined} className={styles.nativeSelect} disabled={disabled} ref={native} tabIndex={-1}>{children}</select>
    {open && <span aria-label={label ?? "Options"} aria-labelledby={props["aria-labelledby"]} className={`${styles.menu} ${styles.selectList}`} id={listId} ref={list} role="listbox" style={placement} onKeyDown={event => {
      if (event.key === "Escape" || event.key === "Tab") { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); } close(); return; }
      const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
      if (!items.length) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      let next = current;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else if (event.key === "ArrowDown") next = (current + 1) % items.length;
      else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
      else if (event.key.length === 1 && event.key !== " ") next = items.findIndex((item, index) => index > current && item.textContent?.toLowerCase().startsWith(event.key.toLowerCase()));
      else return;
      event.preventDefault(); items[next]?.focus();
    }}>{options.map(option => <button aria-selected={option.value === value} className={styles.selectOption} disabled={option.disabled} key={option.value} onClick={() => choose(option.value)} role="option" tabIndex={-1} type="button">{option.label}<span aria-hidden="true">{option.value === value ? "✓" : ""}</span></button>)}</span>}
  </span>;
}
