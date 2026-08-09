import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn(styles.card, className)} {...props} />;
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function CardHeader({ title, description, action, className, ...props }: CardHeaderProps) {
  return (
    <header className={cn(styles.cardHeader, className)} {...props}>
      <div>
        <h3 className={styles.cardTitle}>{title}</h3>
        {description ? <p className={styles.cardDescription}>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.cardContent, className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn(styles.cardFooter, className)} {...props} />;
}
