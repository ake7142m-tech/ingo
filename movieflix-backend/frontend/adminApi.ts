/**
 * ตัวเรียก API หลังบ้านฝั่งหน้าตา (วางไว้ที่ src/services/adminApi.ts)
 *
 * หลักการ:
 *  - ไม่มีรหัสผ่าน/คีย์ API ในไฟล์นี้ และไม่เก็บอะไรลง localStorage
 *  - เซสชันอยู่ใน cookie HttpOnly ที่เซิร์ฟเวอร์ตั้งให้ (JavaScript ในหน้าเว็บอ่านไม่ได้ จึงขโมยผ่านสคริปต์ไม่ได้)
 *  - CSRF token เก็บในหน่วยความจำ แล้วแนบหัว X-CSRF-Token กับทุกคำสั่งที่แก้ข้อมูล
 *  - รีเฟรชหน้า: เรียก restoreSession() เพื่อขอ CSRF token ใหม่จากเซสชันที่ยังไม่หมดอายุ
 *
 * ตั้งค่า VITE_API_BASE ใน .env ของหน้าตา (ว่างไว้ = เรียกโดเมนเดียวกัน ซึ่งปลอดภัยที่สุด)
 */

const BASE: string = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE ?? '';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken = '';
/** เรียกเมื่อเซสชันหมดอายุ (401) ให้ App พากลับหน้าล็อกอิน */
let onUnauthenticated: (() => void) | undefined;
export const setOnUnauthenticated = (fn: () => void): void => { onUnauthenticated = fn; };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method, headers, credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
  }
  const text = await res.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }

  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string };
    if (res.status === 401 && d.error === 'unauthenticated') { csrfToken = ''; onUnauthenticated?.(); }
    throw new ApiError(res.status, d.error ?? `http_${res.status}`, d.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
  return data as T;
}

const qs = (p: Record<string, string | number | boolean | undefined | null>): string => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
};

/* ===================== ชนิดข้อมูล ===================== */

export interface SessionUser {
  id: number; email: string; displayName: string;
  role: 'owner' | 'assistant' | 'viewer';
  permissions: string[];
}

export interface ApiMovie {
  id: number; code: string; contentType: 'movie' | 'series' | 'short_drama';
  title: string; titleEn: string; year: number | null; rating: number | null; duration: number | null;
  quality: 'SD' | 'HD' | 'FHD' | '4K' | 'CAM' | null;
  /** 'active' = เผยแพร่แล้ว, 'draft' = ฉบับร่าง (ชื่อเดียวกับหน้าตาเดิม) */
  status: 'active' | 'draft';
  synopsis: string; director: string; cast: string[]; featured: boolean;
  poster: string; posterUrl: string; backdropUrl: string;
  category: string; categories: { id: number; name: string }[];
  genres: string[]; genreList: { id: number; name: string }[];
  rightsConfirmed: boolean; views: number; deletedAt: string | null; createdAt: string;
}

export interface MovieInput {
  title: string; titleEn?: string | null; year?: number | null; rating?: number | null; duration?: number | null;
  quality?: ApiMovie['quality']; synopsis?: string | null; director?: string | null; cast?: string[];
  featured?: boolean; posterUrl?: string | null; backdropUrl?: string | null;
  contentType?: ApiMovie['contentType'];
  categoryIds?: number[]; genreIds?: number[];
  status?: 'active' | 'draft';
  /** ต้องเป็น true เมื่อตั้งสถานะเป็นเผยแพร่ (เฉพาะบัญชีที่มีสิทธิ์ content.publish) */
  rightsConfirmed?: boolean;
}

export interface MovieListParams {
  q?: string; status?: 'active' | 'draft'; type?: ApiMovie['contentType']; categoryId?: number;
  sort?: 'latest' | 'title' | 'year' | 'rating' | 'views'; page?: number; pageSize?: number; trash?: boolean;
}

