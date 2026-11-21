/**
 * YouTube Data API v3 — read-only video search restricted to vetted channels.
 *
 * Uses the user's own API key (Google Cloud Console → enable "YouTube Data API v3"
 * → Credentials → API key). Searches never run across all of YouTube: each
 * query is scoped with channelId to a channel from the sports catalog, and a
 * channel resolved from a handle is only trusted if its title matches.
 */
import type { VideoChannel } from '../../shared/domain/sports/catalog';
import type { FetchFn } from './canvas';

const API = 'https://www.googleapis.com/youtube/v3';

export class YouTubeError extends Error {
  constructor(
    readonly kind: 'bad_key' | 'not_enabled' | 'quota' | 'network' | 'unexpected',
    message: string,
  ) {
    super(message);
  }
}

export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  channelName: string;
  official: boolean;
  publishedAt: string;
  thumbnail: string | null;
  url: string;
}

async function call<T>(path: string, params: Record<string, string>, key: string, fetchImpl: FetchFn): Promise<T> {
  const u = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('key', key);
  let res: Response;
  try {
    res = await fetchImpl(u.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new YouTubeError('network', 'Couldn’t reach YouTube. Check your internet connection.');
  }
  const body = (await res.json().catch(() => null)) as { error?: { errors?: { reason?: string }[]; message?: string } } | null;
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? '';
    if (reason === 'keyInvalid' || res.status === 400) throw new YouTubeError('bad_key', 'YouTube rejected the API key. Check it was copied completely.');
    if (reason === 'accessNotConfigured' || /has not been used|is disabled/i.test(body?.error?.message ?? '')) {
      throw new YouTubeError('not_enabled', 'This key can’t use the YouTube Data API yet. In Google Cloud Console, enable “YouTube Data API v3” for the key’s project.');
    }
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') throw new YouTubeError('quota', 'Today’s free YouTube quota is used up. Videos will load again tomorrow.');
    if (res.status === 403) throw new YouTubeError('bad_key', 'YouTube refused this key. It may be restricted to other APIs or websites.');
    throw new YouTubeError('unexpected', `YouTube responded with an error (${res.status}).`);
  }
  return body as T;
}

/** Validate a key with a cheap request (1 quota unit). */
export async function validateKey(key: string, fetchImpl: FetchFn = fetch): Promise<void> {
  await call('channels', { part: 'id', id: 'UCjaL0KPdKoNYYGwqc6wZ_4w' }, key, fetchImpl);
}

/** Resolve a vetted channel to its id, verifying the title matches. Returns null if it can't be trusted. */
export async function resolveChannel(ch: VideoChannel, key: string, fetchImpl: FetchFn = fetch): Promise<string | null> {
  const params: Record<string, string> = { part: 'snippet' };
  if (ch.channelId) params.id = ch.channelId;
  else params.forHandle = ch.handle;
  const r = await call<{ items?: { id: string; snippet?: { title?: string } }[] }>('channels', params, key, fetchImpl);
  const item = r.items?.[0];
  if (!item) return null;
  const title = item.snippet?.title ?? '';
  return title.toLowerCase().includes(ch.expectTitle.toLowerCase()) ? item.id : null;
}

export async function searchChannel(channelId: string, ch: VideoChannel, query: string, key: string, fetchImpl: FetchFn = fetch, max = 6): Promise<VideoResult[]> {
  const r = await call<{ items?: { id?: { videoId?: string }; snippet?: { title?: string; channelId?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } } }[] }>(
    'search',
    { part: 'snippet', type: 'video', channelId, q: query, maxResults: String(max), safeSearch: 'strict', order: 'relevance' },
    key,
    fetchImpl,
  );
  return (r.items ?? [])
    .filter((it) => it.id?.videoId && it.snippet?.channelId === channelId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: decodeEntities(it.snippet?.title ?? ''),
      channelTitle: it.snippet?.channelTitle ?? ch.name,
      channelName: ch.name,
      official: ch.official,
      publishedAt: it.snippet?.publishedAt ?? '',
      thumbnail: thumbUrl(it.snippet?.thumbnails?.medium?.url),
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(it.id!.videoId!)}`,
    }));
}

/** Only allow YouTube's own image host for thumbnails. */
function thumbUrl(u: string | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (url.hostname === 'i.ytimg.com' || url.hostname.endsWith('.ytimg.com')) ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/* ---------- open research (Coach): search, stats, top comments ---------- */

export interface ResearchVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  views: number | null;
  likes: number | null;
  commentCount: number | null;
  durationSeconds: number | null;
}

/** ISO 8601 duration (PT1H2M3S) to seconds. */
export function isoSeconds(d: string | undefined): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d ?? '');
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : null;
}

/** Search all of YouTube (strict safe search), then load each video's numbers. About 101 quota units. */
export async function searchVideos(query: string, key: string, fetchImpl: FetchFn = fetch, max = 8): Promise<ResearchVideo[]> {
  const s = await call<{ items?: { id?: { videoId?: string } }[] }>(
    'search',
    { part: 'snippet', type: 'video', q: query, maxResults: String(max), safeSearch: 'strict', order: 'relevance', relevanceLanguage: 'en' },
    key,
    fetchImpl,
  );
  const ids = (s.items ?? []).map((i) => i.id?.videoId).filter((v): v is string => !!v && /^[\w-]{6,20}$/.test(v));
  if (!ids.length) return [];
  const v = await call<{ items?: { id: string; snippet?: { title?: string; channelTitle?: string; publishedAt?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; contentDetails?: { duration?: string } }[] }>(
    'videos',
    { part: 'snippet,statistics,contentDetails', id: ids.join(',') },
    key,
    fetchImpl,
  );
  const num = (x: string | undefined) => (x === undefined ? null : Number(x));
  return (v.items ?? []).map((it) => ({
    videoId: it.id,
    title: decodeEntities(it.snippet?.title ?? ''),
    channelTitle: it.snippet?.channelTitle ?? '',
    publishedAt: it.snippet?.publishedAt ?? '',
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(it.id)}`,
    views: num(it.statistics?.viewCount),
    likes: num(it.statistics?.likeCount),
    commentCount: num(it.statistics?.commentCount),
    durationSeconds: isoSeconds(it.contentDetails?.duration),
  }));
}

export interface VideoComment {
  text: string;
  likes: number;
}

/** The most relevant top-level comments (1 quota unit). Comments turned off → empty list. */
export async function topComments(videoId: string, key: string, fetchImpl: FetchFn = fetch, max = 40): Promise<VideoComment[]> {
  try {
    const r = await call<{ items?: { snippet?: { topLevelComment?: { snippet?: { textDisplay?: string; textOriginal?: string; likeCount?: number } } } }[] }>(
      'commentThreads',
      { part: 'snippet', videoId, order: 'relevance', maxResults: String(max), textFormat: 'plainText' },
      key,
      fetchImpl,
    );
    return (r.items ?? [])
      .map((i) => i.snippet?.topLevelComment?.snippet)
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ text: decodeEntities(s.textOriginal ?? s.textDisplay ?? '').replace(/\s+/g, ' ').trim().slice(0, 400), likes: s.likeCount ?? 0 }))
      .filter((c) => c.text.length > 0);
  } catch (e) {
    // commentsDisabled comes back as 403 with the key otherwise fine
    if (e instanceof YouTubeError && e.kind === 'bad_key') return [];
    throw e;
  }
}
