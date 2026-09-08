import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import { isAdminEmail, localDevAdminEmail } from "./supabase/config";

export interface AdminUser {
  id: string;
  email: string;
}

/** Return the signed-in, allow-listed admin, or null. */
export async function getAdminUser(): Promise<AdminUser | null> {
  const local = localDevAdminEmail();
  if (local) return { id: "local-dev", email: local };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}

/** For pages/actions under /admin: redirect to login if not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
