import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cover art, resized small so a core can read its colours
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.scdn.co" },
      { protocol: "https", hostname: "**.spotifycdn.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
