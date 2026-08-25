import Image from "next/image";

import styles from "./thinking-indicator.module.css";

export function ThinkingIndicator() {
  return (
    <div aria-label="AbhiAI is preparing a response" className={styles.indicator} role="status">
      <span className={styles.logo}><Image alt="" height={48} src="/abhiai-logo.png" width={48} /></span>
      <span className={styles.label}>AbhiAI is preparing a response</span>
    </div>
  );
}
