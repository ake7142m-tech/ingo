/**
 * Series Jeen API V1 + V2 — โมดูลฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * กติกาที่โมดูลนี้บังคับ (อ้างอิงเอกสารของผู้ให้บริการ):
 *  - คีย์ API อ่านจาก environment ของเซิร์ฟเวอร์ ไม่ส่งไปที่เบราว์เซอร์
 *  - ดึงรายการ/รายละเอียดเรื่อง (V2) ไม่กินโควตา -> ใช้ซิงก์ข้อมูลได้
 *  - ขอลิงก์เล่นตอน (V2 /episodes) กินโควตา 1 ต่อคำขอ -> เรียกเฉพาะตอนผู้ชมกดเล่น
 *    ห้ามดึงล่วงหน้าทั้งเรื่อง (เอกสารระบุว่าเป็นการดูดข้อมูล โดนบล็อกคีย์ถาวร)
 *  - ไม่เก็บลิงก์วิดีโอลงฐานข้อมูล (ลิงก์หมดอายุราว 6 ชั่วโมง)
 *  - เรื่องที่ซิงก์เข้ามาเป็น "draft" เสมอ ต้องมีคนยืนยันสิทธิ์ก่อนเผยแพร่
 */

import { createHash } from 'node:crypto';

/* ===================================================================
 * 1) ตั้งค่า
 * =================================================================== */

export interface SjConfig {
  v1BaseUrl: string;
  v2BaseUrl: string;
  /** คีย์หลัก ใช้ฝั่งแอดมิน (ซิงก์ข้อมูล ตรวจโควตา) */
  adminKey: string;
  /** คีย์ย่อยของ V2 (ขึ้นต้น sjv2s_) ใช้กับฝั่งผู้ชมเท่านั้น จำกัดแพลตฟอร์มได้ ถ้าไม่ตั้งจะใช้คีย์หลัก */
  playerKey?: string;
  timeoutMs: number;
  maxRetries: number;
  /** ลิมิตต่อนาทีที่ตั้งไว้ฝั่งเรา ให้ต่ำกว่าลิมิตจริงของบัญชีเล็กน้อย */
  v1RatePerMin: number;
  v2RatePerMin: number;
}

export function loadSjConfig(env: Record<string, string | undefined> = process.env): SjConfig {
  const adminKey = env.SERIESJEEN_API_KEY;
  if (!adminKey) throw new Error('ไม่พบ SERIESJEEN_API_KEY ใน environment ของเซิร์ฟเวอร์');
  return {
    v1BaseUrl: env.SERIESJEEN_V1_URL ?? 'https://api.seriesjeen.online',
    v2BaseUrl: env.SERIESJEEN_V2_URL ?? 'https://api-v2.seriesjeen.online',
    adminKey,
    playerKey: env.SERIESJEEN_V2_SUBKEY,
    timeoutMs: Number(env.SERIESJEEN_TIMEOUT_MS ?? 15000),
    maxRetries: Number(env.SERIESJEEN_MAX_RETRIES ?? 2),
    v1RatePerMin: Number(env.SERIESJEEN_V1_RATE ?? 50),
    v2RatePerMin: Number(env.SERIESJEEN_V2_RATE ?? 50),
  };
}

/* ===================================================================
 * 2) Error + ตัวช่วยเรียก HTTP
 * =================================================================== */

export type SjErrorCode =
  | 'unauthorized'
  | 'no_access'
  | 'access_expired'
  | 'sub_key_platform_not_allowed'
  | 'platform_not_found'
  | 'not_found'
  | 'validation'
  | 'rate_limit_exceeded'
  | 'daily_quota_exceeded'
  | 'daily_ip_limit_exceeded'
  | 'upstream_unavailable'
  | 'network'
  | 'unknown';

