import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type EmptyStateProps = {
  action?: ReactNode;
  compact?: boolean;
  description: string;
  icon?: AppIconName;
  title: string;
  variant?: "standard" | "stories" | "video" | "task";
};

export function EmptyState({ action, compact = false, description, icon, title, variant = "standard" }: EmptyStateProps) {
  return (
    <div className={`feature-empty-state${compact ? " compact" : ""} empty-state-${variant}`}>
      {variant === "stories" && <div className="empty-media-preview" aria-hidden="true">{([['article', 'Text story'], ['image', 'Photo story'], ['video', 'Video story']] as const).map(([name, label]) => <span key={name}><AppIcon name={name} /><small>{label}</small></span>)}</div>}
      {variant === "video" && <div className="empty-video-preview" aria-hidden="true"><AppIcon name="video" /><span>MP4 · WebM</span></div>}
      {icon && variant !== "stories" && variant !== "video" && <span aria-hidden="true" className="empty-state-icon"><AppIcon name={icon} /></span>}
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
