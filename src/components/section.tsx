import { renderMdx } from "@/lib/mdx";
import { readDefaultMdx } from "@/lib/content";
import type { SectionContent } from "@/lib/sections";

/**
 * Render a section on the public site. If the stored MDX fails to compile,
 * fall back to the default so a bad edit never breaks the page.
 */
export async function Section({ section }: { section: SectionContent }) {
  let result = await renderMdx(section.mdx);
  if (!result.ok && section.source === "firestore") {
    console.error(`[section:${section.id}] stored MDX failed to compile, using default:`, result.error);
    result = await renderMdx(await readDefaultMdx(section.id));
  }
  return (
    <section className="site-section" data-style={section.style} data-section={section.id} id={section.id}>
      <div className="site-section-inner">
        {result.ok ? result.node : <p className="mdx-error">This section could not be rendered.</p>}
      </div>
    </section>
  );
}