export class SjError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: SjErrorCode,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'SjError';
  }

  /** ข้อความภาษาไทยที่แสดงให้เจ้าของเว็บอ่านได้ (ไม่มีศัพท์เทคนิค) */
  get friendlyTh(): string {
    switch (this.code) {
      case 'unauthorized': return 'คีย์ API ไม่ถูกต้องหรือถูกยกเลิก กรุณาตรวจคีย์ในหน้าตั้งค่า';
      case 'no_access': return 'ยังไม่ได้ซื้อสิทธิ์ของแพลตฟอร์มนี้';
      case 'access_expired': return 'สิทธิ์ของแพลตฟอร์มนี้หมดอายุแล้ว กรุณาต่ออายุ';
      case 'sub_key_platform_not_allowed': return 'คีย์ย่อยนี้ไม่ได้รับอนุญาตให้ใช้แพลตฟอร์มนี้';
      case 'platform_not_found': return 'ไม่พบแพลตฟอร์มนี้';
      case 'not_found': return 'ไม่พบข้อมูลที่ขอ';
      case 'validation': return 'ข้อมูลที่ส่งไปไม่ถูกต้อง';
      case 'rate_limit_exceeded': return `เรียกถี่เกินไป กรุณารอ ${this.retryAfterSec ?? 60} วินาที`;
      case 'daily_quota_exceeded': return 'โควตาวันนี้เต็มแล้ว รีเซ็ตเที่ยงคืนเวลาไทย';
      case 'daily_ip_limit_exceeded': return 'จำนวนเครื่องที่เรียกต่อวันเกินกำหนด';
      case 'upstream_unavailable': return 'ระบบต้นทางขัดข้องชั่วคราว ลองใหม่อีกครั้ง';
      case 'network': return 'เชื่อมต่อระบบต้นทางไม่ได้';
      default: return 'เกิดข้อผิดพลาดจากระบบต้นทาง';
    }
  }
}

interface ReqOpts {
  baseUrl: string;
  key: string;
  timeoutMs: number;
  maxRetries: number;
  throttle: Throttle;
}

