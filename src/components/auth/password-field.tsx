"use client";

import { FocusEvent, useEffect, useState } from "react";

import styles from "./auth-screen.module.css";

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  onChange: (value: string) => void;
  onFocusChange: (active: boolean) => void;
  onVisibilityChange: (visible: boolean) => void;
  onVisibilityHoverChange: (hovering: boolean) => void;
  value: string;
};

export function PasswordField({
  autoComplete,
  onChange,
  onFocusChange,
  onVisibilityChange,
  onVisibilityHoverChange,
  value,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    onVisibilityChange(showPassword);
  }, [onVisibilityChange, showPassword]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      onFocusChange(false);
      onVisibilityHoverChange(false);
    }
  }

  return (
    <div className={styles.passwordGroup}>
      <label className={styles.passwordLabel} htmlFor="auth-password">Password</label>
      <div
        className={styles.passwordField}
        onBlur={handleBlur}
        onFocusCapture={() => onFocusChange(true)}
      >
        <input
          autoComplete={autoComplete}
          id="auth-password"
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          required
          type={showPassword ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
          onMouseEnter={() => onVisibilityHoverChange(true)}
          onMouseLeave={() => onVisibilityHoverChange(false)}
          type="button"
        >
          <EyeIcon hidden={showPassword} />
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
      {hidden && <path className={styles.eyeSlash} d="m4 4 16 16" />}
    </svg>
  );
}
