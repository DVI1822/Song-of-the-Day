import type { Metadata, Viewport } from "next";
import { Fredoka, Outfit } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Fingerpick",
  description: "One song a day. The one that hit hardest.",
  // The iPhone home screen icon, as a plain file at the address Safari also
  // looks for on its own, so Add to Home Screen never falls back to a letter.
  icons: {
    icon: [{ url: "/icon.png", sizes: "256x256", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { title: "Fingerpick" }, // the name under the home screen icon
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
    <html lang="en" className={`${outfit.variable} ${fredoka.variable} h-full antialiased`}>
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