/** จำกัดอัตราเรียกฝั่งเราเอง (คิวต่อเนื่อง ห่างกันอย่างน้อย 60000/limit ms) */
export class Throttle {
  private next = 0;
  constructor(private readonly perMin: number) {}
  async wait(): Promise<void> {
    const gap = Math.ceil(60000 / Math.max(1, this.perMin));
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + gap;
    if (at > now) await sleep(at - now);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function mapError(status: number, body: unknown, retryAfter?: number): SjError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const err = typeof detail === 'object' && detail !== null ? (detail as { error?: string; message?: string }) : null;
  const msg = err?.message ?? (typeof detail === 'string' ? detail : `HTTP ${status}`);
  const code = err?.error;

  if (status === 401) return new SjError(status, 'unauthorized', msg);
  if (status === 403) {
    if (code === 'access_expired') return new SjError(status, 'access_expired', msg);
    if (code === 'sub_key_platform_not_allowed') return new SjError(status, 'sub_key_platform_not_allowed', msg);
    return new SjError(status, 'no_access', msg);
  }
  if (status === 404) return new SjError(status, code === 'platform_not_found' ? 'platform_not_found' : 'not_found', msg);
  if (status === 422) return new SjError(status, 'validation', msg);
  if (status === 429) {
    const c: SjErrorCode =
      code === 'daily_quota_exceeded' ? 'daily_quota_exceeded'
      : code === 'daily_ip_limit_exceeded' ? 'daily_ip_limit_exceeded'
      : 'rate_limit_exceeded';
    return new SjError(status, c, msg, retryAfter);
  }
  if (status === 503 || status >= 500) return new SjError(status, 'upstream_unavailable', msg);
  return new SjError(status, 'unknown', msg);
}

async function sjGet<T>(
  o: ReqOpts,
  path: string,
  query: Record<string, string | number | undefined> = {},
  onLog?: (e: UsageEntry) => void,
  quotaCost = 0,
): Promise<T> {
  const url = new URL(path, o.baseUrl);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  let lastErr: SjError | null = null;
  for (let attempt = 0; attempt <= o.maxRetries; attempt++) {
    await o.throttle.wait();
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${o.key}`, Accept: 'application/json' },
        signal: ctrl.signal,
      });
      const text = await res.text();
      let body: unknown = null;
      try { body = text ? JSON.parse(text) : null; } catch { /* ไม่ใช่ JSON */ }
      const latency = Date.now() - started;
      const retryAfter = Number(res.headers.get('Retry-After')) || undefined;

      if (res.ok) {
        onLog?.({ endpoint: path, status: res.status, latencyMs: latency, quotaCost });
        return body as T;
      }

      const err = mapError(res.status, body, retryAfter);
      onLog?.({ endpoint: path, status: res.status, latencyMs: latency, quotaCost: 0, errorCode: err.code });
      lastErr = err;

      // ลองซ้ำเฉพาะปัญหาชั่วคราวฝั่งต้นทาง ไม่ลองซ้ำ 4xx (กันกินโควตา/โดนบล็อก)
      const retryable = err.code === 'upstream_unavailable';
      if (!retryable || attempt === o.maxRetries) throw err;
      await sleep(500 * 2 ** attempt);
    } catch (e) {
      if (e instanceof SjError) throw e;
      const latency = Date.now() - started;
      lastErr = new SjError(0, 'network', e instanceof Error ? e.message : 'network error');
      onLog?.({ endpoint: path, status: 0, latencyMs: latency, quotaCost: 0, errorCode: 'network' });
      if (attempt === o.maxRetries) throw lastErr;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new SjError(0, 'unknown', 'unknown');
}

export interface UsageEntry {
  endpoint: string;
  status: number;
  latencyMs: number;
  quotaCost: number;
  errorCode?: string;
}

/* ===================================================================
 * 3) V1  (https://api.seriesjeen.online)
 *    ใช้สำหรับ: ThaiDub (legacy), สถานะแพลตฟอร์ม, แพลตฟอร์มที่ยังไม่มีใน V2,
 *    และชั้นรายการสำเร็จรูป /api/platform/{slug}/list|search|thai|genres|...
 * =================================================================== */

export interface V1ListParams { page?: number; page_size?: number; locale?: string }

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;
function assertSlug(s: string): string {
  if (!SLUG_RE.test(s)) throw new SjError(422, 'validation', `slug แพลตฟอร์มไม่ถูกต้อง: ${s}`);
  return s;
}
function clampPage(p?: number): number { return Math.max(1, Math.floor(p ?? 1)); }
function clampSize(n?: number, max = 100): number { return Math.min(max, Math.max(1, Math.floor(n ?? 20))); }

export class SeriesJeenV1 {
  private readonly o: ReqOpts;
  constructor(cfg: SjConfig, private readonly log?: (e: UsageEntry) => void) {
    this.o = { baseUrl: cfg.v1BaseUrl, key: cfg.adminKey, timeoutMs: cfg.timeoutMs, maxRetries: cfg.maxRetries, throttle: new Throttle(cfg.v1RatePerMin) };
  }
  private get<T>(path: string, q?: Record<string, string | number | undefined>) {
    return sjGet<T>(this.o, path, q, this.log);
  }

  /** ข้อมูลบัญชี + โควตาที่เหลือวันนี้ */
  me() { return this.get<unknown>('/api/me'); }
  /** สิทธิ์แพลตฟอร์มที่ซื้อไว้ */
  meAccess() { return this.get<unknown>('/api/me/access'); }
  /** สถานะแพลตฟอร์ม (ใช้โชว์ว่าตัวไหนล่ม) */
  platformsHealth() { return this.get<unknown>('/api/platforms/health'); }
  health() { return this.get<unknown>('/health'); }

  list(platform: string, p: V1ListParams = {}) {
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/list`, { page: clampPage(p.page), page_size: clampSize(p.page_size), locale: p.locale });
  }
  /** เฉพาะเรื่องที่มีพากย์ไทย */
  thai(platform: string, p: V1ListParams = {}) {
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/thai`, { page: clampPage(p.page), page_size: clampSize(p.page_size) });
  }
  search(platform: string, keyword: string, p: V1ListParams = {}) {
    const k = keyword.trim();
    if (!k) throw new SjError(422, 'validation', 'ต้องระบุคำค้นหา');
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/search`, { keyword: k, page: clampPage(p.page), page_size: clampSize(p.page_size), locale: p.locale });
  }
  genres(platform: string, locale?: string) {
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/genres`, { locale });
  }
  listByGenre(platform: string, genreId: number, p: V1ListParams = {}) {
    if (!Number.isInteger(genreId)) throw new SjError(422, 'validation', 'genreId ต้องเป็นตัวเลข');
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/genre/${genreId}`, { page: clampPage(p.page), page_size: clampSize(p.page_size), locale: p.locale });
  }
  locales(platform: string) {
    return this.get<unknown>(`/api/platform/${assertSlug(platform)}/locales`);
  }
  /** ชุดพากย์ไทยแบบ legacy (เส้นเดิมที่หน้าตาเก่าใช้) */
  thaiDubList(p: V1ListParams = {}) {
    return this.get<unknown>('/api/platform/thaidub/list', { page: clampPage(p.page), page_size: clampSize(p.page_size) });
  }
}

/* ===================================================================
 * 4) V2  (https://api-v2.seriesjeen.online)  — เส้นหลัก 5 เส้น
 * =================================================================== */

