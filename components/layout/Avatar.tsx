"use client";

import { useState } from "react";
import { profile } from "@/content/profile";

type AvatarProps = {
  size?: "small" | "large";
  className?: string;
};

export default function Avatar({ size = "small", className }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImage = profile.avatarUrl && profile.avatarUrl !== failedUrl;

  return (
    <span className={["avatar", `avatar-${size}`, className].filter(Boolean).join(" ")}>
      {hasImage ? (
        // An ordinary image supports configured external avatars in a static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl!}
          alt={`${profile.name} 的头像`}
          width={size === "large" ? 72 : 36}
          height={size === "large" ? 72 : 36}
          onError={() => setFailedUrl(profile.avatarUrl)}
        />
      ) : (
        <span role="img" aria-label={`${profile.name} 的头像`}>
          {profile.initials}
        </span>
      )}
    </span>
  );
}
