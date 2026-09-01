import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type EmptyStateProps = {
  action?: ReactNode;
  compact?: boolean;
  description: string;
  icon?: AppIconName;
  title: string;
};

export function EmptyState({ action, compact = false, description, icon, title }: EmptyStateProps) {
  return (
    <div className={`feature-empty-state${compact ? " compact" : ""}`}>
      {icon && <span aria-hidden="true" className="empty-state-icon"><AppIcon name={icon} /></span>}
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