export interface V2Platform {
  id: number; name: string; image?: string;
  drama_count: number; episode_count: number; last_added?: string;
  price_thb?: number; duration_days?: number; has_access: boolean;
}
export interface V2PlatformsRes { total: number; items: V2Platform[] }

export interface V2DramaItem {
  id: number; series_id: string; platform_id: number; title: string; description?: string;
  episode_count: number; episodes_available: number; genres: string[]; locale?: string;
  thai_dub: boolean; thai_sub: boolean; updated_at?: string;
  poster?: string; poster_expires_at?: string;
}
export interface V2DramasRes {
  platform: { id: number; name: string };
  page: number; page_size: number; total: number; total_pages: number; items: V2DramaItem[];
}
export interface V2DramaDetail extends V2DramaItem {
  subtitle_languages?: string[];
  episodes: { episode: number; parts: number; size_bytes?: number; duration_sec?: number }[];
}
export interface V2Subtitle {
  language: string; language_tag: string; label: string; variant?: string; format: string;
  default: boolean; forced: boolean; sdh: boolean; url: string;
}
export interface V2EpisodePart {
  part: number; of: number; url: string; url_expires_at: string;
  size_bytes?: number; width?: number; height?: number; duration_sec?: number; subtitles?: V2Subtitle[];
}
export interface V2EpisodesRes {
  drama_id: number; title: string; episode_count: number; requested: string;
  found: number[]; missing: number[];
  episodes: { episode: number; parts: V2EpisodePart[] }[];
  quota: { used: number; limit: number };
}
export interface V2DramaQuery { q?: string; genre?: string; sort?: 'latest' | 'title' | 'episodes'; page?: number; page_size?: number }

/** ep ต้องเป็นตอนเดียว หรือช่วงสั้นไม่เกิน 3 ตอน — กันการดึงล่วงหน้าทั้งเรื่อง */
export const MAX_EPISODES_PER_REQUEST = 3;
export function parseEpisodeSpec(ep: string): { spec: string; count: number } {
  const m = /^(\d{1,4})(?:-(\d{1,4}))?$/.exec(ep.trim());
  if (!m) throw new SjError(422, 'validation', 'รูปแบบตอนไม่ถูกต้อง (เช่น 1 หรือ 1-3)');
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < 1 || b < a) throw new SjError(422, 'validation', 'ช่วงตอนไม่ถูกต้อง');
  const count = b - a + 1;
  if (count > MAX_EPISODES_PER_REQUEST) {
    throw new SjError(422, 'validation', `ขอได้ครั้งละไม่เกิน ${MAX_EPISODES_PER_REQUEST} ตอน`);
  }
  return { spec: m[2] ? `${a}-${b}` : String(a), count };
}

export class SeriesJeenV2 {
  private readonly admin: ReqOpts;
  private readonly player: ReqOpts;
  constructor(cfg: SjConfig, private readonly log?: (e: UsageEntry) => void) {
    const throttle = new Throttle(cfg.v2RatePerMin);
    const base = { baseUrl: cfg.v2BaseUrl, timeoutMs: cfg.timeoutMs, maxRetries: cfg.maxRetries, throttle };
    this.admin = { ...base, key: cfg.adminKey };
    this.player = { ...base, key: cfg.playerKey ?? cfg.adminKey };
  }

  // ---- ฝั่งแอดมิน (ไม่กินโควตา) ----
  me() { return sjGet<unknown>(this.admin, '/api/me', {}, this.log); }
  platforms() { return sjGet<V2PlatformsRes>(this.admin, '/api/platforms', {}, this.log); }
  dramas(platformId: number, q: V2DramaQuery = {}) {
    if (!Number.isInteger(platformId) || platformId < 1) throw new SjError(422, 'validation', 'platformId ไม่ถูกต้อง');
    return sjGet<V2DramasRes>(this.admin, `/api/platforms/${platformId}/dramas`, {
      q: q.q?.trim().slice(0, 100), genre: q.genre, sort: q.sort,
      page: clampPage(q.page), page_size: clampSize(q.page_size, 50),
    }, this.log);
  }
  drama(dramaId: number) {
    if (!Number.isInteger(dramaId) || dramaId < 1) throw new SjError(422, 'validation', 'dramaId ไม่ถูกต้อง');
    return sjGet<V2DramaDetail>(this.admin, `/api/dramas/${dramaId}`, {}, this.log);
  }

