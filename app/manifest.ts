import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DLride Ops",
    short_name: "DLride",
    description: "Operations console for DLride rental applications, fleet, and renewals.",
    // "/" renders the design system preview, so installed users start on the dashboard.
    start_url: "/applications",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f7",
    // Matches the app shell's white top bar so the status bar blends with it.
    theme_color: "#ffffff",
    icons: [
      {
        src: "/dlride-favicons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/dlride-favicons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/dlride-favicons/maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
