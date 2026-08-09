"use client";

import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FileText,
  Filter,
  Inbox,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Checkbox,
  Dialog,
  DialogClose,
  Divider,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  EmptyState,
  FilterChip,
  FormField,
  IconButton,
  Input,
  MobileNavigationItem,
  PageHeader,
  SearchField,
  SectionHeader,
  Select,
  SidebarNavigationItem,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableMetadata,
  TablePrimary,
  TableRow,
  TableShell,
  Textarea,
  Tooltip,
  TopBar,
} from "@/components/ui";
import { APPLICATION_STATUSES, STATUS_CONFIG } from "@/lib/design-system/status";

import styles from "./design-system-preview.module.css";

const sampleApplications = [
  {
    number: "DLR-000184",
    applicant: "Amara Okafor",
    email: "amara@example.com",
    status: "under_review" as const,
    start: "Sep 12, 2026",
    duration: "3 weeks",
    use: "Travel nursing",
  },
  {
    number: "DLR-000183",
    applicant: "Noah Williams",
    email: "noah@example.com",
    status: "more_information_required" as const,
    start: "Sep 15, 2026",
    duration: "2 weeks",
    use: "Gig work",
  },
  {
    number: "DLR-000182",
    applicant: "Sofia Chen",
    email: "sofia@example.com",
    status: "approved" as const,
    start: "Sep 20, 2026",
    duration: "4 weeks",
    use: "Personal use",
  },
];

function PreviewSidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Sidebar treatment preview">
      <div className={styles.brand}>
        <span className={styles.brandMark}>DL</span>
        <span>DLride Ops</span>
        <span className={styles.environment}>Internal</span>
      </div>

      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.navigation}>
        <SidebarNavigationItem href="#overview" icon={LayoutDashboard} label="Overview" />
        <SidebarNavigationItem href="#table" icon={ClipboardList} label="Applications" active badge={12} />
        <SidebarNavigationItem href="#navigation" icon={Users} label="Customers" />
        <SidebarNavigationItem href="#primitives" icon={CalendarDays} label="Rentals" />
      </nav>

      <p className={styles.navLabel}>System</p>
      <nav className={styles.navigation}>
        <SidebarNavigationItem href="#foundations" icon={SlidersHorizontal} label="Design tokens" />
        <SidebarNavigationItem href="#navigation" icon={Settings} label="Settings" />
      </nav>

      <div className={styles.account}>
        <div className={styles.accountRow}>
          <Avatar name="Tolu Adeyemi" size="sm" />
          <div>
            <div className={styles.accountName}>Tolu Adeyemi</div>
            <div className={styles.accountRole}>Operations</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FoundationSection() {
  return (
    <section id="foundations" className={styles.gallerySection}>
      <SectionHeader
        title="Foundations"
        description="Neutral surfaces, compact type, and a restrained accent create a calm operating environment."
      />
      <div className={styles.galleryGrid}>
        <Card>
          <CardHeader title="Core palette" description="Semantic tokens—not component-specific colors." />
          <CardContent>
            <div className={styles.tokenGrid}>
              <div className={styles.swatch}>
                <div className={`${styles.swatchColor} ${styles.canvasSwatch}`} />
                <div className={styles.swatchMeta}><span className={styles.swatchName}>Canvas</span><span className={styles.swatchValue}>#F5F6F7</span></div>
              </div>
              <div className={styles.swatch}>
                <div className={`${styles.swatchColor} ${styles.surfaceSwatch}`} />
                <div className={styles.swatchMeta}><span className={styles.swatchName}>Surface</span><span className={styles.swatchValue}>#FFFFFF</span></div>
              </div>
              <div className={styles.swatch}>
                <div className={`${styles.swatchColor} ${styles.textSwatch}`} />
                <div className={styles.swatchMeta}><span className={styles.swatchName}>Text</span><span className={styles.swatchValue}>#191B20</span></div>
              </div>
              <div className={styles.swatch}>
                <div className={`${styles.swatchColor} ${styles.accentSwatch}`} />
                <div className={styles.swatchMeta}><span className={styles.swatchName}>DLride blue</span><span className={styles.swatchValue}>#275FDB</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Typography" description="Geist with a weight-led hierarchy." />
          <CardContent>
            <div className={styles.typeSpecimen}>
              <div className={styles.typeRow}><span className={styles.typeName}>Page title · 28</span><span className={styles.typePage}>Applications</span></div>
              <div className={styles.typeRow}><span className={styles.typeName}>Section title · 17</span><span className={styles.typeSection}>Recent activity</span></div>
              <div className={styles.typeRow}><span className={styles.typeName}>Table heading · 11</span><span className={styles.typeTable}>Applicant</span></div>
              <div className={styles.typeRow}><span className={styles.typeName}>Body · 14</span><span className={styles.typeBody}>Rental application details</span></div>
              <div className={styles.typeRow}><span className={styles.typeName}>Secondary · 13</span><span className={styles.typeSecondary}>Updated a few minutes ago</span></div>
              <div className={styles.typeRow}><span className={styles.typeName}>Caption · 12</span><span className={styles.typeCaption}>DLR-000184</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PrimitiveSection() {
  return (
    <section id="primitives" className={styles.gallerySection}>
      <SectionHeader
        title="Controls and feedback"
        description="Consistent control heights, soft borders, and clear keyboard focus across every primitive."
      />
      <div className={styles.galleryGrid}>
        <Card>
          <CardHeader title="Actions" description="Four emphasis levels across three operational sizes." />
          <CardContent className={styles.componentStack}>
            <div className={styles.componentGroup}>
              <span className={styles.componentLabel}>Variants</span>
              <div className={styles.row}>
                <Button><Plus aria-hidden="true" />Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>
            <div className={styles.componentGroup}>
              <span className={styles.componentLabel}>Sizes and icon actions</span>
              <div className={styles.row}>
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Tooltip content="Filter applications">
                  <IconButton label="Filter applications"><Filter aria-hidden="true" /></IconButton>
                </Tooltip>
                <DropdownMenu
                  trigger={<IconButton label="More actions"><MoreHorizontal aria-hidden="true" /></IconButton>}
                >
                  <DropdownMenuLabel>Application</DropdownMenuLabel>
                  <DropdownMenuItem icon={FileText}>Open details</DropdownMenuItem>
                  <DropdownMenuItem icon={Archive}>Archive</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={CircleHelp} shortcut="?">View help</DropdownMenuItem>
                </DropdownMenu>
              </div>
            </div>
            <div className={styles.componentGroup}>
              <span className={styles.componentLabel}>Badges</span>
              <div className={styles.row}>
                <Badge>Default</Badge>
                <Badge tone="blue">New</Badge>
                <Badge tone="green" icon={Check}>Complete</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Form controls" description="Native semantics with deliberate error and help states." />
          <CardContent>
            <div className={styles.fieldGrid}>
              <FormField label="Applicant name" hint="Use the legal name on the licence.">
                {(fieldProps) => <Input placeholder="Amara Okafor" {...fieldProps} />}
              </FormField>
              <FormField label="Application status">
                {(fieldProps) => (
                  <Select defaultValue="under_review" {...fieldProps}>
                    <option value="under_review">Under Review</option>
                    <option value="more_information_required">Needs Info</option>
                    <option value="approved">Approved</option>
                  </Select>
                )}
              </FormField>
              <FormField className={styles.fieldFull} label="Internal note" hint="Visible to operations staff only.">
                {(fieldProps) => <Textarea placeholder="Add context for the next reviewer…" {...fieldProps} />}
              </FormField>
              <div className={styles.fieldFull}>
                <Checkbox
                  defaultChecked
                  label="Include archived applications"
                  description="Archived records will appear in search results."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StatusSection() {
  return (
    <section className={styles.gallerySection}>
      <SectionHeader
        title="Application status"
        description="One central configuration supplies labels, tones, and Lucide icons everywhere."
      />
      <Card>
        <CardContent>
          <div className={styles.statusGrid}>
            {APPLICATION_STATUSES.map((status) => (
              <div className={styles.statusTile} key={status}>
                <StatusBadge status={status} />
                <span className={styles.statusKey}>{status}</span>
                <span className={styles.typeCaption}>{STATUS_CONFIG[status].label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function TableSection() {
  return (
    <section id="table" className={styles.gallerySection}>
      <SectionHeader
        title="Operational table"
        description="Quiet separators, compact metadata, row hover, sticky headers, and a stacked mobile fallback."
        actions={<Button variant="secondary" size="sm">View density</Button>}
      />
      <div>
        <div className={styles.tableToolbar}>
          <div className={styles.tableToolbarSearch}>
            <SearchField placeholder="Search applications" />
          </div>
          <div className={styles.tableToolbarFilters}>
            <FilterChip active>All applications</FilterChip>
            <FilterChip>Needs attention</FilterChip>
            <FilterChip removable>September</FilterChip>
          </div>
        </div>
        <TableShell stickyHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rental start</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Vehicle use</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleApplications.map((application) => (
                <TableRow key={application.number} clickable>
                  <TableCell data-label="Applicant">
                    <TablePrimary>{application.applicant}</TablePrimary>
                    <TableMetadata>{application.number} · {application.email}</TableMetadata>
                  </TableCell>
                  <TableCell data-label="Status"><StatusBadge status={application.status} /></TableCell>
                  <TableCell data-label="Rental start">{application.start}</TableCell>
                  <TableCell data-label="Duration" className={styles.amount}>{application.duration}</TableCell>
                  <TableCell data-label="Vehicle use">{application.use}</TableCell>
                  <TableCell data-label="Actions">
                    <IconButton variant="ghost" size="sm" label={`Actions for ${application.applicant}`}>
                      <MoreHorizontal aria-hidden="true" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      </div>
    </section>
  );
}

function CompositeSection() {
  return (
    <section id="navigation" className={styles.gallerySection}>
      <SectionHeader
        title="Composite patterns"
        description="Reusable empty, loading, navigation, and overlay treatments for future product surfaces."
      />
      <div className={styles.galleryGridWide}>
        <Card>
          <CardHeader title="Empty state" description="Compact, informative, and action-oriented." />
          <Divider />
          <EmptyState
            icon={Inbox}
            title="No applications match these filters"
            description="Try adjusting your search or remove one of the active filters."
            action={<Button variant="secondary" size="sm">Clear filters</Button>}
          />
        </Card>

        <div className={styles.componentStack}>
          <Card>
            <CardHeader title="Loading state" />
            <CardContent>
              <div className={styles.skeletonStack}>
                {["70%", "88%", "62%"].map((width, index) => (
                  <div className={styles.skeletonRow} key={width}>
                    <Skeleton width="2.125rem" height="2.125rem" style={{ borderRadius: "999px" }} />
                    <div className={styles.skeletonStack} style={{ flex: 1, gap: "0.45rem" }}>
                      <Skeleton width={width} height="0.7rem" />
                      <Skeleton width={`${42 + index * 5}%`} height="0.55rem" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Overlay patterns" />
            <CardContent>
              <div className={styles.row}>
                <Dialog
                  trigger={<Button variant="secondary">Open dialog</Button>}
                  title="Add an internal note"
                  description="Notes are visible to operations staff and stay with the application."
                  footer={
                    <>
                      <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                      <DialogClose asChild><Button>Save note</Button></DialogClose>
                    </>
                  }
                >
                  <FormField label="Note">
                    {(fieldProps) => <Textarea placeholder="Add a concise note…" {...fieldProps} />}
                  </FormField>
                </Dialog>
                <Tooltip content="Notifications">
                  <IconButton label="Notifications"><Bell aria-hidden="true" /></IconButton>
                </Tooltip>
                <Avatar name="Tolu Adeyemi" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Navigation treatments" description="Narrow desktop navigation and a touch-friendly mobile counterpart." />
        <CardContent>
          <div className={styles.navigationDemo}>
            <div className={styles.sidebarDemo}>
              <SidebarNavigationItem href="#navigation" icon={ClipboardList} label="Applications" active badge={12} />
              <SidebarNavigationItem href="#navigation" icon={Users} label="Customers" />
              <SidebarNavigationItem href="#navigation" icon={Settings} label="Settings" />
            </div>
            <nav className={styles.mobileNavDemo} aria-label="Mobile navigation treatment preview">
              <MobileNavigationItem href="#navigation" icon={LayoutDashboard} label="Overview" />
              <MobileNavigationItem href="#navigation" icon={ClipboardList} label="Applications" active />
              <MobileNavigationItem href="#navigation" icon={Users} label="Customers" />
              <MobileNavigationItem href="#navigation" icon={Settings} label="Settings" />
            </nav>
          </div>
        </CardContent>
        <CardFooter><span className={styles.typeCaption}>Icons use a consistent 1.8px Lucide stroke.</span></CardFooter>
      </Card>
    </section>
  );
}

export function DesignSystemPreview() {
  return (
    <div className={styles.preview}>
      <div className={styles.shell}>
        <PreviewSidebar />
        <main className={styles.workspace}>
          <div className={styles.workspaceTop}>
            <TopBar
              context={
                <>
                  <span className={styles.mobileHeader}><span className={styles.brandMark}>DL</span>DLride Ops</span>
                  <span>Design system</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </>
              }
              search={<SearchField shortcut="⌘ K" placeholder="Search components" />}
              actions={
                <>
                  <Tooltip content="Help and documentation">
                    <IconButton variant="ghost" label="Help"><CircleHelp aria-hidden="true" /></IconButton>
                  </Tooltip>
                  <Avatar name="Tolu Adeyemi" size="sm" />
                </>
              }
            />
          </div>

          <div className={styles.content}>
            <div id="overview" className={styles.intro}>
              <PageHeader
                eyebrow="DLride Ops"
                title="Interface foundations"
                description="A calm, precise system for the dense decisions and repeatable work of rental operations."
                actions={
                  <>
                    <Button variant="secondary"><Search aria-hidden="true" />Find</Button>
                    <Button><Plus aria-hidden="true" />New action</Button>
                  </>
                }
              />
              <div className={styles.version}><span className={styles.versionDot} />Foundation ready · v1.0</div>
            </div>

            <FoundationSection />
            <PrimitiveSection />
            <StatusSection />
            <TableSection />
            <CompositeSection />
          </div>
        </main>
      </div>
    </div>
  );
}
