import { Movie } from '../types';

/**
 * Deduplicate any list by a key selector while preserving first-seen order.
 */
export function deduplicateByKey<T>(
  items: readonly T[],
  getKey: (item: NoInfer<T>) => string | number | null | undefined
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item == null) continue;
    const rawKey = getKey(item);
    if (rawKey === null || rawKey === undefined || rawKey === '') continue;
    const key = String(rawKey);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Deduplicate Movie arrays by `movie.id` while filtering out invalid entries.
 */
export function deduplicateMovies(list: Movie[]): Movie[] {
  return deduplicateByKey(list, (m) => m?.id);
}

/**
 * Sanitize a platform identifier segment for safe deterministic ID construction.
 */
export function sanitizeIdSegment(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Construct a deterministic, collision-resistant Movie ID for Series Jeen items.
 * Incorporates platform_id or sub-platform slug when available so items sharing
 * a short raw ID (e.g. "ERl2") across different source platforms do not collide.
 */
export function buildUniqueMovieId(
  platformSlug: string,
  rawId: string | number,
  subPlatform?: string | number | null
): string {
  const basePlatform = sanitizeIdSegment(platformSlug) || 'seriesjeen';
  const cleanRawId = String(rawId).trim();
  const cleanSub = sanitizeIdSegment(subPlatform);

  if (cleanSub && cleanSub !== basePlatform) {
    return `sj-${basePlatform}-${cleanSub}-${cleanRawId}`;
  }
  return `sj-${basePlatform}-${cleanRawId}`;
}

export type V2DramaSort = 'latest' | 'title' | 'episodes';

export interface V2DramasQueryParams {
  page?: number;
  page_size?: number;
  q?: string;
  genre?: string;
  sort?: V2DramaSort;
}

/**
 * Build a validated query string for GET /api/platforms/{platform_id}/dramas (API V2).
 * Enforces OpenAPI 3.1.0 constraints: page >= 1, 1 <= page_size <= 50, sort in latest|title|episodes.
 */
export function buildV2DramasQuery(params: V2DramasQueryParams = {}): string {
  const query = new URLSearchParams();
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(params.page_size ?? 20)));

  query.set('page', String(page));
  query.set('page_size', String(pageSize));

  const trimmedQ = params.q?.trim();
  if (trimmedQ) {
    query.set('q', trimmedQ.slice(0, 100));
  }

  const trimmedGenre = params.genre?.trim();
  if (trimmedGenre) {
    query.set('genre', trimmedGenre.slice(0, 50));
  }

  if (params.sort && (params.sort === 'latest' || params.sort === 'title' || params.sort === 'episodes')) {
    query.set('sort', params.sort);
  }

  return query.toString();
}

/**
 * Parse structured Series Jeen API V2 error responses into clear Thai messages.
 */
export function parseSeriesJeenError(
  status: number,
  bodyText: string,
  retryAfter?: string | null
): string {
  let errorCode = '';
  let detailMessage = '';

  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed?.detail === 'string') {
        detailMessage = parsed.detail;
      } else if (parsed?.detail && typeof parsed.detail === 'object') {
        errorCode = String(parsed.detail.error || '');
        detailMessage = String(parsed.detail.message || '');
      } else if (typeof parsed?.message === 'string') {
        detailMessage = parsed.message;
      }
    } catch {
      detailMessage = bodyText.slice(0, 200);
    }
  }

  if (status === 401) {
    return detailMessage
      ? `API Key ไม่ถูกต้องหรือหมดอายุ (${detailMessage})`
      : 'กรุณากรอก API Key ที่ถูกต้อง (401 Unauthorized)';
  }

  switch (errorCode) {
    case 'no_access':
      return 'บัญชีของคุณยังไม่มีสิทธิ์เข้าถึงแพลตฟอร์มนี้ใน API V2';
    case 'access_expired':
      return 'สิทธิ์การใช้งานแพลตฟอร์มนี้หมดอายุแล้ว กรุณาต่ออายุแพ็กเกจ';
    case 'sub_key_platform_not_allowed':
      return 'คีย์ย่อย (Sub-key) นี้ไม่ได้รับอนุญาตให้เข้าถึงแพลตฟอร์มที่เลือก';
    case 'platform_not_found':
      return 'ไม่พบแพลตฟอร์มที่ระบุในระบบ API V2';
    case 'drama_not_found':
      return 'ไม่พบข้อมูลซีรีส์เรื่องนี้ในระบบ API V2';
    case 'episode_not_found':
      return 'ไม่พบตอนที่ร้องขอในระบบ API V2';
    case 'rate_limit_exceeded':
      return retryAfter
        ? `เรียกใช้งานถี่เกินลิมิต กรุณารอ ${retryAfter} วินาทีแล้วลองใหม่`
        : 'เรียกใช้งานถี่เกินลิมิตต่อนาที กรุณารอสักครู่แล้วลองใหม่';
    case 'daily_quota_exceeded':
      return 'โควตาการใช้งาน API V2 วันนี้เต็มแล้ว';
    case 'daily_ip_limit_exceeded':
      return 'เกินจำนวน IP ที่อนุญาตต่อวันสำหรับ API V2';
    default:
      if (detailMessage) {
        return `HTTP ${status}: ${detailMessage}`;
      }
      return `เกิดข้อผิดพลาดจาก API V2 (HTTP ${status})`;
  }
}
