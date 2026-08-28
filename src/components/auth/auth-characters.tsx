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
  typingPulse: number;
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
  { state, typingPulse },
  ref,
) {
  const typingClass = typingPulse === 0
    ? ""
    : typingPulse % 2 === 0
      ? styles.typingPulseEven
      : styles.typingPulseOdd;

  return (
    <div
      aria-hidden="true"
      className={`${styles.characterScene} ${stateClass[state]} ${typingClass}`}
      data-character-state={state}
      data-typing-pulse={typingPulse}
      ref={ref}
    >
      <span className={`${styles.sceneShape} ${styles.sceneShapeOne}`} />
      <span className={`${styles.sceneShape} ${styles.sceneShapeTwo}`} />

      <div className={`${styles.characterSlot} ${styles.purpleSlot}`}>
        <div className={`${styles.character} ${styles.purpleCharacter}`}>
          <CharacterBody />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.darkSlot}`}>
        <div className={`${styles.character} ${styles.darkCharacter}`}>
          <CharacterBody />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.orangeSlot}`}>
        <div className={`${styles.character} ${styles.orangeCharacter}`}>
          <CharacterBody />
        </div>
      </div>

      <div className={`${styles.characterSlot} ${styles.yellowSlot}`}>
        <div className={`${styles.character} ${styles.yellowCharacter}`}>
          <CharacterBody yellow />
        </div>
      </div>
    </div>
  );
});

function CharacterBody({ yellow = false }: { yellow?: boolean }) {
  return (
    <>
      <span className={styles.characterTorso} />
      <span className={styles.characterHeadPivot}>
        <span className={styles.characterHead}>
          <Face />
          {yellow && <span className={styles.yellowNose} />}
        </span>
      </span>
    </>
  );
}

function Face() {
  return (
    <span className={styles.characterFace}>
      <span className={`${styles.characterEye} ${styles.leftEye}`}><i /></span>
      <span className={`${styles.characterEye} ${styles.rightEye}`}><i /></span>
      <span className={styles.characterMouth} />
    </span>
  );
}
