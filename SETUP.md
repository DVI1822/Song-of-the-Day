# Getting Song of the Day online

This takes about 20 minutes and costs nothing. You'll make two free accounts:

- **Supabase** holds the database and handles sign-in.
- **Vercel** runs the website.

You don't need to install anything on your computer for this.

---

## Part 1: Merge the code into `main`

1. Open the pull request on GitHub.
2. Scroll to the bottom and click **Merge pull request**, then **Confirm merge**.

Your `main` branch now has the app in it. Vercel will build from `main`.

---

## Part 2: Supabase (the database)

### Make the project

1. Go to [supabase.com](https://supabase.com) and click **Start your project**.
   Sign in with GitHub, it's the quickest.
2. Click **New project**.
   - **Name:** `song-of-the-day`
   - **Database password:** click **Generate a password**, then save it in your
     password manager. You won't need it day to day. Don't share it with anyone,
     including me.
   - **Region:** pick the one closest to you (for Chicago, `East US` or `Central US`).
   - **Security:** set the three boxes like this:
     - **Enable Data API:** on. The app talks to the database through it.
     - **Automatically expose new tables:** off, as Supabase recommends. The
       database code grants exactly the access the app needs, nothing more.
     - **Enable automatic RLS:** on. The database code turns on row level
       security for every table anyway, and this is a safety net for any
       table added later.
3. Click **Create new project** and wait a minute or two while it sets up.

### Create the tables

1. In the left sidebar, open **SQL Editor**.
2. Click **New query** (or the **+**).
3. On GitHub, open the file
   [`supabase/migrations/20261022000000_init.sql`](supabase/migrations/20261022000000_init.sql),
   click the **copy** icon at the top right of the file, and paste it all into
   the SQL editor.
4. Click **Run**. You should see "Success. No rows returned."
5. Do the same with
   [`supabase/migrations/20261023000000_album_preview_photo.sql`](supabase/migrations/20261023000000_album_preview_photo.sql)
   in a new query. It adds albums, song previews and photos.

You can check it worked under **Table Editor**: there should be `profiles`,
`posts`, `follows`, `invites` and `app_settings` tables.

### Invite yourself

The site starts out **invite-only**: only emails on the invite list can join,
and only people who've joined can see anything.

1. Open **Table Editor → invites**.
2. Click **Insert → Insert row**.
3. Type your email in **email** (the **note** box is optional, like "me").
4. Click **Save**.

Do the same for each friend you want to let in. Capital letters and stray
spaces don't matter.

### Copy your two keys

Vercel needs two values from Supabase. Open a note on your computer or phone to
paste them into while you go.

**1. The Project URL**

Look at your browser's address bar while you're in your Supabase project. It
looks like this:

```
supabase.com/dashboard/project/abcdefghijklmnop
```

That last part (`abcdefghijklmnop`) is your project's ID. Your Project URL is
`https://` + that ID + `.supabase.co`, for example:

```
https://abcdefghijklmnop.supabase.co
```

Write that down. (It's also shown under **Project Settings → Data API**, if
you'd rather copy it.)

**2. The Publishable key**

1. Click the **gear icon** (Project Settings) at the bottom of the left sidebar.
2. Click **API Keys**.
3. Find the key labeled **Publishable key**. It starts with `sb_publishable_`.
   Click the copy button next to it and paste it into your note.

If that page only shows **anon** and **service_role** keys (older projects),
copy the **anon** / **public** one instead. It works the same way.

**Which keys are safe?** The URL and the publishable (or anon) key are meant
to be public, so they're fine to paste into Vercel and fine to share with me.
**Never** share the **secret** key or the **service_role** key. The app
doesn't need them.

---

## Part 3: Vercel (the website)

1. Go to [vercel.com](https://vercel.com) and click **Sign Up**. Choose
   **Hobby** (free), then **Continue with GitHub**.
2. Click **Add New… → Project**.
3. Find **Song-of-the-Day** in the list and click **Import**. If it isn't
   listed, click **Adjust GitHub App Permissions** and allow Vercel to see that
   repository.
4. Open the **Environment Variables** section and add two:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your Publishable key |

5. Click **Deploy** and wait for the confetti.
6. Copy your site's address. It looks like `https://song-of-the-day-xyz.vercel.app`.

---

## Part 4: Point sign-in emails at your site

Sign-in works by emailing you a link, so Supabase needs to know your site's address.

1. Back in Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address, like `https://song-of-the-day-xyz.vercel.app`.
3. Under **Redirect URLs**, click **Add URL** and add:
   - `https://song-of-the-day-xyz.vercel.app/auth/callback` (your address + `/auth/callback`)
   - `http://localhost:3000/auth/callback` (for running it on a computer later)
4. Click **Save**.

---

## Part 4b: Sign in with Spotify (optional)

The sign-in page has a "Continue with Spotify" button above the email box. It
works once Spotify and Supabase know about each other.

1. In Supabase, open **Authentication → Sign In / Providers → Spotify** and
   copy the **Callback URL** it shows. It looks like
   `https://<your-project>.supabase.co/auth/v1/callback`. Leave the tab open.
2. Go to <https://developer.spotify.com/dashboard>, sign in with your Spotify
   account (it must be Premium), and click **Create app**.
   - Name: Song of the Day. Description: anything.
   - Redirect URI: paste the Supabase Callback URL from step 1 and click **Add**.
   - Under "Which API/SDKs are you planning to use?", tick **Web API**.
   - Agree to the terms and **Save**.
3. In the new app, open **Settings**. Copy the **Client ID**, then click
   **View client secret** and copy that too.
4. Back in Supabase's Spotify provider, switch it on, paste the Client ID and
   Client Secret, and **Save**.
5. Back in the Spotify app, open **User Management** and add each friend's
   name and the email address of their Spotify account.

Spotify keeps new apps in development mode: only people on that User
Management list can sign in, up to 5 of them. Anyone else uses the email link.
Their Spotify email still needs to be on the invite list in Supabase.

## Part 5: Try it

1. Open your site, click **Get started**, and enter the email you invited.
2. Open the link in the email **on the same phone or browser** you asked from.
3. Pick your name and username.
4. Tap **+**, paste a Spotify link, add a comment or photo if you like, and post.
5. Add a friend's email to **invites**, send them the link, and add each
   other from the **Find a friend** tab. Their tile appears on your Globe.

You can also open `/demo` on your site to see a Globe full of made-up friends.

---

## Going public later

When you're ready for anyone to join:

1. In Supabase, open **Table Editor → app_settings**.
2. Change **invite_only** from `TRUE` to `FALSE` and save.

That's it: anyone can sign up, and profiles and songs become visible to
visitors who aren't signed in. Switch it back to `TRUE` to close it again
(people who already joined stay in).

Someone who isn't invited can still request a sign-in email, but after
clicking it they only see an "invite only, for now" page.

## Good to know

- **Sign-in emails are limited.** Supabase's built-in email sender only sends a
  few emails an hour. That's fine while it's you and a few friends. When more
  people join, we'll hook up a proper email service (like Resend, also free to
  start).
- **Every change goes live on its own.** Each time a pull request is merged
  into `main`, Vercel rebuilds the site in a minute or two.
- **Pull requests get preview links.** Vercel comments a preview link on each
  pull request, so you can try changes before merging them.
