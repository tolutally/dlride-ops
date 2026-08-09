import { Search } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  shortcut?: string;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField({ className, shortcut, "aria-label": ariaLabel = "Search", ...props }, ref) {
    return (
      <div className={styles.searchWrap}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={ref}
          type="search"
          className={cn(styles.searchInput, className)}
          aria-label={ariaLabel}
          {...props}
        />
        {shortcut ? <kbd className={styles.searchShortcut}>{shortcut}</kbd> : null}
      </div>
    );
  },
);
