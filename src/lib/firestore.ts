import "server-only";
import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Namespaced: the (default) Firestore database in ai-bitz is shared with other apps.
export const SECTIONS_COLLECTION = "hglowe_sections";
export const LAYOUT_COLLECTION = "hglowe_site";
export const LAYOUT_DOC = "layout";

let cached: { db: Firestore | null; reason?: string } | undefined;

/**
 * Lazily initialise the Firestore admin client using Application Default
 * Credentials. On Cloud Run this is the service's runtime service account;
 * locally it's `gcloud auth application-default login`.
 *
 * Returns null (with a reason) when Firestore isn't configured, so the site
 * can keep serving the default MDX from the repo.
 */
export function getFirestoreClient(): { db: Firestore | null; reason?: string } {
  if (cached) return cached;

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    cached = { db: null, reason: "GOOGLE_CLOUD_PROJECT is not set; serving default content from the repo." };
    return cached;
  }

  try {
    const app: App = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
    const databaseId = process.env.FIRESTORE_DATABASE_ID || "(default)";
    const db = getFirestore(app, databaseId);
    cached = { db };
  } catch (err) {
    cached = { db: null, reason: `Firestore init failed: ${errorMessage(err)}` };
  }
  return cached;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
