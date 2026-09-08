import { Section } from "@/components/section";
import { getAllSections } from "@/lib/content";

// Content lives in Firestore and can change at any time: render per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { sections } = await getAllSections();
  return (
    <>
      <header className="site-header">
        <a className="site-title" href="/">
          gloweup
        </a>
        <nav>
          <a href="https://www.linkedin.com/in/heatherglowe/" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </nav>
      </header>
      <main>
        {sections.map((s) => (
          <Section key={s.id} section={s} />
        ))}
      </main>
    </>
  );
}
