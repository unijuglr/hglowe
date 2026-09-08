import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { supabaseConfig } from "@/lib/supabase/config";
import { signIn } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const configured = supabaseConfig() !== null;

  if (configured && (await getAdminUser())) redirect("/admin");

  return (
    <div className="login">
      <h1>Edit gloweup</h1>
      {!configured ? (
        <div className="notice warn">
          Sign-in isn&apos;t set up yet. The server needs <code>SUPABASE_URL</code> and{" "}
          <code>SUPABASE_ANON_KEY</code> (see <code>.env.example</code>).
        </div>
      ) : (
        <form action={signIn}>
          <input type="hidden" name="next" value={next ?? "/admin"} />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          {error ? <div className="notice err">{error}</div> : null}
          <button className="btn" type="submit">
            Sign in
          </button>
        </form>
      )}
      <p className="help" style={{ marginTop: "1.5rem" }}>
        <a href="/">← Back to the site</a>
      </p>
    </div>
  );
}
