"use client";

import { useState } from "react";
import { AuthenticatedImage } from "@/components/authenticated-image";

type UserAvatarProps = {
  accessToken: string;
  displayName: string;
  profileMediaId?: string | null;
  profilePicture?: string | null;
  className?: string;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "A";
}

export function UserAvatar({ accessToken, className = "", displayName, profileMediaId, profilePicture }: UserAvatarProps) {
  const [urlFailed, setUrlFailed] = useState(false);
  const fallback = <span aria-label={`${displayName} avatar`} className={`${className} user-avatar-fallback`}>{initials(displayName)}</span>;
  if (profileMediaId) return <AuthenticatedImage accessToken={accessToken} alt={`${displayName} profile picture`} className={`${className} user-avatar-image`} fallback={fallback} mediaId={profileMediaId} thumbnail/>;
  if (profilePicture && !urlFailed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={`${displayName} profile picture`} className={`${className} user-avatar-image`} loading="lazy" onError={() => setUrlFailed(true)} src={profilePicture}/>;
  }
  return fallback;
}
