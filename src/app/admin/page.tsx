import { requireAdmin } from "@/lib/auth";
import { getAllSections, getFirestoreStatus } from "@/lib/content";
import { SECTION_STYLES } from "@/lib/sections";
import { addSectionAction, deleteSectionAction, moveSectionAction, signOut } from "./actions";

export const dynamic = "force-dynamic";

function fmt(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; remove?: string }>;
}) {
  const user = await requireAdmin();
  const [{ layout, sections }, fs, { error, message, remove }] = await Promise.all([
    getAllSections(),
    getFirestoreStatus(),
    searchParams,
  ]);
  const canEditLayout = fs.ok;
  const removing = remove ? sections.find((s) => s.id === remove && !s.builtin) : undefined;

  return (
    <div className="admin">
      <div className="admin-bar">
        <div>
          <h1 style={{ margin: 0 }}>Site sections</h1>
          <span className="who">Signed in as {user.email}</span>
        </div>
        <div className="btn-row" style={{ margin: 0 }}>
          <a className="btn secondary" href="/" target="_blank" rel="noreferrer">
            View site ↗
          </a>
          <form action={signOut}>
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className={`notice ${fs.ok ? "ok" : "warn"}`}>
        {fs.ok ? "Saving is on. " : "Saving is off. "}
        {fs.message}
        {!fs.ok ? " Until it's connected, the site shows the built-in defaults and edits can't be saved." : ""}
      </div>
      {error ? <div className="notice err">{error}</div> : null}
      {message ? <div className="notice ok">{message}</div> : null}
      {removing ? (
        <div className="notice err">
          <p style={{ marginTop: 0 }}>
            Remove <strong>{removing.label}</strong> and delete its content? This can&apos;t be undone.
          </p>
          <div className="btn-row" style={{ margin: 0 }}>
            <form action={deleteSectionAction}>
              <input type="hidden" name="id" value={removing.id} />
              <button className="btn danger" type="submit" disabled={!canEditLayout}>
                Yes, remove it
              </button>
            </form>
            <a className="btn secondary" href="/admin">
              Cancel
            </a>
          </div>
        </div>
      ) : null}

      <table>
        <thead>
          <tr>
            <th style={{ width: "6rem" }}>Order</th>
            <th>Section</th>
            <th>Content</th>
            <th>Last edited</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s, i) => (
            <tr key={s.id}>
              <td>
                <div className="order-btns">
                  <form action={moveSectionAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="btn secondary small" type="submit" disabled={!canEditLayout || i === 0} title="Move up" aria-label={`Move ${s.label} up`}>
                      ↑
                    </button>
                  </form>
                  <form action={moveSectionAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button className="btn secondary small" type="submit" disabled={!canEditLayout || i === sections.length - 1} title="Move down" aria-label={`Move ${s.label} down`}>
                      ↓
                    </button>
                  </form>
                </div>
              </td>
              <td>
                <strong>{s.label}</strong>
                <br />
                <span className="help">
                  {s.id} · {SECTION_STYLES.find((st) => st.id === s.style)?.label.split(" (")[0] ?? s.style}
                  {s.builtin ? "" : " · custom"}
                </span>
              </td>
              <td>
                <span className={`badge ${s.source}`}>{s.source === "firestore" ? "Edited" : "Default"}</span>
              </td>
              <td>
                {s.updatedAt ? fmt(s.updatedAt) : "—"}
                {s.updatedBy ? (
                  <>
                    <br />
                    <span className="help">{s.updatedBy}</span>
                  </>
                ) : null}
              </td>
              <td>
                <div className="btn-row" style={{ margin: 0, justifyContent: "flex-end" }}>
                  <a className="btn" href={`/admin/${s.id}`}>
                    Edit
                  </a>
                  {!s.builtin ? (
                    <a className="btn danger small" href={`/admin?remove=${s.id}`} title="Remove this section">
                      Remove
                    </a>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add a section</h2>
      <form action={addSectionAction} className="add-form">
        <label>
          Name
          <input name="label" type="text" required maxLength={60} placeholder="e.g. Speaking" disabled={!canEditLayout} />
        </label>
        <label>
          Style
          <select name="style" defaultValue="plain" disabled={!canEditLayout}>
            {SECTION_STYLES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" disabled={!canEditLayout}>
          Add section
        </button>
      </form>
      <p className="help">
        New sections go at the bottom; use the arrows to move them. Layout is {layout.source === "firestore" ? "saved in Firestore" : "the built-in default"}.
      </p>

      <details>
        <summary>How editing works</summary>
        <p>
          Each section is a small MDX document (Markdown plus a few custom tags). Edits are saved per section to
          Firestore; anything you haven&apos;t edited keeps using the default that ships with the site. &quot;Reset&quot;
          on a section throws away your edit and goes back to that default.
        </p>
        <p>Custom tags you can use:</p>
        <pre>{`<Label>Intro</Label>                       small heading beside a card
<Card>...paragraphs...</Card>              black card with light text
<Project n="01" title="Name" href="https://…">
  One-line description.
</Project>                                 numbered project row
<Columns>…paragraphs…</Columns>              side-by-side columns (one per paragraph)
<Align to="center">…</Align>               centered / right-aligned paragraphs (toolbar buttons write this for you)
<Spacer size="lg" />                       vertical space: sm, md, lg
<Button href="https://…">Download CV</Button> link styled as a button`}</pre>
        <p>
          Plain Markdown works too: <code># Heading</code>, <code>*italic*</code>, <code>**bold**</code>,{" "}
          <code>[link text](https://…)</code>, <code>~~strikethrough~~</code>, <code>![alt](image-url)</code>, tables,
          <code>---</code> for a rule, blank line between paragraphs, <code>\\</code> at the end of a line for a line break
          (Shift+Enter in the visual editor).
        </p>
      </details>
    </div>
  );
}
