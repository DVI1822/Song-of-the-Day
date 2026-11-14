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
  // paper, the colour behind the opening animation (components/Launch.tsx)
  backgroundColor: "#FFFDF6",
  ios: {
    contentInset: "never",
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    // The splash is the opening animation's first frame (the still Globe on
    // paper, centred), and the site hides it the moment the animation can
    // start (components/Launch.tsx), so the two join up seamlessly. The 6 s
    // is only a fallback in case the site never loads.
    SplashScreen: {
      launchShowDuration: 6000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#FFFDF6",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
