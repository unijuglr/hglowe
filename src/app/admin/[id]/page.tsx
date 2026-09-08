import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findSection, getFirestoreStatus, getSection, readDefaultMdx } from "@/lib/content";
import { renderMdx } from "@/lib/mdx";
import { SECTION_STYLES } from "@/lib/sections";
import { updateSectionMetaAction } from "../actions";
import { Editor } from "./editor";

export const dynamic = "force-dynamic";

export default async function EditSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const [{ id }, { error, message }] = await Promise.all([params, searchParams]);
  const meta = await findSection(id);
  if (!meta) notFound();

  const [section, fs, defaultMdx] = await Promise.all([getSection(meta), getFirestoreStatus(), readDefaultMdx(id)]);
  const initial = await renderMdx(section.mdx);

  return (
    <div className="admin">
      <div className="admin-bar">
        <div>
          <p className="help" style={{ margin: 0 }}>
            <a href="/admin">← All sections</a>
          </p>
          <h1 style={{ margin: 0 }}>{section.label}</h1>
        </div>
        <a className="btn secondary" href={`/#${id}`} target="_blank" rel="noreferrer">
          View on site ↗
        </a>
      </div>

      {!fs.ok ? <div className="notice warn">Saving is off: {fs.message}</div> : null}
      {section.error && section.error !== fs.message ? <div className="notice warn">{section.error}</div> : null}
      {error ? <div className="notice err">{error}</div> : null}
      {message ? <div className="notice ok">{message}</div> : null}

      <details className="settings">
        <summary>Section settings (name and style)</summary>
        <form action={updateSectionMetaAction} className="add-form">
          <input type="hidden" name="id" value={id} />
          <label>
            Name
            <input name="label" type="text" required maxLength={60} defaultValue={section.label} disabled={!fs.ok} />
          </label>
          <label>
            Style
            <select name="style" defaultValue={section.style} disabled={!fs.ok}>
              {SECTION_STYLES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={!fs.ok}>
            Save settings
          </button>
        </form>
      </details>

      <Editor
        id={id}
        style={section.style}
        initialMdx={section.mdx}
        defaultMdx={defaultMdx}
        source={section.source}
        canSave={fs.ok}
        initialPreview={
          initial.ok ? (
            <section className="site-section" data-style={section.style}>
              <div className="site-section-inner">{initial.node}</div>
            </section>
          ) : (
            <div className="notice err">{initial.error}</div>
          )
        }
      />
    </div>
  );
}
