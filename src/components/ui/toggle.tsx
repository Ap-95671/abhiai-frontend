"use client";

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

// The existing memory switch, extracted for other boolean settings to reuse.
export function Toggle({ checked, disabled = false, label, onCheckedChange }: ToggleProps) {
  return (
    <button aria-checked={checked} aria-label={label} className="toggle-control" disabled={disabled}
      onClick={() => onCheckedChange(!checked)} role="switch" type="button">
      <span aria-hidden="true" className="toggle-track"><span className="toggle-thumb" /></span>
      <span aria-hidden="true" className="toggle-state">{checked ? "On" : "Off"}</span>
    </button>
  );
}
