#!/usr/bin/env bash
# One-time GCP setup for the hglowe site: APIs, Artifact Registry repo, Firestore, IAM.
# Usage: scripts/gcp-setup.sh [PROJECT_ID]   (defaults to the active gcloud project)
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-us-central1}"
[[ -n "$PROJECT_ID" ]] || { echo "No project id. Pass one or run: gcloud config set project <id>"; exit 1; }

echo "==> Project: $PROJECT_ID  Region: $REGION"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com

echo "==> Artifact Registry repo 'containers' (used by cloudbuild.yaml)"
if ! gcloud artifacts repositories describe containers --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create containers --repository-format=docker --location="$REGION"
fi

echo "==> Firestore database (Native mode)"
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" --type=firestore-native
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "==> IAM: Cloud Run runtime SA ($RUN_SA) can read/write Firestore"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA}" --role="roles/datastore.user" --quiet >/dev/null

echo "==> IAM: Cloud Build can deploy to Cloud Run and act as the runtime SA"
for SA in "$BUILD_SA" "$RUN_SA"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="roles/run.admin" --quiet >/dev/null
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA}" --role="roles/artifactregistry.writer" --quiet >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --member="serviceAccount:${BUILD_SA}" --role="roles/iam.serviceAccountUser" --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --member="serviceAccount:${RUN_SA}" --role="roles/iam.serviceAccountUser" --quiet >/dev/null

echo "==> Done. Next: scripts/deploy.sh"
