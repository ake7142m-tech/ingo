/**
 * Series Jeen API V2 Service (https://api-v2.seriesjeen.online)
 * OpenAPI 3.1.0 client for Series Jeen API V2:
 * - GET /health (no key)
 * - GET /api/me (Bearer key, no quota/IP consumed)
 * - GET /api/platforms (Bearer key, no quota consumed)
 * - GET /api/platforms/{platform_id}/dramas (Bearer key, no quota consumed)
 * - GET /api/dramas/{drama_id} (Bearer key, no quota consumed)
 * - GET /api/dramas/{drama_id}/episodes?ep=... (Bearer key, 1 quota unit + IP counted)
 */

import { Movie, MovieEpisodeLink } from '../types';
import {
  buildUniqueMovieId,
  buildV2DramasQuery,
  deduplicateByKey,
  deduplicateMovies,
  parseSeriesJeenError,
  V2DramaSort,
  V2DramasQueryParams,
} from '../utils/movieDedupe';
import {
  buildEpisodeRangeParam,
  extractEpisodeLinksFromV2Response,
  mergeEpisodeLinksIntoMovie,
} from '../utils/movieLinks';

export const SERIES_JEEN_BASE_URL = 'https://api-v2.seriesjeen.online';
export const OPENAPI_SPEC_URL = 'https://api-v2.seriesjeen.online/openapi.json';
const STORAGE_KEY = 'seriesjeen_api_key';

export type { V2DramaSort, V2DramasQueryParams };

export interface SeriesJeenHealth {
  status: string;
  version: string;
  timestamp: string;
  service?: string;
  uptime_seconds?: number;
  db?: {
    connected: boolean;
    [key: string]: unknown;
  };
}

export interface SeriesJeenPlatformItem {
  id: number;
  name: string;
  image?: string | null;
  drama_count: number;
  episode_count: number;
  last_added?: string | null;
  price_thb: number;
  duration_days: number;
  has_access: boolean;
}

export interface SeriesJeenPlatformsResponse {
  total: number;
  items: SeriesJeenPlatformItem[];
}

export interface SeriesJeenMeKey {
  type: 'main' | 'sub_key' | string;
  name?: string | null;
  id?: number | null;
  rate_limit_per_minute?: number | null;
  expires_at?: string | null;
  all_platforms?: boolean | null;
  platform_ids?: number[] | null;
}

export interface SeriesJeenMePackage {
  id: number;
  plan: string;
  name: string;
  units: number;
  rate_limit_added_per_minute: number;
  starts_at: string;
  expires_at: string;
  is_current: boolean;
  days_remaining: number;
}

export interface SeriesJeenMeLimits {
  rate_limit_per_minute: number;
  base_rate_limit_per_minute: number;
  step_rate_limit_per_minute: number;
  max_rate_limit_per_minute: number;
  units: number;
  max_units: number;
  package_enabled: boolean;
  packages: SeriesJeenMePackage[];
}

export interface SeriesJeenMeDailyQuota {
  limit: number;
  used: number;
  remaining: number;
  reset_in_seconds: number;
  shared_with_v1: boolean;
}

export interface SeriesJeenMeDailyIp {
  limit: number;
  used: number;
  remaining: number;
}

export interface SeriesJeenMeAccess {
  platform_id: number;
  platform_name: string;
  platform_image?: string | null;
  started_at: string;
  expires_at: string;
  days_remaining: number;
}

export interface SeriesJeenMeSubKeys {
  active: number;
  max: number;
  rate_limit_allocated: number;
  rate_limit_available: number;
}

export interface SeriesJeenUserProfile {
  user_id?: number | string;
  key?: SeriesJeenMeKey;
  limits?: SeriesJeenMeLimits;
  daily_quota?: SeriesJeenMeDailyQuota;
  daily_ip?: SeriesJeenMeDailyIp;
  access?: SeriesJeenMeAccess[];
  sub_keys?: SeriesJeenMeSubKeys | null;
  // Optional legacy-compatible display fields
  username?: string;
  plan?: string;
  quota_remaining?: number;
  [key: string]: unknown;
}

