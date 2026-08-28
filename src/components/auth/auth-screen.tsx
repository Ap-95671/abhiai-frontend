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
  const [typingPulse, setTypingPulse] = useState(0);
  const animationFrame = useRef<number | null>(null);
  const characterScene = useRef<HTMLDivElement | null>(null);
  const pointerCurrent = useRef({ x: 0, y: 0 });
  const pointerTarget = useRef({ x: 0, y: 0 });
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

    const movementProfiles = {
      dark: { body: 0.11, gazeX: 4.6, gazeY: 3.1, reach: 18, stretch: 0.18 },
      orange: { body: 0.055, gazeX: 2.7, gazeY: 2.1, reach: 8, stretch: 0.08 },
      purple: { body: 0.15, gazeX: 4.8, gazeY: 3.2, reach: 28, stretch: 0.26 },
      yellow: { body: 0.09, gazeX: 3.1, gazeY: 2.2, reach: 14, stretch: 0.13 },
    } as const;

    function applyPointerFrame() {
      const scene = characterScene.current;
      if (!scene) return;

      const current = pointerCurrent.current;
      const target = pointerTarget.current;
      current.x += (target.x - current.x) * 0.14;
      current.y += (target.y - current.y) * 0.14;

      scene.querySelectorAll<HTMLElement>("[data-character]").forEach((character) => {
        const characterName = character.dataset.character as keyof typeof movementProfiles;
        const profile = movementProfiles[characterName];
        const slotBounds = character.parentElement?.getBoundingClientRect();
        if (!profile || !slotBounds) return;

        const eyeCenterX = slotBounds.left + slotBounds.width * 0.5;
        const eyeCenterY = slotBounds.top + Math.min(slotBounds.height * 0.25, 58);
        const deltaX = current.x - eyeCenterX;
        const deltaY = current.y - eyeCenterY;
        const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
        const gazeX = Math.max(-1, Math.min(1, deltaX / distance));
        const gazeY = Math.max(-1, Math.min(1, deltaY / distance));
        const horizontal = Math.max(-1, Math.min(1, deltaX / Math.max(window.innerWidth * 0.46, 1)));
        const upwardReach = Math.max(0, Math.min(1, -deltaY / Math.max(window.innerHeight * 0.52, 1)));
        const proximity = Math.max(0, Math.min(1, distance / Math.max(window.innerWidth * 0.58, 1)));
        const reachStrength = Math.max(upwardReach, proximity * 0.45);

        character.style.setProperty("--pupil-x", `${gazeX * profile.gazeX}px`);
        character.style.setProperty("--pupil-y", `${gazeY * profile.gazeY}px`);
        character.style.setProperty("--cursor-lean", `${horizontal * profile.body * 42}deg`);
        character.style.setProperty("--cursor-stretch", `${1 + reachStrength * profile.stretch}`);
        character.style.setProperty("--cursor-compress", `${1 - reachStrength * profile.body * 0.24}`);
        character.style.setProperty("--cursor-upper-x", `${horizontal * reachStrength * profile.reach}px`);
        character.style.setProperty("--cursor-upper-turn", `${horizontal * reachStrength * profile.body * 38}deg`);
      });

      const remaining = Math.hypot(target.x - current.x, target.y - current.y);
      animationFrame.current = remaining > 0.25
        ? window.requestAnimationFrame(applyPointerFrame)
        : null;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (focusTarget || passwordVisible || props.isAuthenticating) return;

      const scene = characterScene.current;
      if (!scene) return;

      if (!pointerTrackingActive.current) {
        pointerTrackingActive.current = true;
        setPointerTracking(true);
      }

      pointerTarget.current = { x: event.clientX, y: event.clientY };
      if (animationFrame.current === null) {
        if (pointerCurrent.current.x === 0 && pointerCurrent.current.y === 0) {
          pointerCurrent.current = { x: event.clientX, y: event.clientY };
        }
        animationFrame.current = window.requestAnimationFrame(applyPointerFrame);
      }
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
      if (animationFrame.current !== null) {
        window.cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
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

  function registerTypingPulse() {
    setTypingPulse((current) => current + 1);
  }

  function changeDisplayName(value: string) {
    registerTypingPulse();
    props.onDisplayNameChange(value);
  }

  function changeEmail(value: string) {
    registerTypingPulse();
    props.onEmailChange(value);
  }

  function changePassword(value: string) {
    registerTypingPulse();
    props.onPasswordChange(value);
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
          {charactersEnabled && !introActive && (
            <AuthCharacters ref={characterScene} state={characterState} typingPulse={typingPulse} />
          )}
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
                    onChange={(event) => changeDisplayName(event.target.value)}
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
                  onChange={(event) => changeEmail(event.target.value)}
                  onFocus={() => focusField("email")}
                  required
                  type="email"
                  value={props.email}
                />
              </label>

              <PasswordField
                autoComplete={isLogin ? "current-password" : "new-password"}
                onChange={changePassword}
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
