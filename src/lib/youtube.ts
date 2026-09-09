/**
 * Pull the 11-character video id out of any common YouTube link:
 * youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID, /embed/ID, /live/ID,
 * or a bare id. Returns null when it isn't a YouTube video.
 */
export function youtubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    if (!id) {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Optional start time from a `t=90` or `t=1m30s` parameter, in whole seconds. */
export function youtubeStartSeconds(input: string): number | null {
  try {
    const t = new URL(input.includes("://") ? input : `https://${input}`).searchParams.get("t");
    if (!t) return null;
    if (/^\d+s?$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return null;
    return (parseInt(m[1] ?? "0", 10) * 3600) + (parseInt(m[2] ?? "0", 10) * 60) + parseInt(m[3] ?? "0", 10);
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(id: string, start: number | null): string {
  const params = new URLSearchParams({ rel: "0" });
  if (start && start > 0) params.set("start", String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