export interface SeriesJeenDramaItem {
  id?: number | string;
  series_id?: string | null;
  drama_id?: string | number;
  platform_id?: number;
  title?: string;
  name?: string;
  title_en?: string;
  title_th?: string;
  description?: string | null;
  intro?: string;
  summary?: string;
  overview?: string;
  episode_count?: number;
  episodes_available?: number;
  episodes_count?: number;
  total_episodes?: number;
  ready_episodes_count?: number;
  genres?: string[] | { id: number; name: string }[];
  category?: string;
  locale?: string | null;
  thai_dub?: boolean;
  thai_sub?: boolean;
  updated_at?: string | null;
  poster?: string | null;
  poster_expires_at?: string | null;
  poster_url?: string;
  cover?: string;
  backdrop?: string;
  horizontal_cover?: string;
  platform?: string;
  platform_name?: string;
  score?: number;
  rating?: number;
  views?: number;
  play_count?: number;
  release_year?: number | string;
  year?: number;
  actors?: string[] | string;
  director?: string;
  stream_url?: string;
  video_url?: string;
  m3u8_url?: string;
  trailer_url?: string;
  [key: string]: unknown;
}

export interface SeriesJeenEpisodeSummary {
  episode: number;
  parts: number;
  size_bytes: number;
  duration_sec: number;
}

export interface SeriesJeenDramaDetail extends SeriesJeenDramaItem {
  id: number;
  platform_id: number;
  title: string;
  episode_count: number;
  episodes_available: number;
  genres: string[];
  thai_dub: boolean;
  thai_sub: boolean;
  subtitle_languages: string[];
  episodes: SeriesJeenEpisodeSummary[];
}

export interface SeriesJeenDramaListResponse {
  platform?: Record<string, unknown>;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: SeriesJeenDramaItem[];
}

export interface SeriesJeenSubtitle {
  language?: string | null;
  language_tag?: string | null;
  label?: string | null;
  variant?: string | null;
  format: string;
  default: boolean;
  forced: boolean;
  sdh: boolean;
  url: string;
}

export interface SeriesJeenEpisodePart {
  part: number;
  of: number;
  url: string;
  url_expires_at: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_sec: number;
  subtitles: SeriesJeenSubtitle[];
}

export interface SeriesJeenEpisodeItem {
  episode: number;
  parts: SeriesJeenEpisodePart[];
}

export interface SeriesJeenEpisodesResponse {
  drama_id: number;
  title: string;
  episode_count: number;
  requested: string;
  found: number[];
  missing: number[];
  episodes: SeriesJeenEpisodeItem[];
  quota: { used?: number; limit?: number; [key: string]: unknown };
}

export interface PlatformHealthItem {
  platform_id: number;
  name: string;
  is_active: boolean;
  is_online: boolean;
  drama_count?: number;
  episode_count?: number;
  has_access?: boolean;
  last_checked_at?: string;
  last_note?: string;
}

/**
 * Retrieve saved Series Jeen API Key (works for both V1 & V2 keys and sub-keys)
 */
export const getStoredSeriesJeenKey = (): string => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * Persist Series Jeen API Key
 */
export const setStoredSeriesJeenKey = (key: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    // ignore storage quota errors
  }
};

/**
 * Build auth headers with Bearer token
 */
