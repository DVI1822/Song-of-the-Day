// Values come from .env.local (on your computer) or from Vercel's
// Environment Variables settings (when deployed). See SETUP.md.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const isConfigured = Boolean(supabaseUrl && supabaseKey);
