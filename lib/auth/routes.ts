const PROTECTED_ROUTE_ROOTS = [
  "/applications",
  "/customers",
  "/rentals",
  "/fleet",
  "/renewals",
  "/settings",
] as const;

export function isProtectedStaffPath(pathname: string) {
  return PROTECTED_ROUTE_ROOTS.some((route) =>
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function isPublicApplicationSubmission(pathname: string, method: string) {
  return pathname === "/applications" && method.toUpperCase() === "POST";
}

export function authRedirectFor(pathname: string, authenticated: boolean) {
  if (!authenticated && isProtectedStaffPath(pathname)) return "/login";
  if (authenticated && pathname === "/login") return "/applications";
  return null;
}
