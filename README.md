# gloweup — Heather Glowe's site

A small Next.js site whose content is six editable **sections**, each a short MDX
document. Defaults ship in the repo under `content/sections/`; edits made in the
admin UI are stored **per section** in Firestore, so you can change one section
without touching the others and reset any section back to its default.

- **Public site**: `/`
- **Editor**: `/admin` (sign in with Supabase email + password; only allow-listed emails get in)

## How content works

| Layer | Where | Notes |
|---|---|---|
| Default | `content/sections/<id>.mdx` | Checked into git. Used when there's no Firestore override. |
| Override | Firestore `hglowe_sections/<id>` `{ mdx, updatedAt, updatedBy }` | Written by the admin UI. Delete the doc ("Reset") to fall back. |

Built-in sections: `hero`, `intro`, `work`, `cv`, `disclaimer`, `contact` (see `src/lib/sections.ts`).

The list of sections and their order is itself editable. It lives in Firestore at
`hglowe_site/layout` as `{ sections: [{ id, label, style }] }`; when that doc is absent
the built-in list is used. From `/admin` you can add a section (choosing a visual
style: plain, hero, card, list, note, contact), move sections up and down, rename or
restyle them, and remove custom ones. Built-in sections can be moved and restyled but
not removed; reset them instead.

The editor at `/admin/<section>` has two modes. **Visual** is a WYSIWYG editor
(MDXEditor) that shows headings, links, lists and the custom blocks as editable
pieces, with an "Insert" menu for the custom blocks. **Source (MDX)** is a plain
textarea over the same text. Switching modes carries edits across; the visual
editor re-serialises the MDX, so formatting may be normalised slightly. If the
visual editor can't open a document it drops to Source with the error shown.

MDX is Markdown (with GFM tables and strikethrough) plus a few custom tags:
`<Label>`, `<Card>`, `<Project>`, `<Columns>`, `<Align to="center">`, `<Spacer size="lg" />`
and `<Button href>`, all defined in `src/components/mdx-components.tsx`. The visual
editor has toolbar buttons for alignment, images (by URL), tables, and rules, and an
Insert menu for the custom blocks.

Alignment works like a word processor: the buttons align the paragraph(s) the cursor is
in; with part of a paragraph selected, that part is split out into its own paragraph
first. In the editor it's plain aligned text; in MDX it's stored as `<Align to="…">`
around the block(s) (see `src/app/admin/[id]/alignment-plugin.ts`). Shift+Enter inserts a
line break, written as a Markdown hard break (`\` at the end of the line). The editor refuses to save MDX that
doesn't compile, and the public page falls back to the default if a stored section
ever fails to render, so a bad edit can't take the site down.

## Local development

```bash
cp .env.example .env.local   # fill in Supabase + GCP values
npm install
npm run dev                  # http://localhost:3000
```

- To use `/admin` locally **without** Supabase, set `LOCAL_ADMIN_EMAIL=goldband@gmail.com`
  in `.env.local`. This only works under `next dev`, never in a production build.
- To save to Firestore locally, run `gcloud auth application-default login` and set
  `GOOGLE_CLOUD_PROJECT` in `.env.local`.
- Or point at the emulator instead: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GOOGLE_CLOUD_PROJECT=demo-hglowe`.

## Auth (Supabase)

1. Create a Supabase project. In **Authentication → Providers**, keep Email enabled.
   Optionally turn off "Allow new users to sign up" (the allow-list makes this safe either way).
2. In **Authentication → Users**, add a user for each editor (email + password, auto-confirm).
3. Put the project URL and the anon/publishable key in `.env.local` as
   `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. `ADMIN_EMAILS` controls who can edit; it defaults to `hglowe1@gmail.com,goldband@gmail.com`.

## Deploying to Cloud Run

One-time, per GCP project (enables APIs, creates the Artifact Registry repo and the
Firestore database, grants the Cloud Run service account Firestore access):

```bash
gcloud auth login
scripts/gcp-setup.sh <PROJECT_ID>
```

Then either:

```bash
scripts/deploy.sh <PROJECT_ID>          # reads Supabase values from .env.local
```

or let the existing Cloud Build trigger do it on a `cloudrun-production-N` tag
(`./tag-github-main-cloudrun-production.sh`). If you use the trigger, set the
`_SUPABASE_URL` and `_SUPABASE_ANON_KEY` substitution variables on the trigger.

The container listens on `8080` and reads all runtime config from environment
variables (see `cloudbuild.yaml`). Firestore auth on Cloud Run is the service's
default service account, so no key files are involved.

## Repo layout

```
content/sections/   default MDX per section
src/app/            Next.js app router: public page + /admin
src/components/     MDX tags and the section renderer
src/lib/            Firestore, content loading, Supabase, auth
scripts/            gcp-setup.sh, deploy.sh
static/             the old Squarespace mirror (kept for reference; not deployed)
```
