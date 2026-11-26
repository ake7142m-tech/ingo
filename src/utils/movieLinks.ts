import { Movie, MovieEpisodeLink, MovieSubtitleLink } from '../types';
import { deduplicateByKey } from './movieDedupe';

export interface V2SubtitlePayload {
  language?: string | null;
  language_tag?: string | null;
  label?: string | null;
  format?: string;
  default?: boolean;
  url?: string;
}

export interface V2EpisodePartPayload {
  part: number;
  of: number;
  url: string;
  url_expires_at?: string;
  size_bytes?: number;
  width?: number | null;
  height?: number | null;
  duration_sec?: number;
  subtitles?: V2SubtitlePayload[];
}

export interface V2EpisodePayload {
  episode: number;
  parts: V2EpisodePartPayload[];
}

export interface V2EpisodesResponsePayload {
  drama_id?: number;
  title?: string;
  episode_count?: number;
  episodes?: V2EpisodePayload[];
}

/**
 * Build a Series Jeen API V2 `ep` query parameter (e.g. "1" or "1-10").
 */
export function buildEpisodeRangeParam(
  episodesAvailable?: number,
  maxPerRequest: number = 10,
  startEp: number = 1
): string {
  const safeStart = Math.max(1, Math.floor(startEp));
  const safeMax = Math.max(1, Math.floor(maxPerRequest));
  const available =
    typeof episodesAvailable === 'number' && episodesAvailable > 0
      ? Math.floor(episodesAvailable)
      : safeStart;

  const endEp = Math.min(available, safeStart + safeMax - 1);
  if (endEp <= safeStart) {
    return String(safeStart);
  }
  return `${safeStart}-${endEp}`;
}

/**
 * Flatten and deduplicate V2 `/api/dramas/{id}/episodes` response into sorted MovieEpisodeLink[].
 */
export function extractEpisodeLinksFromV2Response(
  response: V2EpisodesResponsePayload | null | undefined
): MovieEpisodeLink[] {
  if (!response || !Array.isArray(response.episodes)) return [];

  const flattened: MovieEpisodeLink[] = [];

  for (const epItem of response.episodes) {
    if (!epItem || typeof epItem.episode !== 'number' || !Array.isArray(epItem.parts)) {
      continue;
    }

    for (const part of epItem.parts) {
      const url = typeof part?.url === 'string' ? part.url.trim() : '';
      if (!url) continue;

      const subtitles: MovieSubtitleLink[] = Array.isArray(part.subtitles)
        ? part.subtitles
            .filter((s) => typeof s?.url === 'string' && s.url.trim().length > 0)
            .map((s) => ({
              language: s.language ?? null,
              languageTag: s.language_tag ?? null,
              label: s.label ?? s.language ?? 'ซับไตเติล',
              url: String(s.url).trim(),
              isDefault: Boolean(s.default),
            }))
        : [];

      flattened.push({
        episode: epItem.episode,
        part: typeof part.part === 'number' && part.part > 0 ? part.part : 1,
        totalParts: typeof part.of === 'number' && part.of > 0 ? part.of : 1,
        url,
        urlExpiresAt: part.url_expires_at,
        durationSec: typeof part.duration_sec === 'number' ? part.duration_sec : undefined,
        sizeBytes: typeof part.size_bytes === 'number' ? part.size_bytes : undefined,
        width: part.width ?? null,
        height: part.height ?? null,
        subtitles,
      });
    }
  }

  flattened.sort((a, b) => (a.episode !== b.episode ? a.episode - b.episode : a.part - b.part));

  return deduplicateByKey<MovieEpisodeLink>(
    flattened,
    (item) => `${item.episode}-${item.part}`
  );
}

/**
 * Merge newly fetched episode links into a Movie record, updating primary streamUrl & expiration.
 */
export function mergeEpisodeLinksIntoMovie(
  movie: Movie,
  incomingLinks: MovieEpisodeLink[]
): Movie {
  if (!incomingLinks || incomingLinks.length === 0) return movie;

  // Prefer newly fetched links over older entries for the same episode-part
  const combined = [...incomingLinks, ...(movie.episodeLinks || [])];
  const merged = deduplicateByKey<MovieEpisodeLink>(
    combined,
    (item) => `${item.episode}-${item.part}`
  ).sort((a, b) => (a.episode !== b.episode ? a.episode - b.episode : a.part - b.part));

  const primary = merged[0];

  return {
    ...movie,
    streamUrl: primary?.url || movie.streamUrl || '',
    streamUrlExpiresAt: primary?.urlExpiresAt || movie.streamUrlExpiresAt,
    episodeLinks: merged,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determine whether a V2 CDN signed URL has expired (with a 2-minute safety buffer).
 */
export function isLinkExpired(
  expiresAt?: string | null,
  nowMs: number = Date.now(),
  bufferMs: number = 120_000
): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) return false;
  return parsed - bufferMs <= nowMs;
}

/**
 * Count how many playable video links are attached to a movie.
 */
export function getMovieLinkCount(movie: Movie): number {
  if (Array.isArray(movie.episodeLinks) && movie.episodeLinks.length > 0) {
    return movie.episodeLinks.length;
  }
  return movie.streamUrl?.trim() ? 1 : 0;
}
