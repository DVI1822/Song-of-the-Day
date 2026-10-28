import type { MetadataRoute } from "next";

// Lets the site be added to the Home Screen as an app, which is also what
// iPhones need before they'll show its nudges.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Song of the Day",
    short_name: "Song of the Day",
    description: "One song a day. The one that hit hardest.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // the night sky runs to the edges, so Android can crop it to any shape
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
