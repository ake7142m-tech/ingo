/**
 * ล็อกอินแอดมิน + เซสชัน + ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ + จัดการผู้ดูแล + บันทึกการใช้งาน
 *
 * หลักการ:
 *  - รหัสผ่านเก็บเป็น scrypt hash ไม่มีรหัสฝังในโค้ด
 *  - เซสชันเป็นโทเคนสุ่มใน cookie HttpOnly+SameSite=Strict (Secure เมื่อ production) ฐานข้อมูลเก็บแค่ค่าแฮช
 *  - ทุกคำสั่งที่แก้ข้อมูลต้องมีหัว X-CSRF-Token
 *  - ทุกเส้นหลังบ้านผ่าน requireStaff(permission) ที่ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่มในหน้าจอ
 *  - ใส่รหัสผิดซ้ำ: ล็อกบัญชีชั่วคราว + จำกัดต่อ IP + บันทึกทุกครั้ง
 */
import express, { type NextFunction, type Request, type RequestHandler, type Response, type Router } from 'express';
import type { Pool } from 'pg';
import type { AppConfig } from './config';
import {
  burnPasswordTime, checkPasswordPolicy, csrfFor, decryptSecret, encryptSecret, hashPassword,
  newToken, newTotpSecret, otpauthUrl, safeEqual, sha256, verifyPassword, verifyTotp,
} from './crypto';
import {
  HttpError, asObj, asyncH, clearSessionCookie, clampPage, idParam, optEnum, readCookie,
  reqStr, safeIp, setSessionCookie,
} from './http';

export interface StaffCtx {
  id: number;
  email: string;
  displayName: string;
  roleCode: string;
  permissions: ReadonlySet<string>;
  sessionId: number;
  csrf: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffCtx;
      staffId?: number;     // ใช้ร่วมกับโมดูล SeriesJeen
      memberId?: number;
    }
  }
}

const MAX_FAILS_BEFORE_LOCK = 5;
const LOCK_MINUTES = 15;
const EMAIL_FAIL_WINDOW_LIMIT = 10;   // ต่ออีเมลใน 15 นาที
const IP_FAIL_WINDOW_LIMIT = 40;      // ต่อ IP ใน 15 นาที
const BAD_LOGIN_MSG = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
const TOO_MANY_MSG = `พยายามเข้าสู่ระบบมากเกินไป กรุณารอ ${LOCK_MINUTES} นาทีแล้วลองใหม่`;

export interface Auth {
  router: Router;
  requireStaff(permission?: string): RequestHandler;
  audit(staffId: number | null, action: string, detail: unknown): Promise<void>;
  auditEntity(staffId: number, action: string, entityType: string, entityId: string | number, before: unknown, after: unknown, ip?: string): Promise<void>;
}