  // ---- ฝั่งผู้ชม (กินโควตา 1 ต่อคำขอ) ใช้คีย์ย่อยถ้าตั้งไว้ ----
  episodes(dramaId: number, ep: string) {
    if (!Number.isInteger(dramaId) || dramaId < 1) throw new SjError(422, 'validation', 'dramaId ไม่ถูกต้อง');
    const { spec } = parseEpisodeSpec(ep);
    return sjGet<V2EpisodesRes>(this.player, `/api/dramas/${dramaId}/episodes`, { ep: spec }, this.log, 1);
  }
}

/** เวลาจาก V2 ไม่มี timezone เป็นเวลาไทย -> ต่อ +07:00 ก่อนแปลง */
export function parseThaiTime(s?: string): Date | null {
  if (!s) return null;
  const iso = s.trim().replace(' ', 'T');
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ===================================================================
 * 5) ซิงก์เข้าฐานข้อมูล (เฉพาะข้อมูลเรื่อง ไม่แตะลิงก์วิดีโอ)
 * =================================================================== */

/** อินเทอร์เฟซเล็กๆ ที่เข้ากันได้กับ pg (node-postgres) */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

export async function syncPlatformList(db: Db, v2: SeriesJeenV2): Promise<number> {
  const src = await db.query<{ id: string }>(`SELECT id FROM data_sources WHERE code = 'seriesjeen_v2'`);
  if (!src.rows[0]) throw new Error('ไม่พบ data_sources seriesjeen_v2 (รัน seriesjeen.sql ก่อน)');
  const sourceId = src.rows[0].id;
  const res = await v2.platforms();
  for (const p of res.items) {
    await db.query(
      `INSERT INTO source_platforms (source_id, platform_ref, name, image_url, has_access, drama_count, episode_count, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (source_id, platform_ref) DO UPDATE
         SET name = EXCLUDED.name, image_url = EXCLUDED.image_url, has_access = EXCLUDED.has_access,
             drama_count = EXCLUDED.drama_count, episode_count = EXCLUDED.episode_count, last_synced_at = now()`,
      [sourceId, String(p.id), p.name, p.image ?? null, p.has_access, p.drama_count, p.episode_count],
    );
  }
  return res.items.length;
}

/**
 * นำเรื่องเข้าเป็นฉบับร่าง (draft) เสมอ
 *  - ไม่ตั้ง rights_confirmed_at / ไม่เผยแพร่ ต้องให้เจ้าของยืนยันสิทธิ์ในหลังบ้าน
 *  - ถ้าเรื่องมีอยู่แล้ว อัปเดตเฉพาะข้อมูลเรื่อง ไม่แตะสถานะเผยแพร่/สิทธิ์ที่ยืนยันไว้
 */
