"use client";

import { useEffect, useState, type HTMLAttributes } from "react";
import { cx } from "./cx";
import "./ui.css";

export type AvatarSize = 16 | 24 | 32 | 48;

export type AvatarProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: string;
  src?: string;
  size?: AvatarSize;
  alt?: string;
};

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const word = parts[0] ?? "";
    return word.slice(0, Math.min(2, word.length)).toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

/**
 * Circle avatar. Prefers `src`, then 1 to 2 letter initials, with a
 * placeholder while the image loads.
 */
export function Avatar({ name, src, size = 32, alt, className, ...props }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const label = alt ?? name;
  const initials = initialsFromName(name);
  const showImage = Boolean(src) && !failed;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  return (
    <span
      {...props}
      role="img"
      aria-label={label}
      data-slot="avatar"
      data-size={size}
      data-loading={showImage && !loaded ? true : undefined}
      className={cx("ds-avatar", `ds-avatar--${size}`, className)}
    >
      <span className="ds-avatar__fallback" aria-hidden="true">
        {initials}
      </span>
      {showImage ? (
        // Decorative: the parent span already exposes `label`.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="ds-avatar__img"
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
