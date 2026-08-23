"use client";

import Image from "next/image";
import { CSSProperties, FormEvent, PointerEvent, useRef, useState } from "react";

import styles from "./auth-screen.module.css";

export type AuthScreenMode = "login" | "register";

type AuthScreenProps = {
  authError: string;
  displayName: string;
  email: string;
  isAuthenticating: boolean;
  mode: AuthScreenMode;
  password: string;
  rememberMe: boolean;
  onBack: () => void;
  onDisplayNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onModeChange: (mode: AuthScreenMode) => void;
  onPasswordChange: (value: string) => void;
  onRememberMeChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthScreen(props: AuthScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [activeField, setActiveField] = useState<"name" | "email" | null>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const animationFrame = useRef<number | null>(null);

  function trackPointer(event: PointerEvent<HTMLElement>) {
    if (passwordFocused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    if (animationFrame.current) window.cancelAnimationFrame(animationFrame.current);
    animationFrame.current = window.requestAnimationFrame(() => setGaze({ x, y }));
  }

  const mascotStyle = { "--gaze-x": `${gaze.x * 5}px`, "--gaze-y": `${gaze.y * 4}px` } as CSSProperties;

  return (
    <main className={styles.page} onPointerMove={trackPointer}>
      <button className={styles.back} onClick={props.onBack} type="button">← Back to AbhiAI</button>
      <section className={styles.stage}>
        <div aria-hidden="true" className={`${styles.mascot} ${styles.mascotOne} ${passwordFocused ? styles.private : ""} ${activeField ? styles.attentive : ""}`} style={mascotStyle}>
          <span className={styles.antenna} /><div className={styles.face}><i /><i /><b /></div><span className={styles.hands}><i /><i /></span>
        </div>
        <div aria-hidden="true" className={`${styles.mascot} ${styles.mascotTwo} ${passwordFocused ? styles.private : ""} ${activeField ? styles.attentive : ""}`} style={mascotStyle}>
          <span className={styles.antenna} /><div className={styles.face}><i /><i /><b /></div><span className={styles.hands}><i /><i /></span>
        </div>
        <div aria-hidden="true" className={`${styles.mascot} ${styles.mascotThree} ${passwordFocused ? styles.private : ""}`} style={mascotStyle}>
          <div className={styles.face}><i /><i /><b /></div><span className={styles.hands}><i /><i /></span>
        </div>

        <section className={styles.panel}>
          <div className={styles.identity}><span><Image alt="AbhiAI" height={68} priority src="/abhiai-logo.png" width={68} /></span><b>AbhiAI</b></div>
          <p className={styles.kicker}>{props.mode === "login" ? "WELCOME BACK" : "JOIN THE NETWORK"}</p>
          <h1>{props.mode === "login" ? "Continue your thinking." : "Create your AbhiAI space."}</h1>
          <p className={styles.intro}>{props.mode === "login" ? "Your assistant, ideas, and network are ready when you are." : "One account for intelligent assistance, creation, and connection."}</p>

          <div className={styles.tabs} role="tablist" aria-label="Authentication">
            <button aria-selected={props.mode === "login"} className={props.mode === "login" ? styles.active : ""} onClick={() => props.onModeChange("login")} role="tab" type="button">Sign in</button>
            <button aria-selected={props.mode === "register"} className={props.mode === "register" ? styles.active : ""} onClick={() => props.onModeChange("register")} role="tab" type="button">Create account</button>
          </div>

          <form className={styles.form} onSubmit={props.onSubmit}>
            {props.mode === "register" && <label>Full name<input autoComplete="name" onBlur={() => setActiveField(null)} onChange={(event) => props.onDisplayNameChange(event.target.value)} onFocus={() => setActiveField("name")} required value={props.displayName} /></label>}
            <label>Email<input autoComplete="email" onBlur={() => setActiveField(null)} onChange={(event) => props.onEmailChange(event.target.value)} onFocus={() => setActiveField("email")} required type="email" value={props.email} /></label>
            <label>Password<div className={styles.passwordField}><input autoComplete={props.mode === "login" ? "current-password" : "new-password"} minLength={8} onBlur={() => setPasswordFocused(false)} onChange={(event) => props.onPasswordChange(event.target.value)} onFocus={() => {setPasswordFocused(true);setActiveField(null);}} required type={showPassword ? "text" : "password"} value={props.password} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? "Hide" : "Show"}</button></div></label>
            <div className={styles.formMeta}>
              <label className={styles.remember}><input checked={props.rememberMe} onChange={(event) => props.onRememberMeChange(event.target.checked)} type="checkbox" /> Remember me</label>
              <span title="Password recovery will be available soon">Forgot password?</span>
            </div>
            {passwordFocused && <p className={styles.privacyNote}>The mascots look away while you enter your password.</p>}
            {props.authError && <p className={styles.error} role="alert">{props.authError}</p>}
            <button className={styles.submit} disabled={props.isAuthenticating} type="submit"><span>{props.isAuthenticating ? "Connecting…" : props.mode === "login" ? "Sign in" : "Create account"}</span><b>{props.isAuthenticating ? "· · ·" : "→"}</b></button>
          </form>

          <button aria-disabled="true" className={styles.google} disabled type="button"><span>G</span> Continue with Google <small>Coming soon</small></button>
          <p className={styles.switchMode}>{props.mode === "login" ? "New to AbhiAI?" : "Already have an account?"} <button onClick={() => props.onModeChange(props.mode === "login" ? "register" : "login")} type="button">{props.mode === "login" ? "Create an account" : "Sign in"}</button></p>
        </section>
      </section>
    </main>
  );
}
