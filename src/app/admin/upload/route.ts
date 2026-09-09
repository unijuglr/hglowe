import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { uploadImage } from "@/lib/images";

export const runtime = "nodejs";

/**
 * POST /admin/upload  (multipart form, field "file")
 * Used by the visual editor's image dialog. Responds { url } or { error }.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await getAdminUser())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent." }, { status: 400 });

  const result = await uploadImage(file);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ url: result.url });
}
