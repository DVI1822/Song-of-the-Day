import type { Metadata, Viewport } from "next";
import { Bungee, Creepster, Fredoka, Nosifer, Outfit, UnifrakturMaguntia } from "next/font/google";
import { PreviewProvider } from "@/components/globe/Preview";
import { HandoffWaiter } from "@/components/HandoffWaiter";
import { SessionFromLink } from "@/components/SessionFromLink";
import { MiniPlayer } from "@/components/globe/Shuffle";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

// The countdown's bubble numbers.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["600"],
});

// The TopTrack name on the Globe (components/globe/Wordmark.tsx).
const bungee = Bungee({ variable: "--font-bungee", subsets: ["latin"], weight: "400" });

// Halloween's title lettering (components/globe/halloween.ts); fetched only
// when a look uses it.
const creepster = Creepster({ variable: "--font-creepster", subsets: ["latin"], weight: "400", preload: false });
const gothic = UnifrakturMaguntia({ variable: "--font-gothic", subsets: ["latin"], weight: "400", preload: false });
const nosifer = Nosifer({ variable: "--font-nosifer", subsets: ["latin"], weight: "400", preload: false });

export const metadata: Metadata = {
  title: "TopTrack",
  description: "One song a day. The one that hit hardest.",
  // The icons and home screen name are written straight into <head> below,
  // not here (see the note there).
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  // pinching zooms the Globe, never the page
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fredoka.variable} ${bungee.variable} ${creepster.variable} ${gothic.variable} ${nosifer.variable} h-full antialiased`}>
      {/* The home screen icon and name, always in <head>. Pages that look
          something up for their title (invite links, profiles) make Next send
          its metadata late, inside <body>, and Safari's Add to Home Screen
          only reads <head>, so friends adding from an invite link got a gray
          letter instead of the icon. */}
      <head>
        <link rel="icon" href="/icon.png" sizes="256x256" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" type="image/png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-title" content="TopTrack" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full">
        {/* what's playing carries on from page to page */}
        <PreviewProvider>
          {children}
          <MiniPlayer />
          <SessionFromLink />
          <HandoffWaiter />
        </PreviewProvider>
      </body>
    </html>
  );
}