export interface StreamLink {
  id: number; url: string; linkKind: 'hls' | 'mp4' | 'embed'; quality: string | null;
  audioLanguage: string | null; subtitleLanguage: string | null; sortOrder: number; isActive: boolean;
  healthStatus: 'unchecked' | 'ok' | 'broken'; lastCheckedAt: string | null;
}

export interface Taxonomy {
  id: number; name: string; slug: string; sortOrder: number; isActive: boolean; movieCount: number;
  seoTitle?: string | null; seoDescription?: string | null;
}

/* ===================== การเข้าสู่ระบบ ===================== */

export const auth = {
  /** ถ้าเปิด 2FA และยังไม่ส่ง totp เซิร์ฟเวอร์ตอบ ApiError code = 'totp_required' */
  async login(email: string, password: string, totp?: string): Promise<SessionUser> {
    const r = await request<{ user: SessionUser; csrfToken: string }>('POST', '/auth/login', { email, password, totp });
    csrfToken = r.csrfToken;
    return r.user;
  },
  async logout(): Promise<void> {
    try { await request('POST', '/auth/logout'); } finally { csrfToken = ''; }
  },
  /** เรียกตอนเปิดแอป/รีเฟรชหน้า คืน null ถ้ายังไม่ได้ล็อกอิน */
  async restoreSession(): Promise<SessionUser | null> {
    try {
      const r = await request<{ user: SessionUser; csrfToken: string }>('GET', '/auth/me');
      csrfToken = r.csrfToken;
      return r.user;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),
  totpSetup: () => request<{ secret: string; otpauthUrl: string }>('POST', '/auth/totp/setup'),
  totpEnable: (code: string) => request<{ ok: true }>('POST', '/auth/totp/enable', { code }),
  totpDisable: (password: string) => request<{ ok: true }>('POST', '/auth/totp/disable', { password }),
};

/** ใช้ซ่อน/แสดงเมนูให้เหมาะกับสิทธิ์ (เป็นแค่ความสะดวก เซิร์ฟเวอร์ตรวจสิทธิ์จริงทุกคำสั่งอยู่แล้ว) */
export const can = (user: SessionUser | null, permission: string): boolean =>
  !!user && user.permissions.includes(permission);

/* ===================== หนัง ===================== */

export const movies = {
  list: (p: MovieListParams = {}) =>
    request<{ items: ApiMovie[]; total: number; page: number; pageSize: number }>(
      'GET', `/admin/movies${qs({ ...p, trash: p.trash ? 1 : undefined })}`),
  get: (id: number) => request<ApiMovie>('GET', `/admin/movies/${id}`),
  create: (input: MovieInput) => request<ApiMovie>('POST', '/admin/movies', input),
  update: (id: number, input: Partial<MovieInput>) => request<ApiMovie>('PATCH', `/admin/movies/${id}`, input),
  /** ลบ = ย้ายเข้าถังขยะ กู้คืนได้ */
  trash: (id: number) => request<{ ok: true; message: string }>('DELETE', `/admin/movies/${id}`),
  restore: (id: number) => request<{ ok: true; message: string }>('POST', `/admin/movies/${id}/restore`),
  purge: (id: number) => request<{ ok: true }>('DELETE', `/admin/movies/${id}/permanent`),

  links: {
    list: (movieId: number) => request<{ items: StreamLink[] }>('GET', `/admin/movies/${movieId}/links`),
    add: (movieId: number, l: { url: string; linkKind: StreamLink['linkKind']; quality?: string; sortOrder?: number }) =>
      request<{ id: number }>('POST', `/admin/movies/${movieId}/links`, l),
    update: (movieId: number, linkId: number, l: Partial<{ url: string; linkKind: StreamLink['linkKind']; quality: string; isActive: boolean; sortOrder: number }>) =>
      request<{ ok: true }>('PATCH', `/admin/movies/${movieId}/links/${linkId}`, l),
    remove: (movieId: number, linkId: number) => request<{ ok: true }>('DELETE', `/admin/movies/${movieId}/links/${linkId}`),
  },
};

/* ===================== หมวดหมู่ / ประเภท ===================== */

const taxonomy = (path: 'categories' | 'genres') => ({
  list: () => request<{ items: Taxonomy[] }>('GET', `/admin/${path}`),
  create: (t: { name: string; sortOrder?: number; isActive?: boolean; seoTitle?: string; seoDescription?: string }) =>
    request<{ id: number }>('POST', `/admin/${path}`, t),
  update: (id: number, t: Partial<{ name: string; sortOrder: number; isActive: boolean }>) =>
    request<{ ok: true }>('PATCH', `/admin/${path}/${id}`, t),
  remove: (id: number) => request<{ ok: true }>('DELETE', `/admin/${path}/${id}`),
});
export const categories = taxonomy('categories');
export const genres = taxonomy('genres');

/* ===================== ผู้ดูแลระบบ + บันทึกการใช้งาน ===================== */

export const staff = {
  list: () => request<{ items: { id: number; email: string; displayName: string; role: string; status: string; totpEnabled: boolean; lastLoginAt: string | null }[] }>('GET', '/admin/staff'),
  create: (s: { email: string; displayName: string; role: 'assistant' | 'viewer'; password: string }) =>
    request<{ id: number }>('POST', '/admin/staff', s),
  update: (id: number, s: { role?: 'assistant' | 'viewer'; status?: 'active' | 'suspended' }) =>
    request<{ ok: true }>('PATCH', `/admin/staff/${id}`, s),
  revokeSessions: (id: number) => request<{ ok: true }>('POST', `/admin/staff/${id}/revoke-sessions`),
};

export const auditLogs = {
  list: (p: { page?: number; pageSize?: number; action?: string } = {}) =>
    request<{ items: { id: number; action: string; entityType: string | null; entityId: string | null; staffName: string | null; createdAt: string; before: unknown; after: unknown }[] }>(
      'GET', `/admin/audit-logs${qs(p)}`),
};

/* ===================== SeriesJeen (ผ่านเซิร์ฟเวอร์เรา ไม่ยิงตรง และไม่มีคีย์ในหน้าเว็บ) ===================== */

export const seriesJeen = {
  status: () => request<unknown>('GET', '/admin/sources/seriesjeen/status'),
  syncPlatforms: () => request<{ synced: number }>('POST', '/admin/sources/seriesjeen/v2/sync-platforms'),
  dramas: (platformId: number, p: { q?: string; genre?: string; sort?: 'latest' | 'title' | 'episodes'; page?: number; page_size?: number } = {}) =>
    request<unknown>('GET', `/admin/sources/seriesjeen/v2/platforms/${platformId}/dramas${qs(p)}`),
  /** นำเข้าเป็นฉบับร่างเสมอ ต้องให้เจ้าของยืนยันสิทธิ์ก่อนจึงเผยแพร่ได้ */
  importDramas: (platformId: number, dramaIds: number[]) =>
    request<{ imported: number; failed: unknown[] }>('POST', '/admin/sources/seriesjeen/v2/import', { platformId, dramaIds }),
  v1PlatformsHealth: () => request<unknown>('GET', '/admin/sources/seriesjeen/v1/platforms-health'),
  v1List: (platform: string, p: { page?: number; page_size?: number } = {}) =>
    request<unknown>('GET', `/admin/sources/seriesjeen/v1/${encodeURIComponent(platform)}/list${qs(p)}`),
  v1ThaiDub: (p: { page?: number; page_size?: number } = {}) =>
    request<unknown>('GET', `/admin/sources/seriesjeen/v1/thaidub${qs(p)}`),
};

/** ฝั่งผู้ชม: ขอลิงก์เล่นตอนที่กดเล่นเท่านั้น (กินโควตา 1 ต่อครั้ง) */
export const player = {
  links: (contentId: number, episode: number) => request<unknown>('GET', `/api/play/${contentId}/${episode}`),
};
