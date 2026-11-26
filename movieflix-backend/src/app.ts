/** ประกอบแอป: ความปลอดภัยพื้นฐาน + เส้น API ทั้งหมด */
import express, { type ErrorRequestHandler, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import type { AppConfig } from './config';
import { createAuth } from './auth';
import { createMovieRouter } from './movies';
import { HttpError } from './http';
import {
  SeriesJeenV1, SeriesJeenV2, createSeriesJeenRouter, loadSjConfig, makeUsageLogger,
} from './seriesjeen';

export function createApp(db: Pool, cfg: AppConfig, env: Record<string, string | undefined> = process.env): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);   // ใช้เมื่ออยู่หลัง nginx/Cloudflare เพื่อให้ IP จริงถูกต้อง

  app.use(helmet({
    // API ล้วน ไม่ส่ง HTML จึงปิดทุกอย่างที่ไม่จำเป็น
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: cfg.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  // CORS: เปิดเฉพาะ origin ที่ระบุไว้เท่านั้น (ไม่ใช้ *)
  const allowedOrigin = cfg.allowedOrigin;
  if (allowedOrigin) {
    app.use((req, res, next) => {
      if (req.headers.origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
      next();
    });
  }

  app.use(express.json({ limit: '1mb' }));

  // หน้าหลังบ้านและ auth ห้ามถูกแคช
  app.use(['/auth', '/admin'], (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const auth = createAuth(db, cfg);
  app.use(auth.router);
  app.use(createMovieRouter(db, cfg, auth));

  /* ---------- SeriesJeen V1 + V2 (ต้องตั้ง SERIESJEEN_API_KEY) ---------- */
  if (env.SERIESJEEN_API_KEY) {
    const sj = loadSjConfig(env);
    const v1 = new SeriesJeenV1(sj, makeUsageLogger(db, 'seriesjeen_v1', 1));
    const v2 = new SeriesJeenV2(sj, makeUsageLogger(db, 'seriesjeen_v2', 2));
    app.use(createSeriesJeenRouter({
      express, db, v1, v2,
      requireStaff: auth.requireStaff,
      optionalMember: (): RequestHandler => (_req, _res, next) => next(),   // ระบบสมาชิกคนดูยังไม่ได้ทำ: ทุกคนถือเป็นผู้ชมทั่วไป
      playRateLimit,
      canWatch: makeCanWatch(db),
      audit: auth.audit,
    }));
  } else {
    console.warn('[sj] ไม่พบ SERIESJEEN_API_KEY: ปิดเส้นเชื่อม SeriesJeen (ส่วนอื่นของหลังบ้านทำงานปกติ)');
  }

  app.get('/healthz', (_req, res, next) => {
    db.query('SELECT 1').then(() => res.json({ ok: true })).catch(next);
  });

  app.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'ไม่พบเส้นทางนี้')));

  const onError: ErrorRequestHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.messageTh });
      return;
    }
    const e = err as { type?: string; status?: number };
    if (e.type === 'entity.parse.failed') { res.status(400).json({ error: 'bad_json', message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' }); return; }
    if (e.type === 'entity.too.large') { res.status(413).json({ error: 'too_large', message: 'ข้อมูลใหญ่เกินไป' }); return; }
    // ไม่ส่งรายละเอียดภายใน (stack, SQL) กลับไปหน้าเว็บ
    console.error('[error]', err);
    res.status(500).json({ error: 'internal', message: 'เกิดข้อผิดพลาดภายในระบบ' });
  };
  app.use(onError);
  return app;
}

/* ---------- จำกัดความถี่เส้นขอลิงก์เล่น: 30 ครั้ง/นาที/IP ---------- */
const playHits = new Map<string, number[]>();
const playRateLimit = (): RequestHandler => (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? 'unknown';
  const arr = (playHits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 30) {
    res.setHeader('Retry-After', '30');
    res.status(429).json({ error: 'rate_limited', message: 'เรียกถี่เกินไป กรุณารอสักครู่' });
    return;
  }
  arr.push(now);
  playHits.set(key, arr);
  if (playHits.size > 5000) for (const [k, v] of playHits) if (v.every((t) => now - t >= 60_000)) playHits.delete(k);
  next();
};

/** ตรวจสิทธิ์ดูตอนที่ฝั่งเซิร์ฟเวอร์: ต้องเผยแพร่แล้ว และเป็นตอนฟรี หรือสมาชิกมีแพ็กเกจที่ยังไม่หมดอายุ */
function makeCanWatch(db: Pool) {
  return async (memberId: number | null, contentId: number, episode: number): Promise<boolean> => {
    const { rows } = await db.query<{ status: string; is_free: boolean | null }>(
      `SELECT c.status, e.is_free
         FROM contents c
         LEFT JOIN episodes e ON e.content_id = c.id AND e.season_number = 1 AND e.episode_number = $2 AND e.deleted_at IS NULL
        WHERE c.id = $1 AND c.deleted_at IS NULL`, [contentId, episode]);
    const row = rows[0];
    if (!row || row.status !== 'published') return false;
    if (row.is_free !== false) return true;
    if (memberId === null) return false;
    const sub = await db.query(
      `SELECT 1 FROM subscriptions WHERE member_id = $1 AND status = 'active' AND ends_at > now() LIMIT 1`, [memberId]);
    return (sub.rowCount ?? 0) > 0;
  };
}