export const getAuthHeaders = (apiKey?: string): HeadersInit => {
  const token = (apiKey !== undefined ? apiKey : getStoredSeriesJeenKey()).trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Helper to fetch JSON from API V2 with structured V2 error parsing
 */
async function fetchV2Json<T>(path: string, apiKey?: string, requireAuth: boolean = true): Promise<T> {
  const token = (apiKey !== undefined ? apiKey : getStoredSeriesJeenKey()).trim();
  if (requireAuth && !token) {
    throw new Error('กรุณากรอก API Key ในแท็บ "ตั้งค่า API Key" เพื่อเชื่อมต่อ Series Jeen API V2');
  }

  const res = await fetch(`${SERIES_JEEN_BASE_URL}${path}`, {
    method: 'GET',
    headers: requireAuth ? getAuthHeaders(token) : { Accept: 'application/json' },
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const retryAfter = res.headers.get('Retry-After');
    throw new Error(parseSeriesJeenError(res.status, bodyText, retryAfter));
  }

  return (await res.json()) as T;
}

/**
 * GET /openapi.json - Fetch OpenAPI 3.1.0 specification
 */
export const fetchOpenApiSpec = async (): Promise<unknown> => {
  const res = await fetch(OPENAPI_SPEC_URL);
  if (!res.ok) {
    throw new Error(`ไม่สามารถโหลด OpenAPI Spec ได้ (HTTP ${res.status})`);
  }
  return await res.json();
};

/**
 * GET /health - Server Health Check (No Auth Required)
 */
export const checkApiHealth = async (): Promise<SeriesJeenHealth> => {
  return fetchV2Json<SeriesJeenHealth>('/health', undefined, false);
};

/**
 * GET /api/me - Validate API Key and fetch V2 account limits, quota, IP, and platform access
 */
export const validateSeriesJeenKey = async (
  apiKey: string
): Promise<{ success: boolean; message: string; statusCode: number; profile?: SeriesJeenUserProfile }> => {
  const key = apiKey.trim();
  if (!key) {
    return {
      success: false,
      message: 'กรุณากรอก API Key เพื่อเชื่อมต่อ Series Jeen API V2',
      statusCode: 400,
    };
  }

  try {
    const res = await fetch(`${SERIES_JEEN_BASE_URL}/api/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const profile = (await res.json()) as SeriesJeenUserProfile;
      setStoredSeriesJeenKey(key);
      return {
        success: true,
        message: 'เชื่อมต่อ Series Jeen API V2 สำเร็จ — ข้อมูลโควตาและสิทธิ์แพลตฟอร์มพร้อมใช้งาน',
        statusCode: res.status,
        profile,
      };
    }

    const errText = await res.text().catch(() => '');
    const retryAfter = res.headers.get('Retry-After');
    return {
      success: false,
      message: parseSeriesJeenError(res.status, errText, retryAfter),
      statusCode: res.status,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อไปยัง ${SERIES_JEEN_BASE_URL} ได้: ${msg}`,
      statusCode: 500,
    };
  }
};

/**
 * GET /api/me - Get Current V2 Profile, Limits, Quota & Access
 */
export const getMeProfile = async (apiKey?: string): Promise<SeriesJeenUserProfile> => {
  return fetchV2Json<SeriesJeenUserProfile>('/api/me', apiKey, true);
};

/**
 * GET /api/platforms - Fetch all V2 platforms with drama/episode counts & access status
 */
export const fetchPlatformsV2 = async (apiKey?: string): Promise<SeriesJeenPlatformsResponse> => {
  const data = await fetchV2Json<SeriesJeenPlatformsResponse>('/api/platforms', apiKey, true);
  const uniqueItems = deduplicateByKey(Array.isArray(data.items) ? data.items : [], (p) => p.id);
  return {
    total: typeof data.total === 'number' ? data.total : uniqueItems.length,
    items: uniqueItems,
  };
};

/**
 * GET /api/platforms/{platform_id}/dramas - List or search ready dramas on a V2 platform
 */
export const fetchPlatformDramasV2 = async (
  platformId: number | string,
  params: V2DramasQueryParams = {},
  apiKey?: string
): Promise<SeriesJeenDramaListResponse> => {
  const cleanId = encodeURIComponent(String(platformId).trim());
  const qs = buildV2DramasQuery(params);
  const data = await fetchV2Json<SeriesJeenDramaListResponse>(
    `/api/platforms/${cleanId}/dramas?${qs}`,
    apiKey,
    true
  );

  const items = Array.isArray(data.items) ? data.items : [];
  return {
    platform: data.platform,
    page: data.page ?? params.page ?? 1,
    page_size: data.page_size ?? params.page_size ?? 20,
    total: data.total ?? items.length,
    total_pages: data.total_pages ?? 1,
    items,
  };
};

/**
 * GET /api/dramas/{drama_id} - Drama detail + episode summaries + subtitle languages
 */
export const fetchDramaDetailV2 = async (
  dramaId: number | string,
  apiKey?: string
): Promise<SeriesJeenDramaDetail> => {
  const cleanId = encodeURIComponent(String(dramaId).trim());
  return fetchV2Json<SeriesJeenDramaDetail>(`/api/dramas/${cleanId}`, apiKey, true);
};

/**
 * GET /api/dramas/{drama_id}/episodes?ep=... - Video playback/download links + subtitles
 * Consumes 1 V2 daily quota unit and counts IP.
 */
export const fetchDramaEpisodesV2 = async (
  dramaId: number | string,
  ep: string | number = '1',
  apiKey?: string
): Promise<SeriesJeenEpisodesResponse> => {
  const cleanId = encodeURIComponent(String(dramaId).trim());
  const qs = new URLSearchParams({ ep: String(ep).trim() || '1' });
  return fetchV2Json<SeriesJeenEpisodesResponse>(`/api/dramas/${cleanId}/episodes?${qs.toString()}`, apiKey, true);
};

/**
 * Transform a Series Jeen V2 (or legacy-compatible) drama entity to the internal Movie structure
 */
export const transformSeriesJeenToMovie = (
  drama: SeriesJeenDramaItem,
  platformName: string = 'SeriesJeen'
): Movie => {
  const rawId =
    drama.id ??
    drama.drama_id ??
    drama.series_id ??
    Math.floor(Math.random() * 900000 + 100000);

  const title = drama.title || drama.name || drama.title_th || 'ซีรีส์ใหม่ล่าสุด';
  const titleEn = drama.title_en || drama.name || title;

  const updatedYear = drama.updated_at ? new Date(drama.updated_at).getFullYear() : NaN;
  const parsedYear =
    drama.year ||
    (drama.release_year ? parseInt(String(drama.release_year), 10) : NaN) ||
    (!isNaN(updatedYear) ? updatedYear : new Date().getFullYear());

  const availableEp =
    typeof drama.episodes_available === 'number' && drama.episodes_available > 0
      ? drama.episodes_available
      : undefined;
  const totalEp =
    drama.episode_count ||
    drama.episodes_count ||
    drama.total_episodes ||
    drama.ready_episodes_count ||
    availableEp ||
    0;

  const durationLabel =
    availableEp && totalEp && availableEp < totalEp
      ? `${availableEp}/${totalEp} ตอน`
      : totalEp > 0
      ? `${totalEp} ตอน`
      : 'พร้อมดู';

  const poster =
    drama.poster ||
    drama.poster_url ||
    drama.cover ||
    drama.horizontal_cover ||
    '';

  const backdrop =
    drama.backdrop ||
    drama.horizontal_cover ||
    drama.cover ||
    poster;

  // Build deduplicated genre list incorporating V2 thai_dub / thai_sub flags
  const rawGenres: string[] = [];
  if (Array.isArray(drama.genres)) {
    for (const g of drama.genres) {
      const name = typeof g === 'string' ? g.trim() : g?.name?.trim();
      if (name) rawGenres.push(name);
    }
  } else if (typeof drama.category === 'string' && drama.category.trim()) {
    rawGenres.push(drama.category.trim());
  }

  if (drama.thai_dub && !rawGenres.includes('พากย์ไทย')) {
    rawGenres.push('พากย์ไทย');
  }
  if (drama.thai_sub && !rawGenres.includes('ซับไทย')) {
    rawGenres.push('ซับไทย');
  }

  const genres = Array.from(new Set(rawGenres));
  const finalGenres = genres.length > 0 ? genres : ['ซีรีส์', 'พากย์ไทย'];

  const category =
    drama.category ||
    (drama.thai_dub ? 'พากย์ไทย' : drama.thai_sub ? 'ซับไทย' : finalGenres[0] || platformName);

  // Include platform_id or source platform in ID to prevent cross-platform collisions (e.g. sj-thaidub-ERl2)
  const subPlatform =
    drama.platform_id !== undefined && drama.platform_id !== null
      ? `p${drama.platform_id}`
      : drama.platform || drama.platform_name || null;

  const uniqueId = buildUniqueMovieId(platformName, rawId, subPlatform);
  const code = drama.series_id ? `#${drama.series_id}` : `#SJ-${rawId}`;
  const nowIso = new Date().toISOString();

  const numericDramaId =
    typeof drama.id === 'number'
      ? drama.id
      : typeof drama.id === 'string' && /^\d+$/.test(drama.id)
      ? Number(drama.id)
      : undefined;

  return {
    id: uniqueId,
    code,
    title,
    titleEn,
    year: isNaN(parsedYear) ? new Date().getFullYear() : parsedYear,
    rating:
      typeof drama.score === 'number'
        ? drama.score
        : typeof drama.rating === 'number'
        ? drama.rating
        : 9.0,
    poster,
    backdrop,
    category,
    genres: finalGenres,
    quality: '4K',
    status: 'active',
    duration: durationLabel,
    views: drama.views || drama.play_count || 0,
    description:
      drama.description ||
      drama.intro ||
      drama.summary ||
      drama.overview ||
      `ซีรีส์จากแพลตฟอร์ม ${platformName}${drama.thai_dub ? ' (พากย์ไทย)' : drama.thai_sub ? ' (ซับไทย)' : ''}`,
    streamUrl: drama.stream_url || drama.video_url || drama.m3u8_url || '',
    v2DramaId: numericDramaId,
    v2PlatformId: typeof drama.platform_id === 'number' ? drama.platform_id : undefined,
    v2PlatformName: platformName,
    episodesCount: totalEp || undefined,
    episodesAvailable: availableEp || totalEp || undefined,
    trailerUrl: drama.trailer_url || undefined,
    director: drama.director || platformName,
    cast: Array.isArray(drama.actors)
      ? drama.actors
      : typeof drama.actors === 'string' && drama.actors.trim()
      ? drama.actors.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    featured: (drama.score || drama.rating || 0) >= 9,
    createdAt: nowIso,
    updatedAt: drama.updated_at || nowIso,
  };
};

/**
 * Fetch playable CDN video links + WebVTT subtitles from GET /api/dramas/{drama_id}/episodes
 * and attach them onto the Movie object.
 */
export const fetchAndAttachV2MovieLinks = async (
  movie: Movie,
  options: { ep?: string; maxEpisodes?: number; startEp?: number; apiKey?: string } = {}
): Promise<{
  movie: Movie;
  links: MovieEpisodeLink[];
  quota?: { used?: number; limit?: number };
}> => {
  if (!movie.v2DramaId) {
    throw new Error('รายการนี้ไม่มีรหัส Drama ID ของ Series Jeen API V2');
  }

  const epRange =
    options.ep?.trim() ||
    buildEpisodeRangeParam(
      movie.episodesAvailable || movie.episodesCount || 1,
      options.maxEpisodes ?? 10,
      options.startEp ?? 1
    );

  const response = await fetchDramaEpisodesV2(movie.v2DramaId, epRange, options.apiKey);
  const links = extractEpisodeLinksFromV2Response(response);

  if (links.length === 0) {
    throw new Error(`ไม่พบลิงก์วิดีโอสำหรับตอน ${epRange} ของเรื่อง "${movie.title}"`);
  }

  return {
    movie: mergeEpisodeLinksIntoMovie(movie, links),
    links,
    quota: response.quota,
  };
};

/**
 * Transform an array of API drama items into deduplicated Movie records with guaranteed unique IDs.
 */
export const transformAndDedupeDramas = (
  dramas: SeriesJeenDramaItem[],
  platformName: string = 'SeriesJeen'
): Movie[] => {
  const transformed = dramas.map((item) => transformSeriesJeenToMovie(item, platformName));
  return deduplicateMovies(transformed);
};

// --- Backward-compatible V2 adapters for existing service callers ---

export const getPlatformsHealth = async (apiKey?: string): Promise<PlatformHealthItem[]> => {
  const res = await fetchPlatformsV2(apiKey);
  return res.items.map((p) => ({
    platform_id: p.id,
    name: p.name,
    is_active: true,
    is_online: p.drama_count > 0,
    drama_count: p.drama_count,
    episode_count: p.episode_count,
    has_access: p.has_access,
    last_checked_at: p.last_added || undefined,
  }));
};

async function resolveDefaultPlatformId(apiKey?: string): Promise<{ id: number; name: string }> {
  const platforms = await fetchPlatformsV2(apiKey);
  const preferred =
    platforms.items.find((p) => p.has_access && p.drama_count > 0) ||
    platforms.items.find((p) => p.has_access) ||
    platforms.items[0];
  if (!preferred) {
    throw new Error('ไม่พบแพลตฟอร์มใน Series Jeen API V2');
  }
  return { id: preferred.id, name: preferred.name };
}

export const fetchThaiDubList = async (
  params: { page?: number; page_size?: number; keyword?: string } = {},
  apiKey?: string
): Promise<{ list: SeriesJeenDramaItem[]; total?: number; page?: number; platformName?: string }> => {
  const platform = await resolveDefaultPlatformId(apiKey);
  const res = await fetchPlatformDramasV2(
    platform.id,
    {
      page: params.page || 1,
      page_size: params.page_size || 20,
      q: params.keyword,
    },
    apiKey
  );
  return {
    list: res.items,
    total: res.total,
    page: res.page,
    platformName: platform.name,
  };
};

export const fetchPlatformDramas = async (
  platform: string | number,
  params: { page?: number; page_size?: number; q?: string; genre?: string; sort?: V2DramaSort } = {},
  apiKey?: string
): Promise<{ list: SeriesJeenDramaItem[]; total?: number; page?: number }> => {
  let platformId: number;
  if (typeof platform === 'number' || /^\d+$/.test(String(platform))) {
    platformId = Number(platform);
  } else {
    const platforms = await fetchPlatformsV2(apiKey);
    const needle = String(platform).toLowerCase();
    const matched =
      platforms.items.find((p) => p.name.toLowerCase().includes(needle)) ||
      platforms.items.find((p) => p.has_access) ||
      platforms.items[0];
    if (!matched) {
      throw new Error(`ไม่พบแพลตฟอร์ม "${platform}" ใน API V2`);
    }
    platformId = matched.id;
  }

  const res = await fetchPlatformDramasV2(platformId, params, apiKey);
  return {
    list: res.items,
    total: res.total,
    page: res.page,
  };
};

export const searchPlatformDramas = async (
  platform: string | number,
  keyword: string,
  page: number = 1,
  apiKey?: string
): Promise<SeriesJeenDramaItem[]> => {
  const res = await fetchPlatformDramas(platform, { page, page_size: 30, q: keyword }, apiKey);
  return res.list;
};

export const fetchThaiDubDetail = async (
  dramaId: string | number,
  apiKey?: string
): Promise<SeriesJeenDramaDetail> => {
  return fetchDramaDetailV2(dramaId, apiKey);
};

export const getStoredApiKey = getStoredSeriesJeenKey;
export const setStoredApiKey = setStoredSeriesJeenKey;
export const validateTMDBKey = validateSeriesJeenKey;
