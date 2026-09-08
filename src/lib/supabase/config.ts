export function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

const DEFAULT_ADMIN_EMAILS = ["hglowe1@gmail.com", "goldband@gmail.com"];

/** Emails allowed into /admin. Comma-separated ADMIN_EMAILS env var, with a sane default. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  const list = raw ? raw.split(",") : DEFAULT_ADMIN_EMAILS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * Local-development escape hatch: when running `next dev` (never a production build)
 * with LOCAL_ADMIN_EMAIL set, treat requests as that signed-in admin so the editor can be
 * used before Supabase is wired up. Ignored entirely in production.
 */
export function localDevAdminEmail(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
  return email && isAdminEmail(email) ? email : null;
}
