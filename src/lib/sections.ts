/** Visual treatment for a section. Drives the CSS via `data-style`. */
export const SECTION_STYLES = [
  { id: "plain", label: "Plain text (headings + paragraphs)" },
  { id: "hero", label: "Big headline (like the top of the page)" },
  { id: "card", label: "Label + black card" },
  { id: "list", label: "Numbered project list" },
  { id: "note", label: "Small centered note" },
  { id: "contact", label: "Big centered heading + columns" },
] as const;

export type SectionStyle = (typeof SECTION_STYLES)[number]["id"];

export function isSectionStyle(value: string): value is SectionStyle {
  return SECTION_STYLES.some((s) => s.id === value);
}

export interface SectionMeta {
  id: string;
  label: string;
  style: SectionStyle;
  /** Built-in sections ship with a default MDX file and can't be deleted (only reset). */
  builtin: boolean;
}

/** The sections the site starts with. Order here is the default order. */
export const DEFAULT_SECTIONS: SectionMeta[] = [
  { id: "hero", label: "Hero headline", style: "hero", builtin: true },
  { id: "intro", label: "Intro", style: "card", builtin: true },
  { id: "work", label: "Work / projects", style: "list", builtin: true },
  { id: "cv", label: "My CV", style: "card", builtin: true },
  { id: "disclaimer", label: "Disclaimer", style: "note", builtin: true },
  { id: "contact", label: "Get in touch", style: "contact", builtin: true },
];

export function isBuiltinId(id: string): boolean {
  return DEFAULT_SECTIONS.some((s) => s.id === id);
}

/** Section ids are URL segments and Firestore doc ids: keep them simple. */
export const SECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}$/;

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type SectionSource = "firestore" | "default";

export interface SectionContent extends SectionMeta {
  mdx: string;
  /** Where the served content came from. */
  source: SectionSource;
  updatedAt?: string;
  updatedBy?: string;
  /** Set when Firestore was configured but could not be read; content fell back to default. */
  error?: string;
}

export interface Layout {
  sections: SectionMeta[];
  /** "firestore" when a saved layout exists, "default" otherwise. */
  source: SectionSource;
  error?: string;
}
