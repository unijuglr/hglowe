import "server-only";
import type { ReactNode } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx-components";

export type RenderResult = { ok: true; node: ReactNode } | { ok: false; error: string };

/** Compile an MDX string to React. Never throws; returns the error text instead. */
export async function renderMdx(source: string): Promise<RenderResult> {
  try {
    const { content } = await compileMDX({
      source,
      components: mdxComponents,
      options: {
        parseFrontmatter: false,
        // GFM adds tables and ~~strikethrough~~, which the visual editor can produce.
        mdxOptions: { remarkPlugins: [remarkGfm] },
      },
    });
    return { ok: true, node: content };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
