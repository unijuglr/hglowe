import type { ImgHTMLAttributes, ReactNode } from "react";

/** Small uppercase-ish label that sits beside a card ("Intro", "My CV"). */
export function Label({ children }: { children: ReactNode }) {
  return <p className="label">{children}</p>;
}

/** Black card with light text. */
export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}

/** One numbered project row in the work list. */
export function Project({
  n,
  title,
  href,
  children,
}: {
  n: string;
  title: string;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <article className="project">
      <span className="project-n">{n}</span>
      <div className="project-body">
        <h3 className="project-title">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer">
              {title}
            </a>
          ) : (
            title
          )}
        </h3>
        <div className="project-desc">{children}</div>
      </div>
    </article>
  );
}

/** Evenly spaced columns (used by the contact block). */
export function Columns({ children }: { children: ReactNode }) {
  return <div className="columns">{children}</div>;
}

export type Alignment = "left" | "center" | "right";

/** Aligns everything inside it. `<Align to="center">…</Align>` */
export function Align({ to = "left", children }: { to?: Alignment | string; children: ReactNode }) {
  const dir: Alignment = to === "center" || to === "right" ? to : "left";
  return <div className={`align align-${dir}`}>{children}</div>;
}

export type SpacerSize = "sm" | "md" | "lg";

/** Vertical breathing room. `<Spacer size="lg" />` */
export function Spacer({ size = "md" }: { size?: SpacerSize | string }) {
  const s: SpacerSize = size === "sm" || size === "lg" ? size : "md";
  return <div className={`spacer spacer-${s}`} aria-hidden="true" />;
}

/** A link styled as a button. `<Button href="…">Download CV</Button>` */
export function Button({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <a className="btn-link" href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {children}
    </a>
  );
}

function Img(props: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={props.alt ?? ""} className="content-img" loading="lazy" />;
}

export const mdxComponents = { Label, Card, Project, Columns, Align, Spacer, Button, img: Img };
