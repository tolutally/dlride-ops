import { notificationPreview, relativeReplyTime } from "./format.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("notification previews normalize whitespace and remain concise", () => {
  assertEquals(notificationPreview("  Here is\n\nthe clearer copy.  "), "Here is the clearer copy.");
  const preview = notificationPreview("x".repeat(160));
  assertEquals(preview.length, 120);
  assertEquals(preview.endsWith("…"), true);
});

Deno.test("notification previews have safe fallbacks", () => {
  assertEquals(notificationPreview("", "  Re: requested documents "), "Re: requested documents");
  assertEquals(notificationPreview(""), "New customer reply");
});

Deno.test("relative reply times cover current, minute, hour, and day ranges", () => {
  const now = "2026-08-09T18:00:00.000Z";
  assertEquals(relativeReplyTime("2026-08-09T17:59:40.000Z", now), "Just now");
  assertEquals(relativeReplyTime("2026-08-09T17:58:40.000Z", now), "1 min ago");
  assertEquals(relativeReplyTime("2026-08-09T17:31:00.000Z", now), "29 min ago");
  assertEquals(relativeReplyTime("2026-08-09T16:00:00.000Z", now), "2 hrs ago");
  assertEquals(relativeReplyTime("2026-08-07T18:00:00.000Z", now), "2 days ago");
});

