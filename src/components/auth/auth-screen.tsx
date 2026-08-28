"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { AuthCharacters, AuthFocusTarget, CharacterAnimationState } from "./auth-characters";
import { PasswordField } from "./password-field";
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

function subscribeToCharacterBreakpoint(onStoreChange: () => void) {
  const query = window.matchMedia("(min-width: 601px)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function characterBreakpointSnapshot() {
  return window.matchMedia("(min-width: 601px)").matches;
}

function characterBreakpointServerSnapshot() {
  return false;
}

export function AuthScreen(props: AuthScreenProps) {
  const [introActive, setIntroActive] = useState(true);
  const [characterEntranceComplete, setCharacterEntranceComplete] = useState(false);
  const [errorReaction, setErrorReaction] = useState(false);
  const [focusTarget, setFocusTarget] = useState<AuthFocusTarget>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [eyeHover, setEyeHover] = useState(false);
  const [pointerTracking, setPointerTracking] = useState(false);
  const animationFrame = useRef<number | null>(null);
  const characterScene = useRef<HTMLDivElement | null>(null);
  const pointerTrackingActive = useRef(false);
  const charactersEnabled = useSyncExternalStore(
    subscribeToCharacterBreakpoint,
    characterBreakpointSnapshot,
    characterBreakpointServerSnapshot,
  );

  useEffect(() => {
    const introTimer = window.setTimeout(() => setIntroActive(false), 1150);
    const entranceTimer = window.setTimeout(() => setCharacterEntranceComplete(true), 2750);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(entranceTimer);
      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  useEffect(() => {
    const startTimer = window.setTimeout(() => setErrorReaction(Boolean(props.authError)), 0);
    const finishTimer = props.authError
      ? window.setTimeout(() => setErrorReaction(false), 1550)
      : undefined;

    return () => {
      window.clearTimeout(startTimer);
      if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    };
  }, [props.authError]);

  useEffect(() => {
    if (
      !charactersEnabled
      || !characterEntranceComplete
      || window.matchMedia("(pointer: coarse)").matches
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (focusTarget || passwordVisible || props.isAuthenticating) return;

      const scene = characterScene.current;
      if (!scene) return;

      if (!pointerTrackingActive.current) {
        pointerTrackingActive.current = true;
        setPointerTracking(true);
      }

      const bounds = scene.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height * 0.42;
      const horizontalRange = event.clientX >= centerX
        ? Math.max(window.innerWidth - centerX, 1)
        : Math.max(centerX, 1);
      const verticalRange = event.clientY >= centerY
        ? Math.max(window.innerHeight - centerY, 1)
        : Math.max(centerY, 1);
      const x = (event.clientX - centerX) / horizontalRange;
      const y = (event.clientY - centerY) / verticalRange;

      if (animationFrame.current !== null) window.cancelAnimationFrame(animationFrame.current);
      animationFrame.current = window.requestAnimationFrame(() => {
        scene.style.setProperty("--purple-gaze-x", `${x * 4.8}px`);
        scene.style.setProperty("--purple-gaze-y", `${y * 3.5}px`);
        scene.style.setProperty("--dark-gaze-x", `${x * 5.4}px`);
        scene.style.setProperty("--dark-gaze-y", `${y * 3.9}px`);
        scene.style.setProperty("--orange-gaze-x", `${x * 3.2}px`);
        scene.style.setProperty("--orange-gaze-y", `${y * 2.4}px`);
        scene.style.setProperty("--yellow-eye-x", `${x * 3.3}px`);
        scene.style.setProperty("--yellow-eye-y", `${y * 2.2}px`);
        scene.style.setProperty("--body-tilt", `${x * 1.2}deg`);
        const upward = Math.max(0, -y);
        const downward = Math.max(0, y);
        const sideways = Math.abs(x);

        scene.style.setProperty("--purple-shift-x", `${x * 30}px`);
        scene.style.setProperty("--purple-shift-y", `${y * (y < 0 ? 20 : 9)}px`);
        scene.style.setProperty("--purple-scale-x", `${1 + sideways * 0.08 - upward * 0.035}`);
        scene.style.setProperty("--purple-scale-y", `${1 + upward * 0.24 - downward * 0.1}`);
        scene.style.setProperty("--dark-shift-x", `${x * 22}px`);
        scene.style.setProperty("--dark-shift-y", `${y * (y < 0 ? 16 : 8)}px`);
        scene.style.setProperty("--dark-scale-x", `${1 + sideways * 0.06}`);
        scene.style.setProperty("--dark-scale-y", `${1 + upward * 0.17 - downward * 0.07}`);
        scene.style.setProperty("--orange-shift-x", `${x * 20}px`);
        scene.style.setProperty("--orange-shift-y", `${y * 7}px`);
        scene.style.setProperty("--orange-scale-x", `${1 + sideways * 0.13 + downward * 0.05}`);
        scene.style.setProperty("--orange-scale-y", `${1 + upward * 0.1 - downward * 0.12}`);
        scene.style.setProperty("--yellow-shift-x", `${x * 17}px`);
        scene.style.setProperty("--yellow-shift-y", `${y * (y < 0 ? 13 : 7)}px`);
        scene.style.setProperty("--yellow-scale-y", `${1 + upward * 0.13 - downward * 0.06}`);
      });
    }

    function handleWindowBlur() {
      pointerTrackingActive.current = false;
      setPointerTracking(false);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [characterEntranceComplete, charactersEnabled, focusTarget, passwordVisible, props.isAuthenticating]);

  function focusField(field: Exclude<AuthFocusTarget, null>) {
    pointerTrackingActive.current = false;
    setPointerTracking(false);
    setFocusTarget(field);
  }

  function blurField() {
    setFocusTarget(null);
  }

  const isLogin = props.mode === "login";
  const characterState: CharacterAnimationState = !characterEntranceComplete
    ? "entrance"
    : passwordVisible
      ? "password-visible"
      : errorReaction
        ? "error"
        : props.isAuthenticating
          ? "submitting"
        : eyeHover
          ? "eye-hover"
          : focusTarget === "password"
            ? "password-masked"
            : focusTarget === "email" || focusTarget === "name"
              ? props.email.trim().length > 0
                ? "email-typing"
                : "email"
              : pointerTracking
                ? "cursor"
                : "idle";

  return (
    <main className={styles.page}>
      {introActive && (
        <div aria-hidden="true" className={styles.introOverlay}>
          <Image alt="" className={styles.introLogo} height={84} priority src="/abhiai-logo.png" width={84} />
        </div>
      )}

      <div className={styles.utilityBar}>
        <button className={styles.back} onClick={props.onBack} type="button">
          <span aria-hidden="true">←</span> Back to AbhiAI
        </button>
        <ThemeToggle compact />
      </div>

      <section
        aria-label={isLogin ? "Sign in to AbhiAI" : "Create an AbhiAI account"}
        className={styles.authCard}
      >
        <aside className={styles.illustrationPanel}>
          {charactersEnabled && !introActive && <AuthCharacters ref={characterScene} state={characterState} />}
        </aside>

        <section className={styles.formPanel}>
          <div className={styles.formContent}>
            <div className={styles.formLogo}>
              <Image alt="AbhiAI" height={46} priority src="/abhiai-logo.png" width={46} />
            </div>
            <h1>{isLogin ? "Welcome back!" : "Create your account"}</h1>
            <p className={styles.intro}>
              {isLogin
                ? "Please enter your details to continue your work."
                : "Set up one account for AI assistance, creation, and connection."}
            </p>

            <form className={styles.form} onSubmit={props.onSubmit}>
              {props.mode === "register" && (
                <label className={styles.fieldLabel} htmlFor="auth-name">
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    id="auth-name"
                    onBlur={blurField}
                    onChange={(event) => props.onDisplayNameChange(event.target.value)}
                    onFocus={() => focusField("name")}
                    required
                    value={props.displayName}
                  />
                </label>
              )}

              <label className={styles.fieldLabel} htmlFor="auth-email">
                <span>Email address</span>
                <input
                  autoComplete="email"
                  id="auth-email"
                  onBlur={blurField}
                  onChange={(event) => props.onEmailChange(event.target.value)}
                  onFocus={() => focusField("email")}
                  required
                  type="email"
                  value={props.email}
                />
              </label>

              <PasswordField
                autoComplete={isLogin ? "current-password" : "new-password"}
                onChange={props.onPasswordChange}
                onFocusChange={(active) => active ? focusField("password") : blurField()}
                onVisibilityChange={setPasswordVisible}
                onVisibilityHoverChange={setEyeHover}
                value={props.password}
              />

              <div className={styles.formMeta}>
                <label className={styles.remember}>
                  <input
                    checked={props.rememberMe}
                    onChange={(event) => props.onRememberMeChange(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Remember me</span>
                </label>
                <button disabled title="Password recovery will be available soon" type="button">
                  Forgot password?
                </button>
              </div>

              <p aria-live="polite" className={styles.privacyNote} hidden={!passwordVisible}>
                Your password stays private while the characters look away.
              </p>

              {props.authError && <p className={styles.error} role="alert">{props.authError}</p>}

              <button className={styles.submit} disabled={props.isAuthenticating} type="submit">
                <span>{props.isAuthenticating ? "Connecting…" : isLogin ? "Log in" : "Create account"}</span>
                <b aria-hidden="true">{props.isAuthenticating ? "· · ·" : "→"}</b>
              </button>
            </form>

            <p className={styles.switchMode}>
              {isLogin ? "Don’t have an account?" : "Already have an account?"}
              <button onClick={() => props.onModeChange(isLogin ? "register" : "login")} type="button">
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
