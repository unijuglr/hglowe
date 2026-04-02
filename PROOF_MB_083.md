# PROOF_MB_083

## Summary
Diagnosed the Cloud Run deploy path for the HGlowe static site and applied the minimal safe repo-local fix.

## What I inspected
- `cloudbuild.yaml`
- `Dockerfile`
- `static/index.html`
- mirrored asset tree under `static/`

## Most likely root cause
The container image was relying on two implicit behaviors at once:

1. **Default nginx site config** from `nginx:alpine`
2. **Directory-copy semantics** from `COPY static /usr/share/nginx/html`

The mirrored site is a Squarespace export with a root-served contract:
- `index.html` expects to be served as the site root
- local assets are referenced from `static/...`
- serving behavior is safest when `/` explicitly resolves to `index.html` and unknown paths fall back to `index.html`

While the asset tree itself is present, the image had no repo-local nginx config making that contract explicit. For a static mirrored site on Cloud Run, this is the most likely source of “deploys successfully but doesn’t serve correctly” behavior.

## Repo-local fix applied
- Added explicit `nginx.conf` with:
  - `root /usr/share/nginx/html;`
  - `index index.html;`
  - `try_files $uri $uri/ /index.html;`
- Tightened Docker copy semantics to explicitly copy the site contents into nginx web root.

## Evidence collected
### Asset tree exists as expected
```text
static/index.html
static/static/versioned-site-css/651244578956962ea8e38127/17/5c5a519771c10ba3470d8101/651244578956962ea8e3812e/1766/site.css
static/static/vta/5c5a519771c10ba3470d8101/scripts/site-bundle.e2ab04b08a0df90c2e8b8887d08efc58.js
static/static/vta/5c5a519771c10ba3470d8101/versioned-assets/1775067901690-FU1XWDNLTJYPRNLOIFJ1/static.css
```

### HTML path contract observed
Relative local references in `static/index.html`:
- `static/versioned-site-css/.../site.css`
- `static/vta/.../static.css`
- `static/vta/.../site-bundle....js`
- `/` root links also appear in the document

### Local static serving sanity check
A lightweight local HTTP check confirmed the mirrored files are present and readable:
- `GET /static/` → `200 OK`
- `GET /static/static/vta/.../static.css` → `200 OK`

## Files changed
- `Dockerfile`
- `nginx.conf`
- `PROOF_MB_083.md`

## If follow-up verification is needed
After Cloud Build redeploys this commit, verify:
1. Cloud Run service root `/` returns `200`
2. `.../static/vta/.../static.css` returns `200`
3. page renders with CSS applied, not raw unstyled HTML

## Notes
I could not run `docker build` locally because the Docker daemon was unavailable in this environment, and `gcloud` was not installed here, so Cloud Run-side verification remains the next external check.