export async function importDramasAsDraft(
  db: Db, v2: SeriesJeenV2, platformId: number, dramaIds: number[], staffId: number,
): Promise<{ imported: number; failed: { dramaId: number; reason: string }[] }> {
  if (dramaIds.length === 0 || dramaIds.length > 50) {
    throw new SjError(422, 'validation', 'เลือกได้ครั้งละ 1-50 เรื่อง');
  }
  const plat = await db.query<{ id: string; source_id: string; enabled: boolean; has_access: boolean }>(
    `SELECT id, source_id, is_enabled AS enabled, has_access FROM source_platforms
      WHERE platform_ref = $1 AND source_id = (SELECT id FROM data_sources WHERE code='seriesjeen_v2')`,
    [String(platformId)],
  );
  const sp = plat.rows[0];
  if (!sp) throw new SjError(404, 'platform_not_found', 'ยังไม่ได้ซิงก์รายชื่อแพลตฟอร์ม');
  if (!sp.enabled) throw new SjError(403, 'no_access', 'เจ้าของยังไม่ได้เปิดใช้แพลตฟอร์มนี้');
  if (!sp.has_access) throw new SjError(403, 'no_access', 'คีย์ยังไม่มีสิทธิ์ของแพลตฟอร์มนี้');

  const failed: { dramaId: number; reason: string }[] = [];
  let imported = 0;

  for (const id of dramaIds) {
    try {
      const d = await v2.drama(id);
      if (d.platform_id !== platformId) throw new SjError(422, 'validation', 'เรื่องนี้ไม่อยู่ในแพลตฟอร์มที่เลือก');

      const slug = `sj-${platformId}-${shortHash(d.series_id)}`;
      const ins = await db.query<{ id: string }>(
        `INSERT INTO contents
           (content_type, title, slug, synopsis, original_language, status,
            source_id, external_id, source_platform_id, source_drama_id, source_series_id,
            poster_source_url, poster_source_expires_at, is_thai_dub, has_thai_sub, platform_code,
            created_by, updated_by)
         VALUES ('short_drama',$1,$2,$3,$4,'draft',
            $5,$6,$7,$8,$9,
            $10,$11,$12,$13,$14,
            $15,$15)
         ON CONFLICT (source_id, external_id) DO UPDATE
           SET title = EXCLUDED.title, synopsis = EXCLUDED.synopsis,
               poster_source_url = EXCLUDED.poster_source_url,
               poster_source_expires_at = EXCLUDED.poster_source_expires_at,
               is_thai_dub = EXCLUDED.is_thai_dub, has_thai_sub = EXCLUDED.has_thai_sub,
               source_drama_id = EXCLUDED.source_drama_id, updated_by = EXCLUDED.updated_by
         RETURNING id`,
        [
          d.title, slug, d.description ?? null, d.locale ?? null,
          sp.source_id, `${platformId}:${d.series_id}`, sp.id, d.id, d.series_id,
          d.poster ?? null, parseThaiTime(d.poster_expires_at), d.thai_dub, d.thai_sub, String(platformId),
          staffId,
        ],
      );
      const contentId = ins.rows[0].id;

      for (const g of d.genres ?? []) {
        const gslug = `g-${shortHash(g)}`;
        const gr = await db.query<{ id: string }>(
          `INSERT INTO genres (name, slug, external_ref) VALUES ($1,$2,$1)
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [g, gslug],
        );
        await db.query(
          `INSERT INTO content_genres (content_id, genre_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [contentId, gr.rows[0].id],
        );
      }

      // บันทึกเฉพาะ "รายการตอน" (เลขตอน/ความยาว) ไม่มีลิงก์วิดีโอ
      for (const e of d.episodes ?? []) {
        await db.query(
          `INSERT INTO episodes (content_id, season_number, episode_number, runtime_minutes, external_id)
           VALUES ($1, 1, $2, $3, $4)
           ON CONFLICT (content_id, season_number, episode_number) DO UPDATE
             SET runtime_minutes = EXCLUDED.runtime_minutes`,
          [contentId, e.episode, e.duration_sec ? Math.max(1, Math.round(e.duration_sec / 60)) : null, String(e.episode)],
        );
      }
      imported++;
    } catch (e) {
      failed.push({ dramaId: id, reason: e instanceof SjError ? e.friendlyTh : 'บันทึกไม่สำเร็จ' });
      // ถ้าติดโควตา/ลิมิต ให้หยุดทันที ไม่ไล่เรียกต่อ
      if (e instanceof SjError && (e.code === 'rate_limit_exceeded' || e.code === 'daily_quota_exceeded' || e.code === 'unauthorized')) break;
    }
  }

  await db.query(`UPDATE source_platforms SET last_synced_at = now() WHERE id = $1`, [sp.id]);
  return { imported, failed };
}

/* ===================================================================
 * 6) ลิงก์เล่นแบบ "ขอเมื่อกดเล่น" (กินโควตา) + แคชสั้นๆ กันขอซ้ำ
 * =================================================================== */

export interface PlayPart { url: string; expiresAt: string | null; width?: number; height?: number; subtitles: { lang: string; label: string; url: string; isDefault: boolean }[] }
export interface PlayResult { episode: number; parts: PlayPart[] }

const playCache = new Map<string, { exp: number; value: PlayResult }>();
const PLAY_CACHE_MAX = 500;

export interface PlayDeps {
  db: Db;
  v2: SeriesJeenV2;
  /** ตรวจว่าสมาชิกคนนี้ดูตอนนี้ได้ไหม (ฟรี/สมาชิกจ่ายเงิน) ต้องตรวจฝั่งเซิร์ฟเวอร์เสมอ */
  canWatch(memberId: number | null, contentId: number, episode: number): Promise<boolean>;
}

export async function getPlayLinks(deps: PlayDeps, contentId: number, episode: number, memberId: number | null): Promise<PlayResult> {
  if (!Number.isInteger(episode) || episode < 1) throw new SjError(422, 'validation', 'เลขตอนไม่ถูกต้อง');

  const r = await deps.db.query<{ source_drama_id: string | null; is_published: boolean }>(
    `SELECT source_drama_id, (status = 'published' AND deleted_at IS NULL AND rights_confirmed_at IS NOT NULL) AS is_published
       FROM contents WHERE id = $1`,
    [contentId],
  );
  const row = r.rows[0];
  // ไม่เผยแพร่ / ยังไม่ยืนยันสิทธิ์ / ไม่มีรหัสต้นทาง -> ตอบเหมือนไม่พบ
  if (!row || !row.is_published || !row.source_drama_id) throw new SjError(404, 'not_found', 'ไม่พบเนื้อหา');
  if (!(await deps.canWatch(memberId, contentId, episode))) throw new SjError(403, 'no_access', 'ไม่มีสิทธิ์ดูตอนนี้');

  const dramaId = Number(row.source_drama_id);
  const key = `${dramaId}:${episode}`;
  const hit = playCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;

  const res = await deps.v2.episodes(dramaId, String(episode));
  const ep = res.episodes.find((e) => e.episode === episode);
  if (!ep) throw new SjError(404, 'not_found', 'ไม่พบตอนนี้');

  const value: PlayResult = {
    episode,
    parts: ep.parts
      .slice()
      .sort((a, b) => a.part - b.part)
      .map((p) => ({
        url: p.url,
        expiresAt: parseThaiTime(p.url_expires_at)?.toISOString() ?? null,
        width: p.width,
        height: p.height,
        subtitles: (p.subtitles ?? [])
          .filter((s) => !s.forced)
          .sort((a, b) => Number(a.sdh) - Number(b.sdh) || Number(b.variant === 'main') - Number(a.variant === 'main'))
          .map((s) => ({ lang: s.language, label: s.label, url: s.url, isDefault: s.default })),
      })),
  };

  // แคชไว้จนก่อนลิงก์หมดอายุ 10 นาที (ไม่เก็บลงฐานข้อมูล)
  const exp = Math.min(...value.parts.map((p) => (p.expiresAt ? Date.parse(p.expiresAt) : Date.now() + 15 * 60_000))) - 10 * 60_000;
  if (exp > Date.now()) {
    if (playCache.size >= PLAY_CACHE_MAX) playCache.delete(playCache.keys().next().value as string);
    playCache.set(key, { exp, value });
  }
  return value;
}

/* ===================================================================
 * 7) เส้นทางฝั่งเซิร์ฟเวอร์ (Express) — หน้าตาเดิมเรียกเส้นเหล่านี้แทนการยิง API ตรง
 * =================================================================== */

import type { Request, Response, NextFunction, Router } from 'express';

export interface RouterDeps {
  express: { Router(): Router };
  db: Db;
  v1: SeriesJeenV1;
  v2: SeriesJeenV2;
  /** middleware ตรวจสิทธิ์แอดมินที่ฝั่งเซิร์ฟเวอร์ เช่น 'source.view', 'source.sync' */
  requireStaff(permission: string): (req: Request, res: Response, next: NextFunction) => void;
  /** middleware ผู้ชม (ล็อกอินหรือไม่ก็ได้ ตามนโยบายเว็บ) ต้องใส่ req.memberId ถ้ามี */
  optionalMember(): (req: Request, res: Response, next: NextFunction) => void;
  /** middleware จำกัดอัตราต่อ IP/สมาชิกสำหรับเส้นขอลิงก์เล่น */
  playRateLimit(): (req: Request, res: Response, next: NextFunction) => void;
  canWatch: PlayDeps['canWatch'];
  audit(staffId: number | null, action: string, detail: unknown): Promise<void>;
}

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (h: Handler) => (req: Request, res: Response, next: NextFunction) => {
  h(req, res).catch((e: unknown) => {
    if (e instanceof SjError) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      if (e.retryAfterSec) res.setHeader('Retry-After', String(e.retryAfterSec));
      res.status(status).json({ error: e.code, message: e.friendlyTh });
      return;
    }
    next(e);
  });
};
const intParam = (v: unknown, name: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new SjError(422, 'validation', `${name} ไม่ถูกต้อง`);
  return n;
};
const staffIdOf = (req: Request): number => (req as Request & { staffId: number }).staffId;
const memberIdOf = (req: Request): number | null => (req as Request & { memberId?: number }).memberId ?? null;

