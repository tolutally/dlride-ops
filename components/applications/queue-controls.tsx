"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, FilterChip, IconButton, SearchField, Select } from "@/components/ui";
import { queueUrl } from "@/lib/applications/query-params";
import {
  VEHICLE_USE_LABELS,
  type ApplicationQueueFilters,
  type ApplicationSortField,
  type SortDirection,
} from "@/lib/applications/types";
import { STATUS_CONFIG } from "@/lib/design-system/status";

import styles from "./applications-queue.module.css";

function directionLabels(sortBy: ApplicationSortField): Record<SortDirection, string> {
  switch (sortBy) {
    case "submitted":
      return { desc: "Newest First", asc: "Oldest First" };
    case "rental_start_date":
      return { desc: "Latest Start", asc: "Earliest Start" };
    case "rental_weeks":
      return { desc: "Most Weeks", asc: "Fewest Weeks" };
    case "applicant_name":
      return { desc: "Z to A", asc: "A to Z" };
  }
}

export function QueueControls({ filters }: { filters: ApplicationQueueFilters }) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.query);
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(filters.status);
  const [draftVehicleUse, setDraftVehicleUse] = useState(filters.vehicleUse);
  const [draftSortBy, setDraftSortBy] = useState(filters.sortBy);
  const [draftDirection, setDraftDirection] = useState(filters.direction);

  useEffect(() => {
    if (search.trim() === filters.query) return;

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(queueUrl(filters, { query: search.trim(), page: 1 }), { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [filters, router, search]);

  function update(overrides: Partial<ApplicationQueueFilters>) {
    startTransition(() => {
      router.replace(queueUrl(filters, { ...overrides, page: 1 }), { scroll: false });
    });
  }

  function clearAll() {
    setSearch("");
    setFiltersOpen(false);
    startTransition(() => router.replace("/applications", { scroll: false }));
  }

  function openMobileFilters(open: boolean) {
    setFiltersOpen(open);
    if (open) {
      setDraftStatus(filters.status);
      setDraftVehicleUse(filters.vehicleUse);
      setDraftSortBy(filters.sortBy);
      setDraftDirection(filters.direction);
    }
  }

  const labels = directionLabels(filters.sortBy);
  const hasFilters = Boolean(
    filters.query ||
      filters.status !== "all" ||
      filters.vehicleUse !== "all" ||
      filters.sortBy !== "submitted" ||
      filters.direction !== "desc",
  );
  const activeFilterCount = [
    filters.status !== "all",
    filters.vehicleUse !== "all",
    filters.sortBy !== "submitted" || filters.direction !== "desc",
  ].filter(Boolean).length;

  return (
    <div className={styles.controls} aria-busy={isPending}>
      <div className={`${styles.search} ${styles.desktopSearch}`}>
        <SearchField
          data-queue-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ID, applicant, email, or phone"
          aria-label="Search applications"
          shortcut="/"
        />
      </div>

      <div className={styles.mobileSearchRow}>
        <SearchField
          className={styles.mobileSearchInput}
          data-queue-search
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search applications"
          aria-label="Search applications"
        />

        <DialogPrimitive.Root open={filtersOpen} onOpenChange={openMobileFilters}>
          <DialogPrimitive.Trigger asChild>
            <Button className={styles.mobileFilterTrigger} variant="secondary" aria-label="Open application filters">
              <SlidersHorizontal aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 ? (
                <span className={styles.filterCount} aria-label={`${activeFilterCount} active filters`}>
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={styles.filterOverlay} />
            <DialogPrimitive.Content className={styles.filterSheet}>
              <div className={styles.filterHandle} aria-hidden="true" />
              <div className={styles.filterSheetHeader}>
                <div>
                  <DialogPrimitive.Title className={styles.filterSheetTitle}>Filter applications</DialogPrimitive.Title>
                  <DialogPrimitive.Description className={styles.filterSheetDescription}>
                    Narrow the queue without losing your place.
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close asChild>
                  <IconButton variant="ghost" label="Close filters"><X aria-hidden="true" /></IconButton>
                </DialogPrimitive.Close>
              </div>

              <div className={styles.filterSheetBody}>
                <label className={styles.filter}>
                  <span className={styles.filterLabel}>Status</span>
                  <Select
                    className={styles.mobileSelect}
                    value={draftStatus}
                    onChange={(event) => setDraftStatus(event.target.value as ApplicationQueueFilters["status"])}
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(STATUS_CONFIG).map(([value, definition]) => (
                      <option value={value} key={value}>{definition.label}</option>
                    ))}
                  </Select>
                </label>

                <label className={styles.filter}>
                  <span className={styles.filterLabel}>Intended Use</span>
                  <Select
                    className={styles.mobileSelect}
                    value={draftVehicleUse}
                    onChange={(event) => setDraftVehicleUse(event.target.value as ApplicationQueueFilters["vehicleUse"])}
                  >
                    <option value="all">All intended uses</option>
                    {Object.entries(VEHICLE_USE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </Select>
                </label>

                <div className={styles.mobileSortGrid}>
                  <label className={styles.filter}>
                    <span className={styles.filterLabel}>Sort By</span>
                    <Select
                      className={styles.mobileSelect}
                      value={draftSortBy}
                      onChange={(event) => setDraftSortBy(event.target.value as ApplicationSortField)}
                    >
                      <option value="submitted">Submitted</option>
                      <option value="rental_start_date">Rental Start</option>
                      <option value="rental_weeks">Rental Weeks</option>
                      <option value="applicant_name">Applicant Name</option>
                    </Select>
                  </label>

                  <label className={styles.filter}>
                    <span className={styles.filterLabel}>Order</span>
                    <Select
                      className={styles.mobileSelect}
                      value={draftDirection}
                      onChange={(event) => setDraftDirection(event.target.value as SortDirection)}
                    >
                      <option value="desc">{directionLabels(draftSortBy).desc}</option>
                      <option value="asc">{directionLabels(draftSortBy).asc}</option>
                    </Select>
                  </label>
                </div>
              </div>

              <div className={styles.filterSheetFooter}>
                <Button variant="ghost" onClick={clearAll}>Clear all</Button>
                <Button
                  onClick={() => {
                    update({
                      status: draftStatus,
                      vehicleUse: draftVehicleUse,
                      sortBy: draftSortBy,
                      direction: draftDirection,
                    });
                    setFiltersOpen(false);
                  }}
                >
                  Apply filters
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>

      <div className={styles.mobileFilterChips} aria-label="Active filters">
        {filters.status !== "all" ? (
          <FilterChip active removable onClick={() => update({ status: "all" })}>
            {STATUS_CONFIG[filters.status].label}
          </FilterChip>
        ) : null}
        {filters.vehicleUse !== "all" ? (
          <FilterChip active removable onClick={() => update({ vehicleUse: "all" })}>
            {VEHICLE_USE_LABELS[filters.vehicleUse]}
          </FilterChip>
        ) : null}
        {filters.sortBy !== "submitted" || filters.direction !== "desc" ? (
          <FilterChip
            active
            removable
            onClick={() => update({ sortBy: "submitted", direction: "desc" })}
          >
            {directionLabels(filters.sortBy)[filters.direction]}
          </FilterChip>
        ) : null}
      </div>

      <div className={styles.desktopFilterRow}>
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Status</span>
          <Select
            value={filters.status}
            onChange={(event) => update({ status: event.target.value as ApplicationQueueFilters["status"] })}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_CONFIG).map(([value, definition]) => (
              <option value={value} key={value}>{definition.label}</option>
            ))}
          </Select>
        </label>

        <label className={`${styles.filter} ${styles.filterWide}`}>
          <span className={styles.filterLabel}>Intended Use</span>
          <Select
            value={filters.vehicleUse}
            onChange={(event) => update({ vehicleUse: event.target.value as ApplicationQueueFilters["vehicleUse"] })}
          >
            <option value="all">All</option>
            {Object.entries(VEHICLE_USE_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </Select>
        </label>

        <label className={styles.filter}>
          <span className={styles.filterLabel}>Sort By</span>
          <Select
            value={filters.sortBy}
            onChange={(event) => update({ sortBy: event.target.value as ApplicationSortField })}
          >
            <option value="submitted">Submitted</option>
            <option value="rental_start_date">Rental Start</option>
            <option value="rental_weeks">Rental Weeks</option>
            <option value="applicant_name">Applicant Name</option>
          </Select>
        </label>

        <label className={styles.filter}>
          <span className={styles.filterLabel}>Order</span>
          <Select
            value={filters.direction}
            onChange={(event) => update({ direction: event.target.value as SortDirection })}
          >
            <option value="desc">{labels.desc}</option>
            <option value="asc">{labels.asc}</option>
          </Select>
        </label>

        <Button
          className={styles.clearButton}
          variant="ghost"
          disabled={!hasFilters}
          onClick={clearAll}
        >
          Clear Filters
        </Button>

        {isPending ? <span className={styles.pending} role="status">Updating…</span> : null}
      </div>
    </div>
  );
}
