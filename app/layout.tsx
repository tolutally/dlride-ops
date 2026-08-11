import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DLride Ops",
    template: "%s — DLride Ops",
  },
  description: "Internal operations console for managing DLride rental applications and customer communications.",
  appleWebApp: {
    capable: true,
    title: "DLride Ops",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Matches the manifest's theme_color and the app shell's white top bar.
  themeColor: "#ffffff",
  // Lets standalone mode reach under the notch so env(safe-area-inset-*) resolves.
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {/*
          Next only emits the standardized mobile-web-app-capable. iOS below 16.4
          predates manifest display support and still needs the Apple-prefixed tag
          to launch standalone. React hoists this into <head>.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {children}
      </body>
    </html>
  );
}
