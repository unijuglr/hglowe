#!/usr/bin/env bash
# Make hglowe-www publicly reachable. Needs Org Policy Administrator + Cloud Run Admin.
set -euo pipefail
cd "$(dirname "$0")"
PROJECT_ID="${1:-ai-bitz}"

echo "==> 1/3 Allow allUsers grants in $PROJECT_ID (org policy override)"
gcloud org-policies set-policy gcp-allow-public.yaml --project "$PROJECT_ID"

echo "==> 2/3 Grant public invoke on hglowe-www"
gcloud run services add-iam-policy-binding hglowe-www \
  --project "$PROJECT_ID" --region us-central1 \
  --member=allUsers --role=roles/run.invoker

echo "==> 3/3 Let the Cloud Run runtime service account read/write Firestore"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user" --condition=None --quiet >/dev/null

echo "==> Done. Check: curl -sI https://hglowe-www-767973678967.us-central1.run.app/ | head -1"
