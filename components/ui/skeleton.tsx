import type { CSSProperties, HTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
};

export function Skeleton({ className, width = "100%", height = "1rem", style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(styles.skeleton, className)}
      aria-hidden="true"
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
