/**
 * ตั้งค่าเซิร์ฟเวอร์ อ่านจาก environment เท่านั้น
 * ถ้าค่าที่จำเป็นขาดหรือไม่ปลอดภัย เซิร์ฟเวอร์จะไม่ยอมเริ่มทำงาน (ดีกว่าเปิดแบบโล่งๆ)
 */
import { Pool } from 'pg';

export interface AppConfig {
  isProd: boolean;
  port: number;
  databaseUrl: string;
  /** hex 64 ตัว ใช้เข้ารหัส secret ของ 2FA ในฐานข้อมูล */
  encKey: string;
  /** ใช้เซ็น CSRF token อย่างน้อย 32 ตัวอักษร */
  csrfSecret: string;
  cookieName: string;
  sessionHours: number;
  /** ถ้าหลังบ้านอยู่คนละโดเมนกับเซิร์ฟเวอร์ ใส่ origin ที่อนุญาต (ไม่ใส่ = ไม่เปิด CORS) */
  allowedOrigin?: string;
  trustProxy: boolean;
  assetBaseUrl: string;
  issuer: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const isProd = env.NODE_ENV === 'production';
  const need = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`ต้องตั้งค่า ${k} ใน environment ก่อนเริ่มเซิร์ฟเวอร์`);
    return v;
  };
  const encKey = need('APP_ENC_KEY');
  if (!/^[0-9a-fA-F]{64}$/.test(encKey)) throw new Error('APP_ENC_KEY ต้องเป็น hex 64 ตัวอักษร (สร้างด้วย: openssl rand -hex 32)');
  const csrfSecret = need('APP_CSRF_SECRET');
  if (csrfSecret.length < 32) throw new Error('APP_CSRF_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร');
  if (isProd && !env.ALLOWED_ORIGIN && env.ALLOW_SAME_ORIGIN_ONLY !== '1') {
    // ไม่บังคับ แต่เตือนให้เจ้าของตั้งใจเลือก
    console.warn('[config] ไม่ได้ตั้ง ALLOWED_ORIGIN: เซิร์ฟเวอร์จะไม่เปิด CORS (ใช้ได้เมื่อหน้าตากับ API อยู่โดเมนเดียวกัน)');
  }
  return {
    isProd,
    port: Number(env.PORT ?? 3000),
    databaseUrl: need('DATABASE_URL'),
    encKey,
    csrfSecret,
    cookieName: isProd ? '__Host-mf_session' : 'mf_session',
    sessionHours: Number(env.SESSION_HOURS ?? 8),
    allowedOrigin: env.ALLOWED_ORIGIN,
    trustProxy: env.TRUST_PROXY === '1',
    assetBaseUrl: (env.ASSET_BASE_URL ?? '').replace(/\/$/, ''),
    issuer: env.APP_ISSUER ?? 'MOVIEFLIX Admin',
  };
}

export function createPool(cfg: AppConfig): Pool {
  return new Pool({ connectionString: cfg.databaseUrl, max: 10, idleTimeoutMillis: 30_000 });
}
