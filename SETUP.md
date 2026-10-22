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
3. Click **Create new project** and wait a minute or two while it sets up.

### Create the tables

1. In the left sidebar, open **SQL Editor**.
2. Click **New query** (or the **+**).
3. On GitHub, open the file
   [`supabase/migrations/20261022000000_init.sql`](supabase/migrations/20261022000000_init.sql),
   click the **copy** icon at the top right of the file, and paste it all into
   the SQL editor.
4. Click **Run**. You should see "Success. No rows returned."

You can check it worked under **Table Editor**: there should be `profiles`,
`posts` and `follows` tables.

### Copy your two keys

1. Click the **Connect** button at the top of your project page (or go to
   **Project Settings → API Keys**).
2. Find and copy these two values somewhere handy:
   - **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - **Publishable key**, which starts with `sb_publishable_`
     (on older projects this is called the **anon public** key)

These two are fine to paste into Vercel and fine to share with me. Never share
the **secret** key or the **service_role** key: the app doesn't use them.

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

## Part 5: Try it

1. Open your site, click **Get started**, and enter your email.
2. Open the link in the email **on the same phone or browser** you asked from.
3. Pick your name and username.
4. Tap **+**, paste a Spotify link, write a caption, and share.
5. Send the link to a friend, have them sign up, and follow each other from
   **People → Follow**. Their tile appears on your Globe.

You can also open `/demo` on your site to see a Globe full of made-up friends.

---

## Good to know

- **Sign-in emails are limited.** Supabase's built-in email sender only sends a
  few emails an hour. That's fine while it's you and a few friends. When more
  people join, we'll hook up a proper email service (like Resend, also free to
  start).
- **Every change goes live on its own.** Each time a pull request is merged
  into `main`, Vercel rebuilds the site in a minute or two.
- **Pull requests get preview links.** Vercel comments a preview link on each
  pull request, so you can try changes before merging them.
