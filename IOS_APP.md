# The TopTrack iPhone app

The app is a thin native shell (Capacitor) that opens www.mytoptrack.io full
screen. Every merge to `main` shows up in the app right away, with no App Store
update. A new App Store build is only needed when the shell itself changes:
the icon, splash screen, plugins or iOS settings.

What the app adds over the website:

- **Real notifications through Apple.** Friends posting, likes and notes on
  your song, and the noon and 9 PM "what's your song today?" nudges. The
  website's web push can't run inside an app, so the app saves its Apple
  device token (`apns:<token>` in `push_subs`) and `/api/push/send` sends to
  it through APNs (`src/lib/apns.ts`).
- **Stay signed in.** Each sign-in is also kept in the phone's own storage
  (`src/components/AppBoot.tsx`). If iOS ever drops the web view's cookies, it
  signs straight back in.
- **Opens fresh.** Coming back on a new day, or after 3 hours, reloads today's globe.
- The crowned Globe icon and a paper splash screen (the opening animation's
  first frame, so it hands over to the site seamlessly), an offline screen, and no
  "add to your home screen" help.

## Files

| | |
|---|---|
| `capacitor.config.ts` | app id `io.mytoptrack.app`, the site URL, splash |
| `ios/` | the Xcode project (Swift Package Manager, no CocoaPods) |
| `app-shell/` | the offline screen |
| `assets/` | icon source. Regenerate the icon with `npx @capacitor/assets generate --ios --iconBackgroundColor '#FF5E57'`, then put back `ios/App/App/Assets.xcassets/Splash.imageset` and `LaunchScreen.storyboard` from git: the splash is a 500 pt image drawn centred (not stretched) so its Globe lands exactly where the web animation's does (src/components/Launch.tsx) |
| `codemagic.yaml` | cloud build that sends the app to TestFlight |
| `src/lib/native.ts`, `src/components/AppBoot.tsx` | what the site does differently inside the app |

## One-time setup

1. **Apple Developer Program** ($99/year): developer.apple.com/programs/enroll.
   Enrolling as an individual takes about a day.
2. **App ID with push.** developer.apple.com → Certificates, IDs & Profiles →
   Identifiers → + → App IDs → App. Bundle ID `io.mytoptrack.app`
   (explicit), description "TopTrack", and tick **Push Notifications**.
3. **Push key.** Same site → Keys → + → name it "TopTrack push", tick
   **Apple Push Notifications service (APNs)**, then download the `.p8`. Apple
   lets you download it only once. In Vercel → Settings → Environment
   Variables, add:
   - `APNS_KEY`: the whole `.p8` file, including the BEGIN and END lines
   - `APNS_KEY_ID`: the key's Key ID
   - `APNS_TEAM_ID`: your Team ID (shown under Membership)
4. **The app in App Store Connect.** appstoreconnect.apple.com → Apps → + →
   New App: platform iOS, name "TopTrack", bundle ID `io.mytoptrack.app`,
   SKU `toptrack`.
5. **Build it**, either way:
   - **With a Mac:** install Xcode, then `npm ci && npx cap sync ios && npx cap open ios`.
     In Xcode: App target → Signing & Capabilities → pick your team. Then Product →
     Archive → Distribute App → App Store Connect.
   - **No Mac (Codemagic):** sign up at codemagic.io with GitHub and add this
     repo. In App Store Connect → Users and Access → Integrations → App Store
     Connect API, make a key with **App Manager** access and download it. In
     Codemagic → Team settings → Team integrations → Developer Portal, add that
     key and name it **TopTrack**. Then codemagic.yaml settings → Code signing
     identities → iOS certificates → **Generate certificate** (Apple
     Distribution), and in iOS provisioning profiles → **Fetch profiles** (make
     an "App Store" profile for `io.mytoptrack.app` on developer.apple.com first
     if none shows up). Start a build of **ios-testflight**; it lands in
     TestFlight about 30 minutes later.
6. **Database.** Run `supabase/migrations/20261115000000_app_push.sql` in the
   Supabase SQL editor, so the app's push tokens can be saved.

## App Store listing

- **Name:** TopTrack
- **Subtitle:** One song a day
- **Category:** Music (secondary: Social Networking)
- **Privacy policy URL:** https://www.mytoptrack.io/privacy
- **Support URL:** https://www.mytoptrack.io
- **Age rating:** 12+ (people can chat and post photos; there's reporting and blocking)
- **Screenshots:** 6.9" iPhone (1320 × 2868), in the project files under `app-store/screenshots/`.
- **Review account:** Apple can't receive an email code, so it gets one
  account that signs in with a password. In Supabase → Authentication → Users
  → Add user → Create new user, enter an email (e.g. `review@mytoptrack.io`)
  and a password, with Auto Confirm on. In Vercel, set
  `NEXT_PUBLIC_REVIEW_EMAIL` to that email and redeploy. Typing that email on
  the sign-in page shows a password box; no other email changes. Put the email
  and password in App Review's "Sign-in required" notes, and follow a few
  people from that account so the reviewer sees a full globe.
- **App Privacy answers:** collects Email Address, Name, Photos, User ID,
  Other User Content (songs, captions, chat), Coarse Location (weather only,
  not stored), and Device ID (push token). All are "linked to the user", none
  are used for tracking.

**Description:**

> One song a day. The one that hit hardest.
>
> TopTrack is where you and your friends each share a single song every day: the one that set your vibe. Paste a link, add a caption or a photo, and it lands on your globe for everyone you follow.
>
> • See what your friends are playing today, on a spinning globe under your own real sky, weather and seasons
> • Hear 30-second samples, or open the whole song in your own music app
> • Crown one friend's song a day as your TopTrack and climb the monthly leaderboard
> • Like songs, leave notes and chat with everyone on your globe
> • Every night at midnight, the day's songs go into your profile as a playlist
>
> Get a nudge when friends post, so you never miss the day's best song.

**Keywords:** music,song,friends,daily,share,playlist,social,spotify,globe,vibe
