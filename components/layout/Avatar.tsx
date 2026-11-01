"use client";

import { useState } from "react";
import { profile } from "@/content/profile";
import { useLang } from "@/components/i18n/LangProvider";
import { t } from "@/lib/i18n";

type AvatarProps = {
  size?: "small" | "large";
  className?: string;
};

export default function Avatar({ size = "small", className }: AvatarProps) {
  const alt = t(useLang(), "avatarAlt", { name: profile.name });
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hasImage = profile.avatarUrl && profile.avatarUrl !== failedUrl;

  return (
    <span className={["avatar", `avatar-${size}`, className].filter(Boolean).join(" ")}>
      {hasImage ? (
        // An ordinary image supports configured external avatars in a static export.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl!}
          alt={alt}
          width={size === "large" ? 72 : 36}
          height={size === "large" ? 72 : 36}
          onError={() => setFailedUrl(profile.avatarUrl)}
        />
      ) : (
        <span role="img" aria-label={alt}>
          {profile.initials}
        </span>
      )}
    </span>
  );
}
