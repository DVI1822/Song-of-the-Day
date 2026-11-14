import type { Metadata, Viewport } from "next";
import { Creepster, Fredoka, Gaegu, Londrina_Solid, Nosifer, Outfit, UnifrakturMaguntia } from "next/font/google";
import { PreviewProvider } from "@/components/globe/Preview";
import { HandoffWaiter } from "@/components/HandoffWaiter";
import { SessionFromLink } from "@/components/SessionFromLink";
import { AppBoot } from "@/components/AppBoot";
import { LAUNCH_SCRIPT, Launch } from "@/components/Launch";
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
const londrina = Londrina_Solid({ variable: "--font-londrina", subsets: ["latin"], weight: "900" });

// The drawn look's hand lettering (components/globe/ink.ts); fetched only
// when the drawn look is on.
const gaegu = Gaegu({ variable: "--font-hand", subsets: ["latin"], weight: "700", preload: false });

// Halloween's title lettering (components/globe/halloween.ts); fetched only
// when a look uses it.
const creepster = Creepster({ variable: "--font-creepster", subsets: ["latin"], weight: "400", preload: false });
const gothic = UnifrakturMaguntia({ variable: "--font-gothic", subsets: ["latin"], weight: "400", preload: false });
const nosifer = Nosifer({ variable: "--font-nosifer", subsets: ["latin"], weight: "400", preload: false });

export const metadata: Metadata = {
  title: "TopTrack",
  description: "Pick your top track of the day, crown the best one on your globe, and find music through everyone else's.",
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
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${fredoka.variable} ${londrina.variable} ${creepster.variable} ${gothic.variable} ${nosifer.variable} ${gaegu.variable} h-full antialiased`}>
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
        {/* most album covers come from Spotify: start the handshake before the page asks */}
        <link rel="preconnect" href="https://i.scdn.co" />
        {/* the opening animation plays once a visit (components/Launch.tsx) */}
        <script dangerouslySetInnerHTML={{ __html: LAUNCH_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {/* what's playing carries on from page to page */}
        <PreviewProvider>
          {children}
          <MiniPlayer />
          <SessionFromLink />
          <HandoffWaiter />
          <AppBoot />
        </PreviewProvider>
        <Launch />
      </body>
    </html>
  );
}
