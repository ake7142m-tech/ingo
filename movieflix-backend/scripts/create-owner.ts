/**
 * สร้างบัญชีเจ้าของคนแรก (หรือรีเซ็ตรหัสเจ้าของที่ลืม)
 *   OWNER_EMAIL=you@example.com OWNER_NAME="ชื่อคุณ" OWNER_PASSWORD='...' npm run create-owner
 * รหัสผ่านส่งผ่าน environment ชั่วคราว ไม่ถูกบันทึกในไฟล์หรือ log
 */
import { Pool } from 'pg';
import { checkPasswordPolicy, hashPassword } from '../src/crypto';

async function main(): Promise<void> {
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
  const name = (process.env.OWNER_NAME ?? '').trim();
  const password = process.env.OWNER_PASSWORD ?? '';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('ต้องตั้ง DATABASE_URL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('OWNER_EMAIL ไม่ถูกต้อง');
  if (!name) throw new Error('ต้องระบุ OWNER_NAME');
  const bad = checkPasswordPolicy(password);
  if (bad) throw new Error(bad);

  const db = new Pool({ connectionString: url, max: 1 });
  try {
    const hash = await hashPassword(password);
    const ex = await db.query<{ id: string; role: string }>(
      'SELECT u.id, r.code AS role FROM staff_users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = $1', [email]);
    if (ex.rows[0]) {
      if (ex.rows[0].role !== 'owner') throw new Error('อีเมลนี้เป็นบัญชีที่ไม่ใช่เจ้าของ ไม่รีเซ็ตให้จากสคริปต์นี้');
      await db.query(
        `UPDATE staff_users SET password_hash = $2, failed_login_count = 0, locked_until = NULL, status = 'active',
                password_changed_at = now() WHERE id = $1`, [ex.rows[0].id, hash]);
      await db.query('UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL', [ex.rows[0].id]);
      console.log('รีเซ็ตรหัสผ่านเจ้าของแล้ว และออกจากระบบทุกเครื่อง');
    } else {
      await db.query(
        `INSERT INTO staff_users (email, display_name, password_hash, role_id) VALUES ($1,$2,$3,(SELECT id FROM roles WHERE code = 'owner'))`,
        [email, name, hash]);
      console.log('สร้างบัญชีเจ้าของแล้ว แนะนำให้ล็อกอินแล้วเปิดยืนยัน 2 ชั้นทันที');
    }
  } finally { await db.end(); }
}
main().catch((e: Error) => { console.error('ผิดพลาด:', e.message); process.exit(1); });
