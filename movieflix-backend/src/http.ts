/** ตัวช่วยฝั่ง HTTP: error มาตรฐาน ตรวจข้อมูลขาเข้า และคุกกี้ */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly messageTh: string,
  ) {
    super(messageTh);
  }
}

export const asyncH = (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/* ---------- ตรวจข้อมูลขาเข้า (ไม่เชื่อค่าจากหน้าเว็บ) ---------- */

type Obj = Record<string, unknown>;
export const asObj = (v: unknown): Obj => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new HttpError(422, 'validation', 'รูปแบบข้อมูลไม่ถูกต้อง');
  return v as Obj;
};

export function reqStr(o: Obj, k: string, label: string, min = 1, max = 300): string {
  const v = o[k];
  if (typeof v !== 'string') throw new HttpError(422, 'validation', `กรุณาระบุ${label}`);
  const t = v.trim();
  if (t.length < min) throw new HttpError(422, 'validation', `กรุณาระบุ${label}`);
  if (t.length > max) throw new HttpError(422, 'validation', `${label}ยาวเกินไป (สูงสุด ${max} ตัวอักษร)`);
  return t;
}

export function optStr(o: Obj, k: string, label: string, max = 5000): string | null | undefined {
  if (!(k in o)) return undefined;            // ไม่ได้ส่งมา = ไม่แก้
  const v = o[k];
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(422, 'validation', `${label}ยาวเกินไป`);
  return t === '' ? null : t;
}

export function optInt(o: Obj, k: string, label: string, min: number, max: number): number | null | undefined {
  if (!(k in o)) return undefined;
  const v = o[k];
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  return n;
}

export function optNum(o: Obj, k: string, label: string, min: number, max: number): number | null | undefined {
  if (!(k in o)) return undefined;
  const v = o[k];
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  return n;
}

export function optBool(o: Obj, k: string): boolean | undefined {
  if (!(k in o)) return undefined;
  if (typeof o[k] !== 'boolean') throw new HttpError(422, 'validation', 'ค่าเปิด/ปิดไม่ถูกต้อง');
  return o[k] as boolean;
}

export function optEnum<T extends string>(o: Obj, k: string, label: string, allowed: readonly T[]): T | undefined {
  if (!(k in o)) return undefined;
  const v = o[k];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  return v as T;
}

export function intIdList(o: Obj, k: string, label: string, maxLen = 50): number[] | undefined {
  if (!(k in o)) return undefined;
  const v = o[k];
  if (!Array.isArray(v) || v.length > maxLen) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  const out = v.map((x) => Number(x));
  if (out.some((n) => !Number.isInteger(n) || n < 1)) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  return [...new Set(out)];
}

export function idParam(v: unknown, label = 'รหัส'): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2_000_000_000) throw new HttpError(422, 'validation', `${label}ไม่ถูกต้อง`);
  return n;
}

export function httpsUrl(v: string, label: string): string {
  let u: URL;
  try { u = new URL(v); } catch { throw new HttpError(422, 'validation', `${label}ไม่ใช่ลิงก์ที่ถูกต้อง`); }
  if (u.protocol !== 'https:') throw new HttpError(422, 'validation', `${label}ต้องขึ้นต้นด้วย https://`);
  return u.toString();
}

export const clampPage = (v: unknown, def: number, max: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : def;
};

export const slugify = (s: string): string =>
  s.normalize('NFKC').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';

/* ---------- คุกกี้ ---------- */

export function readCookie(req: Request, name: string): string | undefined {
  const h = req.headers.cookie;
  if (!h) return undefined;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; }
    }
  }
  return undefined;
}

export function setSessionCookie(res: Response, name: string, value: string, maxAgeSec: number, secure: boolean): void {
  const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
  if (secure) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(res: Response, name: string, secure: boolean): void {
  setSessionCookie(res, name, '', 0, secure);
}

export const safeIp = (ip: string | undefined): string | null =>
  ip && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