export function createAuth(db: Pool, cfg: AppConfig): Auth {
  const secure = cfg.isProd;
  const ttlSec = cfg.sessionHours * 3600;

  /* ---------------- บันทึกการใช้งาน ---------------- */
  async function audit(staffId: number | null, action: string, detail: unknown): Promise<void> {
    try {
      await db.query('INSERT INTO audit_logs (staff_id, action, after_data) VALUES ($1,$2,$3)',
        [staffId, action, JSON.stringify(detail ?? null)]);
    } catch (e) { console.error('[audit] เขียนบันทึกไม่สำเร็จ', (e as Error).message); }
  }
  async function auditEntity(staffId: number, action: string, entityType: string, entityId: string | number, before: unknown, after: unknown, ip?: string): Promise<void> {
    try {
      await db.query(
        'INSERT INTO audit_logs (staff_id, action, entity_type, entity_id, before_data, after_data, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [staffId, action, entityType, String(entityId), JSON.stringify(before ?? null), JSON.stringify(after ?? null), safeIp(ip)]);
    } catch (e) { console.error('[audit] เขียนบันทึกไม่สำเร็จ', (e as Error).message); }
  }

  /* ---------------- middleware ตรวจเซสชัน + สิทธิ์ ---------------- */
  async function loadSession(req: Request): Promise<StaffCtx | null> {
    const token = readCookie(req, cfg.cookieName);
    if (!token || token.length < 20 || token.length > 200) return null;
    const { rows } = await db.query(
      `SELECT s.id AS session_id, u.id, u.email, u.display_name, r.code AS role_code,
              COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS perms
         FROM staff_sessions s
         JOIN staff_users u ON u.id = s.staff_id
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'
        GROUP BY s.id, u.id, r.code`, [sha256(token)]);
    if (rows.length === 0) return null;
    const r = rows[0] as { session_id: string; id: string; email: string; display_name: string; role_code: string; perms: string[] };
    return {
      id: Number(r.id), email: r.email, displayName: r.display_name, roleCode: r.role_code,
      permissions: new Set(r.perms), sessionId: Number(r.session_id), csrf: csrfFor(token, cfg.csrfSecret),
    };
  }

  const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  function requireStaff(permission?: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      (async () => {
        const ctx = await loadSession(req);
        if (!ctx) throw new HttpError(401, 'unauthenticated', 'กรุณาเข้าสู่ระบบ');
        if (UNSAFE.has(req.method)) {
          const sent = req.get('x-csrf-token') ?? '';
          if (!safeEqual(sent, ctx.csrf)) throw new HttpError(403, 'csrf', 'คำขอไม่ผ่านการตรวจสอบความปลอดภัย กรุณารีเฟรชหน้า');
        }
        if (permission && !ctx.permissions.has(permission)) {
          void audit(ctx.id, 'auth.denied', { permission, method: req.method, path: req.path });
          throw new HttpError(403, 'forbidden', 'คุณไม่มีสิทธิ์ทำรายการนี้');
        }
        req.staff = ctx;
        req.staffId = ctx.id;
        next();
      })().catch(next);
    };
  }

  /* ---------------- เส้น API ---------------- */
  const router = express.Router();

  const publicUser = (c: StaffCtx) => ({
    id: c.id, email: c.email, displayName: c.displayName, role: c.roleCode, permissions: [...c.permissions].sort(),
  });

  router.post('/auth/login', asyncH(async (req, res) => {
    const b = asObj(req.body);
    const email = reqStr(b, 'email', 'อีเมล', 3, 254).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    const totp = typeof b.totp === 'string' ? b.totp.trim() : '';
    if (password.length < 1 || password.length > 200) throw new HttpError(401, 'bad_credentials', BAD_LOGIN_MSG);
    const ip = safeIp(req.ip);

    // จำกัดความถี่: ต่ออีเมล และต่อ IP
    const lim = await db.query<{ by_email: string; by_ip: string }>(
      `SELECT count(*) FILTER (WHERE lower(email) = $1) AS by_email,
              count(*) FILTER (WHERE ip_address = $2::inet) AS by_ip
         FROM staff_login_attempts
        WHERE success = false AND created_at > now() - interval '15 minutes'`, [email, ip]);
    if (Number(lim.rows[0].by_email) >= EMAIL_FAIL_WINDOW_LIMIT || Number(lim.rows[0].by_ip) >= IP_FAIL_WINDOW_LIMIT) {
      res.setHeader('Retry-After', String(LOCK_MINUTES * 60));
      throw new HttpError(429, 'too_many_attempts', TOO_MANY_MSG);
    }

    const ur = await db.query<{
      id: string; password_hash: string; status: string; totp_enabled: boolean; totp_secret_enc: string | null;
      failed_login_count: number; locked_until: Date | null; last_totp_step: string | null;
    }>(`SELECT id, password_hash, status, totp_enabled, totp_secret_enc, failed_login_count, locked_until, last_totp_step
          FROM staff_users WHERE lower(email) = $1`, [email]);
    const u = ur.rows[0];

    const recordFail = async (staffId?: string) => {
      await db.query('INSERT INTO staff_login_attempts (email, ip_address, success) VALUES ($1,$2,false)', [email, ip]);
      if (staffId) {
        await db.query(
          `UPDATE staff_users
              SET failed_login_count = failed_login_count + 1,
                  locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
            WHERE id = $1`, [staffId, MAX_FAILS_BEFORE_LOCK, LOCK_MINUTES]);
      }
    };

    if (!u || u.status !== 'active') {
      await burnPasswordTime(password);
      await recordFail();
      throw new HttpError(401, 'bad_credentials', BAD_LOGIN_MSG);
    }
    if (u.locked_until && u.locked_until.getTime() > Date.now()) {
      res.setHeader('Retry-After', String(Math.ceil((u.locked_until.getTime() - Date.now()) / 1000)));
      throw new HttpError(429, 'too_many_attempts', TOO_MANY_MSG);
    }
    if (!(await verifyPassword(password, u.password_hash))) {
      await recordFail(u.id);
      throw new HttpError(401, 'bad_credentials', BAD_LOGIN_MSG);
    }

    if (u.totp_enabled) {
      if (!totp) throw new HttpError(401, 'totp_required', 'กรุณากรอกรหัสยืนยัน 6 หลักจากแอปยืนยันตัวตน');
      const step = u.totp_secret_enc ? verifyTotp(decryptSecret(u.totp_secret_enc, cfg.encKey), totp) : null;
      // ใช้รหัสซ้ำ (step เดิมหรือเก่ากว่า) ไม่ได้
      if (step === null || (u.last_totp_step !== null && step <= Number(u.last_totp_step))) {
        await recordFail(u.id);
        throw new HttpError(401, 'bad_totp', 'รหัสยืนยันไม่ถูกต้องหรือถูกใช้ไปแล้ว');
      }
      await db.query('UPDATE staff_users SET last_totp_step = $2 WHERE id = $1', [u.id, step]);
    }

    const token = newToken();
    await db.query(
      `INSERT INTO staff_sessions (staff_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1,$2,$3,$4, now() + make_interval(secs => $5))`,
      [u.id, sha256(token), ip, (req.get('user-agent') ?? '').slice(0, 300), ttlSec]);
    await db.query('UPDATE staff_users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [u.id]);
    await db.query('INSERT INTO staff_login_attempts (email, ip_address, success) VALUES ($1,$2,true)', [email, ip]);
    // เก็บกวาดเซสชันหมดอายุ
    void db.query(`DELETE FROM staff_sessions WHERE expires_at < now() - interval '7 days'`).catch(() => undefined);

    setSessionCookie(res, cfg.cookieName, token, ttlSec, secure);
    const ctx = await loadSessionByToken(token);
    await audit(Number(u.id), 'auth.login', { ip });
    res.json({ user: publicUser(ctx), csrfToken: ctx.csrf });
  }));

  async function loadSessionByToken(token: string): Promise<StaffCtx> {
    const fake = { headers: { cookie: `${cfg.cookieName}=${encodeURIComponent(token)}` } } as unknown as Request;
    const ctx = await loadSession(fake);
    if (!ctx) throw new HttpError(500, 'session', 'สร้างเซสชันไม่สำเร็จ');
    return ctx;
  }

  router.get('/auth/me', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    res.json({ user: publicUser(c), csrfToken: c.csrf });
  }));

  router.post('/auth/logout', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    await db.query('UPDATE staff_sessions SET revoked_at = now() WHERE id = $1', [c.sessionId]);
    clearSessionCookie(res, cfg.cookieName, secure);
    await audit(c.id, 'auth.logout', null);
    res.json({ ok: true });
  }));

  router.post('/auth/change-password', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    const b = asObj(req.body);
    const current = typeof b.currentPassword === 'string' ? b.currentPassword : '';
    const next = typeof b.newPassword === 'string' ? b.newPassword : '';
    const bad = checkPasswordPolicy(next);
    if (bad) throw new HttpError(422, 'weak_password', bad);
    const r = await db.query<{ password_hash: string }>('SELECT password_hash FROM staff_users WHERE id = $1', [c.id]);
    if (!(await verifyPassword(current, r.rows[0].password_hash))) throw new HttpError(401, 'bad_credentials', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    await db.query('UPDATE staff_users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [c.id, await hashPassword(next)]);
    // ออกจากระบบทุกเครื่องยกเว้นเครื่องนี้
    await db.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND id <> $2 AND revoked_at IS NULL', [c.id, c.sessionId]);
    await audit(c.id, 'auth.password_changed', null);
    res.json({ ok: true });
  }));

  /* ---------- ยืนยันตัวตน 2 ชั้น ---------- */
  router.post('/auth/totp/setup', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    const cur = await db.query<{ totp_enabled: boolean }>('SELECT totp_enabled FROM staff_users WHERE id = $1', [c.id]);
    if (cur.rows[0].totp_enabled) throw new HttpError(409, 'totp_already', 'เปิดใช้ยืนยัน 2 ชั้นอยู่แล้ว');
    const secret = newTotpSecret();
    await db.query('UPDATE staff_users SET totp_secret_enc = $2, totp_enabled = false WHERE id = $1', [c.id, encryptSecret(secret, cfg.encKey)]);
    res.json({ secret, otpauthUrl: otpauthUrl(secret, c.email, cfg.issuer) });
  }));

  router.post('/auth/totp/enable', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    const code = reqStr(asObj(req.body), 'code', 'รหัสยืนยัน', 6, 6);
    const r = await db.query<{ totp_secret_enc: string | null }>('SELECT totp_secret_enc FROM staff_users WHERE id = $1', [c.id]);
    const enc = r.rows[0].totp_secret_enc;
    const step = enc ? verifyTotp(decryptSecret(enc, cfg.encKey), code) : null;
    if (step === null) throw new HttpError(422, 'bad_totp', 'รหัสยืนยันไม่ถูกต้อง');
    await db.query('UPDATE staff_users SET totp_enabled = true, last_totp_step = $2 WHERE id = $1', [c.id, step]);
    await audit(c.id, 'auth.totp_enabled', null);
    res.json({ ok: true });
  }));

  router.post('/auth/totp/disable', requireStaff(), asyncH(async (req, res) => {
    const c = req.staff!;
    const b = asObj(req.body);
    const pw = typeof b.password === 'string' ? b.password : '';
    const r = await db.query<{ password_hash: string }>('SELECT password_hash FROM staff_users WHERE id = $1', [c.id]);
    if (!(await verifyPassword(pw, r.rows[0].password_hash))) throw new HttpError(401, 'bad_credentials', 'รหัสผ่านไม่ถูกต้อง');
    await db.query('UPDATE staff_users SET totp_enabled = false, totp_secret_enc = NULL, last_totp_step = NULL WHERE id = $1', [c.id]);
    await audit(c.id, 'auth.totp_disabled', null);
    res.json({ ok: true });
  }));

  /* ---------- จัดการผู้ดูแล (เฉพาะเจ้าของ) ---------- */
  router.get('/admin/staff', requireStaff('staff.manage'), asyncH(async (_req, res) => {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.display_name AS "displayName", r.code AS role, u.status,
              u.totp_enabled AS "totpEnabled", u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt"
         FROM staff_users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`);
    res.json({ items: rows });
  }));

  router.post('/admin/staff', requireStaff('staff.manage'), asyncH(async (req, res) => {
    const b = asObj(req.body);
    const email = reqStr(b, 'email', 'อีเมล', 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, 'validation', 'รูปแบบอีเมลไม่ถูกต้อง');
    const displayName = reqStr(b, 'displayName', 'ชื่อที่แสดง', 1, 80);
    const role = optEnum(b, 'role', 'บทบาท', ['assistant', 'viewer'] as const);
    if (!role) throw new HttpError(422, 'validation', 'กรุณาเลือกบทบาท (สร้างเจ้าของเพิ่มต้องทำผ่านคำสั่ง create-owner)');
    const password = typeof b.password === 'string' ? b.password : '';
    const bad = checkPasswordPolicy(password);
    if (bad) throw new HttpError(422, 'weak_password', bad);
    const dup = await db.query('SELECT 1 FROM staff_users WHERE lower(email) = $1', [email]);
    if (dup.rowCount) throw new HttpError(409, 'duplicate', 'อีเมลนี้มีผู้ใช้แล้ว');
    const ins = await db.query<{ id: string }>(
      `INSERT INTO staff_users (email, display_name, password_hash, role_id, created_by)
       VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code = $4),$5) RETURNING id`,
      [email, displayName, await hashPassword(password), role, req.staff!.id]);
    await auditEntity(req.staff!.id, 'staff.create', 'staff_user', ins.rows[0].id, null, { email, role }, req.ip);
    res.status(201).json({ id: Number(ins.rows[0].id) });
  }));

  router.patch('/admin/staff/:id', requireStaff('staff.manage'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const b = asObj(req.body);
    const role = optEnum(b, 'role', 'บทบาท', ['assistant', 'viewer'] as const);
    const status = optEnum(b, 'status', 'สถานะ', ['active', 'suspended'] as const);
    if (id === req.staff!.id) throw new HttpError(409, 'self', 'ไม่สามารถแก้ไขบัญชีของตัวเองที่หน้านี้');
    const cur = await db.query<{ role: string; status: string }>(
      'SELECT r.code AS role, u.status FROM staff_users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [id]);
    if (!cur.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบผู้ใช้');
    if (cur.rows[0].role === 'owner') throw new HttpError(409, 'owner_protected', 'ไม่สามารถแก้ไขบัญชีเจ้าของจากหน้านี้');
    await db.query(
      `UPDATE staff_users SET role_id = COALESCE((SELECT id FROM roles WHERE code = $2), role_id),
                              status = COALESCE($3, status), updated_at = now() WHERE id = $1`, [id, role ?? null, status ?? null]);
    if (status === 'suspended') await db.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL', [id]);
    await auditEntity(req.staff!.id, 'staff.update', 'staff_user', id, cur.rows[0], { role, status }, req.ip);
    res.json({ ok: true });
  }));

  router.post('/admin/staff/:id/revoke-sessions', requireStaff('staff.manage'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    await db.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL', [id]);
    await auditEntity(req.staff!.id, 'staff.revoke_sessions', 'staff_user', id, null, null, req.ip);
    res.json({ ok: true });
  }));

  /* ---------- ดูบันทึกการใช้งาน ---------- */
  router.get('/admin/audit-logs', requireStaff('audit.view'), asyncH(async (req, res) => {
    const page = clampPage(req.query.page, 1, 100000);
    const size = Math.min(clampPage(req.query.pageSize, 50, 200), 200);
    const action = typeof req.query.action === 'string' ? req.query.action.slice(0, 80) : null;
    const { rows } = await db.query(
      `SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.before_data AS "before", a.after_data AS "after", a.created_at AS "createdAt",
              u.display_name AS "staffName"
         FROM audit_logs a LEFT JOIN staff_users u ON u.id = a.staff_id
        WHERE ($1::text IS NULL OR a.action = $1)
        ORDER BY a.id DESC LIMIT $2 OFFSET $3`, [action, size, (page - 1) * size]);
    res.json({ items: rows, page, pageSize: size });
  }));

  return { router, requireStaff, audit, auditEntity };
}
