import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export function TableShell({ className, stickyHeader = false, responsive = true, ...props }:
  HTMLAttributes<HTMLDivElement> & { stickyHeader?: boolean; responsive?: boolean }) {
  return (
    <div
      className={cn(
        styles.tableShell,
        stickyHeader && styles.tableSticky,
        responsive && styles.tableResponsive,
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn(styles.table, className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(styles.tableHeader, className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(styles.tableBody, className)} {...props} />;
}

export function TableRow({ className, clickable = false, ...props }:
  HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(styles.tableRow, clickable && styles.tableRowClickable, className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(styles.tableHead, className)} scope="col" {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(styles.tableCell, className)} {...props} />;
}

export function TablePrimary({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.tablePrimary, className)} {...props} />;
}

export function TableMetadata({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.tableMetadata, className)} {...props} />;
}
