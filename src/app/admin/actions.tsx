"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import {
  addSection,
  deleteSection,
  findSection,
  moveSection,
  readDefaultMdx,
  resetSection,
  saveSection,
  updateSectionMeta,
} from "@/lib/content";
import { renderMdx } from "@/lib/mdx";
import { isSectionStyle, type SectionStyle } from "@/lib/sections";
import { isAdminEmail } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function revalidateAll(id?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/${id}`);
}

function fail(err: unknown): ActionResult {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

// ---------- auth ----------

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/login?error=" + encodeURIComponent("Supabase is not configured on the server."));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/admin/login?error=" + encodeURIComponent(error.message));

  if (!isAdminEmail(email)) {
    await supabase.auth.signOut();
    redirect("/admin/denied");
  }
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------- section content ----------

export async function saveSectionAction(id: string, mdx: string): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!(await findSection(id))) return { ok: false, error: `Unknown section "${id}".` };

  // Refuse to save MDX that doesn't compile, so the live site can't break.
  const compiled = await renderMdx(mdx);
  if (!compiled.ok) return { ok: false, error: `This won't compile, so it wasn't saved:\n${compiled.error}` };

  try {
    await saveSection(id, mdx, user.email);
  } catch (err) {
    return fail(err);
  }
  revalidateAll(id);
  return { ok: true, message: "Saved. The live site is updated." };
}

export async function resetSectionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!(await findSection(id))) return { ok: false, error: `Unknown section "${id}".` };
  try {
    await resetSection(id);
  } catch (err) {
    return fail(err);
  }
  revalidateAll(id);
  return { ok: true, message: "Reset to the built-in default." };
}

export type PreviewResult = { ok: true; node: ReactNode } | { ok: false; error: string };

/** Compile MDX and return the rendered React tree for the editor's preview pane. */
export async function previewSectionAction(id: string, mdx: string, style: string): Promise<PreviewResult> {
  await requireAdmin();
  if (!(await findSection(id))) return { ok: false, error: `Unknown section "${id}".` };
  const result = await renderMdx(mdx);
  if (!result.ok) return result;
  return {
    ok: true,
    node: (
      <section className="site-section" data-style={isSectionStyle(style) ? style : "plain"}>
        <div className="site-section-inner">{result.node}</div>
      </section>
    ),
  };
}

export async function getDefaultMdxAction(id: string): Promise<string> {
  await requireAdmin();
  return readDefaultMdx(id);
}

// ---------- layout: add / move / rename / delete ----------

function readStyle(formData: FormData): SectionStyle {
  const style = String(formData.get("style") ?? "plain");
  return isSectionStyle(style) ? style : "plain";
}

/** Form action: create a new section and jump to its editor. */
export async function addSectionAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const label = String(formData.get("label") ?? "");
  let id: string;
  try {
    const meta = await addSection(label, readStyle(formData), user.email);
    id = meta.id;
  } catch (err) {
    redirect("/admin?error=" + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
  revalidateAll(id);
  redirect(`/admin/${id}`);
}

/** Form action: swap a section with its neighbour. */
export async function moveSectionAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction")) === "up" ? -1 : 1;
  try {
    await moveSection(id, direction, user.email);
  } catch (err) {
    redirect("/admin?error=" + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
  revalidateAll();
  redirect("/admin");
}

/** Form action: remove a custom section and its content. */
export async function deleteSectionAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    await deleteSection(id, user.email);
  } catch (err) {
    redirect("/admin?error=" + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
  revalidateAll(id);
  redirect("/admin?message=" + encodeURIComponent(`Removed section "${id}".`));
}

/** Form action: rename a section or change its style. */
export async function updateSectionMetaAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "");
  try {
    await updateSectionMeta(id, { label, style: readStyle(formData) }, user.email);
  } catch (err) {
    redirect(`/admin/${id}?error=` + encodeURIComponent(err instanceof Error ? err.message : String(err)));
  }
  revalidateAll(id);
  redirect(`/admin/${id}?message=` + encodeURIComponent("Section settings saved."));
}
