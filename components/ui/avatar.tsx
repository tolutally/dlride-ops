import type { HTMLAttributes } from "react";
import Image from "next/image";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        styles.avatar,
        size === "sm" && styles.avatarSm,
        size === "md" && styles.avatarMd,
        size === "lg" && styles.avatarLg,
        className,
      )}
      title={name}
      aria-label={name}
      {...props}
    >
      {src ? <Image src={src} alt="" fill sizes="44px" unoptimized /> : initials(name)}
    </span>
  );
}
