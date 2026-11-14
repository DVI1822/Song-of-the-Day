import type { CapacitorConfig } from "@capacitor/cli";

// The TopTrack iPhone app. It opens the live site (www.mytoptrack.io) in a
// full-screen web view, so every merge to main reaches the app straight away
// with no App Store update. What the app adds on top: real push
// notifications (APNs), sign-in kept in the phone's own storage, and a
// splash screen. app-shell/ is only what shows if the phone is offline.
const config: CapacitorConfig = {
  appId: "io.mytoptrack.app",
  appName: "TopTrack",
  webDir: "app-shell",
  server: {
    url: "https://www.mytoptrack.io",
    // the sign-in links and Supabase stay inside the app
    allowNavigation: ["mytoptrack.io", "*.mytoptrack.io", "*.supabase.co"],
    errorPath: "offline.html",
  },
  // lets the site tell it's inside the app (src/lib/native.ts)
  appendUserAgent: "TopTrackApp",
  backgroundColor: "#FF5E57",
  ios: {
    contentInset: "never",
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#FF5E57",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
