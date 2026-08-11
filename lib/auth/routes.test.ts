import {
  authRedirectFor,
  isProtectedStaffPath,
  isPublicApplicationSubmission,
} from "./routes.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test("all internal routes require a staff session", () => {
  const protectedPaths = [
    "/applications",
    "/applications/28115856-97d2-4cac-bd6b-22ff3d0cf389",
    "/customers",
    "/rentals",
    "/fleet",
    "/renewals",
    "/settings",
  ];

  protectedPaths.forEach((path) => {
    assertEquals(isProtectedStaffPath(path), true);
    assertEquals(authRedirectFor(path, false), "/login");
    assertEquals(authRedirectFor(path, true), null);
  });
});

Deno.test("login redirects authenticated staff and leaves public paths alone", () => {
  assertEquals(authRedirectFor("/login", true), "/applications");
  assertEquals(authRedirectFor("/login", false), null);
  assertEquals(authRedirectFor("/", false), null);
  assertEquals(authRedirectFor("/apply", false), null);
});

Deno.test("only the exact public application POST bypasses the staff page guard", () => {
  assertEquals(isPublicApplicationSubmission("/applications", "POST"), true);
  assertEquals(isPublicApplicationSubmission("/applications", "post"), true);
  assertEquals(isPublicApplicationSubmission("/applications", "GET"), false);
  assertEquals(isPublicApplicationSubmission("/applications/example-id", "POST"), false);
  assertEquals(isPublicApplicationSubmission("/customers", "POST"), false);
});
