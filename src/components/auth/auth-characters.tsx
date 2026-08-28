"use client";

import { forwardRef } from "react";

import styles from "./auth-screen.module.css";

export type AuthFocusTarget = "name" | "email" | "password" | null;

export type CharacterAnimationState =
  | "entrance"
  | "idle"
  | "cursor"
  | "email"
  | "email-typing"
  | "password-masked"
  | "password-visible"
  | "eye-hover"
  | "submitting"
  | "error";

type AuthCharactersProps = {
  state: CharacterAnimationState;
};

const stateClass: Record<CharacterAnimationState, string> = {
  entrance: styles.stateEntrance,
  idle: styles.stateIdle,
  cursor: styles.stateCursor,
  email: styles.stateEmail,
  "email-typing": styles.stateEmailTyping,
  "password-masked": styles.statePasswordMasked,
  "password-visible": styles.statePasswordVisible,
  "eye-hover": styles.stateEyeHover,
  submitting: styles.stateSubmitting,
  error: styles.stateError,
};

export const AuthCharacters = forwardRef<HTMLDivElement, AuthCharactersProps>(function AuthCharacters(
  { state },
  ref,
) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.characterScene} ${stateClass[state]}`}
      data-character-state={state}
      ref={ref}
    >
      <span className={`${styles.sceneShape} ${styles.sceneShapeOne}`} />
      <span className={`${styles.sceneShape} ${styles.sceneShapeTwo}`} />

      <div className={`${styles.characterSlot} ${styles.purpleSlot}`}>
        <div className={`${styles.character} ${styles.purpleCharacter}`}>
          <Face />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.darkSlot}`}>
        <div className={`${styles.character} ${styles.darkCharacter}`}>
          <Face />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.orangeSlot}`}>
        <div className={`${styles.character} ${styles.orangeCharacter}`}>
          <Face />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.yellowSlot}`}>
        <div className={`${styles.character} ${styles.yellowCharacter}`}>
          <Face />
          <span className={styles.yellowNose} />
        </div>
      </div>
    </div>
  );
});

function Face() {
  return (
    <span className={styles.characterFace}>
      <span className={`${styles.characterEye} ${styles.leftEye}`}><i /></span>
      <span className={`${styles.characterEye} ${styles.rightEye}`}><i /></span>
      <span className={styles.characterMouth} />
    </span>
  );
}
