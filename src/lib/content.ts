import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  DEFAULT_SECTIONS,
  isBuiltinId,
  isSectionStyle,
  SECTION_ID_PATTERN,
  slugify,
  type Layout,
  type SectionContent,
  type SectionMeta,
  type SectionStyle,
} from "./sections";
import { errorMessage, getFirestoreClient, LAYOUT_COLLECTION, LAYOUT_DOC, SECTIONS_COLLECTION } from "./firestore";

const CONTENT_DIR = path.join(process.cwd(), "content", "sections");

/** Default MDX: the repo file for built-ins, a starter snippet for custom sections. */
export async function readDefaultMdx(id: string): Promise<string> {
  if (isBuiltinId(id)) return fs.readFile(path.join(CONTENT_DIR, `${id}.mdx`), "utf8");
  return "## New section\n\nWrite something here. Plain Markdown works, and so do the custom tags listed under \"How editing works\".\n";
}

interface StoredSection {
  mdx?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

interface StoredLayout {
  sections?: Array<{ id?: unknown; label?: unknown; style?: unknown }>;
}

function toIso(ts?: Timestamp): string | undefined {
  return ts ? ts.toDate().toISOString() : undefined;
}

function requireDb() {
  const { db, reason } = getFirestoreClient();
  if (!db) throw new Error(reason ?? "Firestore is not configured.");
  return db;
}

// ---------- Layout (which sections exist, and in what order) ----------

function normalizeLayout(raw: StoredLayout | undefined): SectionMeta[] | null {
  if (!raw || !Array.isArray(raw.sections)) return null;
  const out: SectionMeta[] = [];
  for (const s of raw.sections) {
    if (typeof s?.id !== "string" || !SECTION_ID_PATTERN.test(s.id)) continue;
    if (out.some((o) => o.id === s.id)) continue;
    const builtin = isBuiltinId(s.id);
    const def = DEFAULT_SECTIONS.find((d) => d.id === s.id);
    const label = typeof s.label === "string" && s.label.trim() ? s.label.trim() : (def?.label ?? s.id);
    const style: SectionStyle =
      typeof s.style === "string" && isSectionStyle(s.style) ? s.style : (def?.style ?? "plain");
    out.push({ id: s.id, label, style, builtin });
  }
  return out;
}

export async function getLayout(): Promise<Layout> {
  const { db, reason } = getFirestoreClient();
  if (!db) return { sections: DEFAULT_SECTIONS, source: "default", error: reason };
  try {
    const snap = await db.collection(LAYOUT_COLLECTION).doc(LAYOUT_DOC).get();
    const sections = snap.exists ? normalizeLayout(snap.data() as StoredLayout) : null;
    if (!sections) return { sections: DEFAULT_SECTIONS, source: "default" };
    return { sections, source: "firestore" };
  } catch (err) {
    console.error("[content] Firestore layout read failed:", err);
    return { sections: DEFAULT_SECTIONS, source: "default", error: `Firestore read failed: ${errorMessage(err)}` };
  }
}

async function saveLayout(sections: SectionMeta[], updatedBy: string): Promise<void> {
  const db = requireDb();
  await db
    .collection(LAYOUT_COLLECTION)
    .doc(LAYOUT_DOC)
    .set({
      sections: sections.map(({ id, label, style }) => ({ id, label, style })),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    });
}

export async function findSection(id: string): Promise<SectionMeta | null> {
  const layout = await getLayout();
  return layout.sections.find((s) => s.id === id) ?? null;
}

export async function addSection(label: string, style: SectionStyle, updatedBy: string): Promise<SectionMeta> {
  const layout = await getLayout();
  const cleanLabel = label.trim();
  if (!cleanLabel) throw new Error("Give the section a name.");
  let base = slugify(cleanLabel) || "section";
  if (!SECTION_ID_PATTERN.test(base)) base = "section";
  let id = base;
  for (let n = 2; layout.sections.some((s) => s.id === id) || isBuiltinId(id); n++) id = `${base}-${n}`;
  const meta: SectionMeta = { id, label: cleanLabel, style, builtin: false };
  await saveLayout([...layout.sections, meta], updatedBy);
  return meta;
}

export async function updateSectionMeta(
  id: string,
  patch: { label?: string; style?: SectionStyle },
  updatedBy: string,
): Promise<void> {
  const layout = await getLayout();
  const idx = layout.sections.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Unknown section "${id}".`);
  const next = layout.sections.map((s, i) =>
    i === idx
      ? { ...s, label: patch.label?.trim() ? patch.label.trim() : s.label, style: patch.style ?? s.style }
      : s,
  );
  await saveLayout(next, updatedBy);
}

export async function moveSection(id: string, direction: -1 | 1, updatedBy: string): Promise<void> {
  const layout = await getLayout();
  const idx = layout.sections.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`Unknown section "${id}".`);
  const target = idx + direction;
  if (target < 0 || target >= layout.sections.length) return;
  const next = [...layout.sections];
  [next[idx], next[target]] = [next[target], next[idx]];
  await saveLayout(next, updatedBy);
}

/** Remove a custom section from the layout and delete its content. Built-ins can't be removed. */
export async function deleteSection(id: string, updatedBy: string): Promise<void> {
  if (isBuiltinId(id)) throw new Error("Built-in sections can't be deleted. Reset them instead.");
  const layout = await getLayout();
  if (!layout.sections.some((s) => s.id === id)) throw new Error(`Unknown section "${id}".`);
  await saveLayout(
    layout.sections.filter((s) => s.id !== id),
    updatedBy,
  );
  await requireDb().collection(SECTIONS_COLLECTION).doc(id).delete();
}

// ---------- Section content ----------

/** Load one section: Firestore override if present, otherwise the default. */
export async function getSection(meta: SectionMeta): Promise<SectionContent> {
  const defaultMdx = await readDefaultMdx(meta.id);
  const base: SectionContent = { ...meta, mdx: defaultMdx, source: "default" };

  const { db, reason } = getFirestoreClient();
  if (!db) return { ...base, error: reason };

  try {
    const snap = await db.collection(SECTIONS_COLLECTION).doc(meta.id).get();
    if (!snap.exists) return base;
    const data = snap.data() as StoredSection;
    if (typeof data.mdx !== "string") return base;
    return {
      ...base,
      mdx: data.mdx,
      source: "firestore",
      updatedAt: toIso(data.updatedAt),
      updatedBy: data.updatedBy,
    };
  } catch (err) {
    console.error(`[content] Firestore read failed for "${meta.id}":`, err);
    return { ...base, error: `Firestore read failed: ${errorMessage(err)}` };
  }
}

export async function getAllSections(): Promise<{ layout: Layout; sections: SectionContent[] }> {
  const layout = await getLayout();
  const sections = await Promise.all(layout.sections.map((meta) => getSection(meta)));
  return { layout, sections };
}

export async function saveSection(id: string, mdx: string, updatedBy: string): Promise<void> {
  await requireDb().collection(SECTIONS_COLLECTION).doc(id).set({
    mdx,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  });
}

export async function resetSection(id: string): Promise<void> {
  await requireDb().collection(SECTIONS_COLLECTION).doc(id).delete();
}

/** Human-readable Firestore connection status for the admin UI. */
export async function getFirestoreStatus(): Promise<{ ok: boolean; message: string }> {
  const { db, reason } = getFirestoreClient();
  if (!db) return { ok: false, message: reason ?? "Firestore is not configured." };
  try {
    await db.collection(SECTIONS_COLLECTION).limit(1).get();
    return { ok: true, message: `Connected to Firestore project "${process.env.GOOGLE_CLOUD_PROJECT}".` };
  } catch (err) {
    return { ok: false, message: `Firestore is configured but unreachable: ${errorMessage(err)}` };
  }
}