export function createSeriesJeenRouter(d: RouterDeps): Router {
  const r = d.express.Router();

  // ---------- แอดมิน ----------
  r.get('/admin/sources/seriesjeen/status', d.requireStaff('source.view'), wrap(async (_req, res) => {
    const [v1, v2] = await Promise.allSettled([d.v1.me(), d.v2.me()]);
    // ส่งเฉพาะสถานะ/โควตาที่จำเป็น ไม่ส่งข้อมูลที่ไม่ต้องใช้กลับไปหน้าตา
    res.json({
      v1: v1.status === 'fulfilled' ? { ok: true, data: v1.value } : { ok: false, message: v1.reason instanceof SjError ? v1.reason.friendlyTh : 'ผิดพลาด' },
      v2: v2.status === 'fulfilled' ? { ok: true, data: v2.value } : { ok: false, message: v2.reason instanceof SjError ? v2.reason.friendlyTh : 'ผิดพลาด' },
    });
  }));

  r.get('/admin/sources/seriesjeen/v1/platforms-health', d.requireStaff('source.view'), wrap(async (_req, res) => {
    res.json(await d.v1.platformsHealth());
  }));

  r.get('/admin/sources/seriesjeen/v1/thaidub', d.requireStaff('source.view'), wrap(async (req, res) => {
    res.json(await d.v1.thaiDubList({ page: Number(req.query.page) || 1, page_size: Number(req.query.page_size) || 20 }));
  }));

  r.get('/admin/sources/seriesjeen/v1/:platform/list', d.requireStaff('source.view'), wrap(async (req, res) => {
    const q = req.query;
    const p = { page: Number(q.page) || 1, page_size: Number(q.page_size) || 20, locale: typeof q.locale === 'string' ? q.locale : undefined };
    const platform = String(req.params.platform);
    res.json(typeof q.keyword === 'string' && q.keyword.trim() ? await d.v1.search(platform, q.keyword, p) : await d.v1.list(platform, p));
  }));

  r.post('/admin/sources/seriesjeen/v2/sync-platforms', d.requireStaff('source.sync'), wrap(async (req, res) => {
    const n = await syncPlatformList(d.db, d.v2);
    await d.audit(staffIdOf(req), 'source.sync_platforms', { count: n });
    res.json({ synced: n });
  }));

  r.get('/admin/sources/seriesjeen/v2/platforms/:id/dramas', d.requireStaff('source.view'), wrap(async (req, res) => {
    const q = req.query;
    const sort = q.sort === 'title' || q.sort === 'episodes' || q.sort === 'latest' ? q.sort : undefined;
    res.json(await d.v2.dramas(intParam(req.params.id, 'platform'), {
      q: typeof q.q === 'string' ? q.q : undefined,
      genre: typeof q.genre === 'string' ? q.genre : undefined,
      sort, page: Number(q.page) || 1, page_size: Number(q.page_size) || 20,
    }));
  }));

  r.post('/admin/sources/seriesjeen/v2/import', d.requireStaff('source.sync'), wrap(async (req, res) => {
    const body = req.body as { platformId?: unknown; dramaIds?: unknown };
    const platformId = intParam(body.platformId, 'platformId');
    if (!Array.isArray(body.dramaIds)) throw new SjError(422, 'validation', 'dramaIds ต้องเป็นรายการ');
    const ids = body.dramaIds.map((x) => intParam(x, 'dramaId'));
    const result = await importDramasAsDraft(d.db, d.v2, platformId, ids, staffIdOf(req));
    await d.audit(staffIdOf(req), 'source.import', { platformId, count: result.imported, failed: result.failed.length });
    res.json(result);
  }));

  // ---------- ผู้ชม: ขอลิงก์ตอนที่กดเล่นเท่านั้น (กินโควตา 1 ต่อคำขอ) ----------
  r.get('/api/play/:contentId/:episode', d.playRateLimit(), d.optionalMember(), wrap(async (req, res) => {
    const out = await getPlayLinks(
      { db: d.db, v2: d.v2, canWatch: d.canWatch },
      intParam(req.params.contentId, 'contentId'),
      intParam(req.params.episode, 'episode'),
      memberIdOf(req),
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(out);
  }));

  return r;
}

/** บันทึกการเรียกลง api_usage_logs (ส่งเป็น log callback ให้ V1/V2) */
export function makeUsageLogger(db: Db, sourceCode: 'seriesjeen_v1' | 'seriesjeen_v2', version: 1 | 2) {
  return (e: UsageEntry): void => {
    void db.query(
      `INSERT INTO api_usage_logs (source_id, api_version, endpoint, status_code, latency_ms, quota_cost, error_code)
       SELECT id, $2, $3, $4, $5, $6, $7 FROM data_sources WHERE code = $1`,
      [sourceCode, version, e.endpoint, e.status, e.latencyMs, e.quotaCost, e.errorCode ?? null],
    ).catch(() => { /* ล็อกพลาดต้องไม่ทำให้คำขอหลักพัง */ });
  };
}
