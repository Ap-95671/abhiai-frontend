import type { CSSProperties } from "react";
import type { AssistantCharacterState } from "./assistant-state";
import styles from "./assistant.module.css";

export function CharacterAvatar({ state, level = 0, small = false }: { state: AssistantCharacterState; level?: number; small?: boolean }) {
  return <div className={`${styles.avatar} ${small ? styles.smallAvatar : ""}`} data-state={state} aria-hidden="true"
    style={{ "--mouth-open": state === "speaking" ? Math.max(0, Math.min(1, level)) : 0 } as CSSProperties}>
    <svg viewBox="0 0 180 160" focusable="false">
      <ellipse className={styles.shadow} cx="90" cy="145" rx="40" ry="5" />
      <g className={styles.characterBody}>
        <path className={styles.body} d="M64 110 Q90 94 116 110 L126 130 Q90 145 54 130Z" />
        <path className={styles.antenna} d="M90 36V23" /><circle className={styles.signal} cx="90" cy="19" r="5" />
        <rect className={styles.ear} x="33" y="60" width="14" height="30" rx="7" />
        <rect className={styles.ear} x="133" y="60" width="14" height="30" rx="7" />
        <rect className={styles.head} x="43" y="35" width="94" height="82" rx="30" />
        <rect className={styles.face} x="53" y="48" width="74" height="55" rx="22" />
        <g className={styles.eyes}><ellipse cx="72" cy="70" rx="5" ry="7" /><ellipse cx="108" cy="70" rx="5" ry="7" /></g>
        <ellipse className={styles.mouth} cx="90" cy="88" rx="9" ry="2" />
        <circle className={styles.cheek} cx="63" cy="84" r="3" /><circle className={styles.cheek} cx="117" cy="84" r="3" />
        <path className={styles.emblem} d="m90 116 2.2 4.8 5.3 1-4 3.6.8 5.2-4.3-2.5-4.3 2.5.8-5.2-4-3.6 5.3-1Z" />
      </g>
    </svg>
  </div>;
}
