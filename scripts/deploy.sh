#!/usr/bin/env bash
# Build + deploy to Cloud Run via Cloud Build, using the values in .env.local for runtime config.
# Usage: scripts/deploy.sh [PROJECT_ID]
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
[[ -n "$PROJECT_ID" ]] || { echo "No project id."; exit 1; }

if [[ -f .env.local ]]; then
  # shellcheck disable=SC1091
  set -a; source .env.local; set +a
fi

: "${SUPABASE_URL:=}"
: "${SUPABASE_ANON_KEY:=}"
: "${ADMIN_EMAILS:=hglowe1@gmail.com,goldband@gmail.com}"
[[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" ]] || echo "WARNING: SUPABASE_URL / SUPABASE_ANON_KEY are empty; /admin sign-in will be disabled on this deploy."

SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo manual)"

gcloud builds submit --project "$PROJECT_ID" --config cloudbuild.yaml \
  --substitutions="SHORT_SHA=${SHORT_SHA},_SUPABASE_URL=${SUPABASE_URL},_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY},_ADMIN_EMAILS=${ADMIN_EMAILS}" .

echo
gcloud run services describe hglowe-www --project "$PROJECT_ID" --region us-central1 --format='value(status.url)'
