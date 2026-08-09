"use client";

import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

function visibleSearchField() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-queue-search]"),
  ).find((field) => field.getClientRects().length > 0);
}

export function QueueKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        visibleSearchField()?.focus();
        return;
      }

      if (event.key !== "j" && event.key !== "k") return;

      const rowLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("[data-queue-row-link]"),
      );
      if (rowLinks.length === 0) return;

      event.preventDefault();
      const focusedIndex = rowLinks.indexOf(document.activeElement as HTMLAnchorElement);
      const nextIndex = event.key === "j"
        ? Math.min(focusedIndex + 1, rowLinks.length - 1)
        : focusedIndex <= 0 ? 0 : focusedIndex - 1;

      rowLinks[nextIndex]?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
