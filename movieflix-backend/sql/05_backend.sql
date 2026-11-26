-- =====================================================================
-- ส่วนเสริมสำหรับเซิร์ฟเวอร์หลังบ้าน (รันหลัง schema.sql + ไฟล์เสริมอื่นๆ)
--   1) บทบาทและสิทธิ์ที่ระบบต้องมีเพื่อทำงาน (เป็นค่าตั้งต้นของระบบ ไม่ใช่ข้อมูลจำลอง)
--   2) คอลัมน์กันใช้รหัส 2 ชั้นซ้ำ (TOTP replay)
-- บัญชีเจ้าของคนแรกสร้างด้วยคำสั่ง create-owner ห้ามใส่รหัสผ่านในไฟล์ SQL
-- =====================================================================

BEGIN;

ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_totp_step bigint;

-- ฟิลด์ที่ฟอร์มหนังเดิมใช้ แต่ schema ยังไม่มี
ALTER TABLE contents
  ADD COLUMN IF NOT EXISTS director          text,
  ADD COLUMN IF NOT EXISTS cast_members      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backdrop_source_url text;

INSERT INTO roles (code, name_th) VALUES
  ('owner',     'เจ้าของ'),
  ('assistant', 'ผู้ช่วย'),
  ('viewer',    'ดูอย่างเดียว')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name_th) VALUES
  ('content.view',    'ดูรายการหนัง'),
  ('content.create',  'เพิ่มหนัง'),
  ('content.edit',    'แก้ไขหนัง'),
  ('content.publish', 'ยืนยันสิทธิ์และเผยแพร่หนัง'),
  ('content.delete',  'ลบหนังเข้าถังขยะ / กู้คืน'),
  ('content.purge',   'ลบหนังถาวร'),
  ('link.manage',     'จัดการลิงก์ดูหนัง'),
  ('category.manage', 'จัดการหมวดหมู่และประเภท'),
  ('source.view',     'ดูข้อมูลแหล่งข้อมูล API'),
  ('source.sync',     'ซิงก์/นำเข้าข้อมูลจาก API'),
  ('staff.manage',    'จัดการผู้ดูแลระบบ'),
  ('audit.view',      'ดูบันทึกการใช้งาน'),
  ('settings.manage', 'แก้ไขตั้งค่าเว็บ'),
  ('revenue.view',    'ดูรายได้และบัญชีรับเงิน')
ON CONFLICT (code) DO NOTHING;

-- เจ้าของ: ทุกสิทธิ์
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'owner'
ON CONFLICT DO NOTHING;

-- ผู้ช่วย: จัดการเนื้อหาได้ แต่ยืนยันสิทธิ์/เผยแพร่ ลบถาวร จัดการคน ดูรายได้ไม่ได้
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN
  ('content.view','content.create','content.edit','content.delete',
   'link.manage','category.manage','source.view','source.sync')
WHERE r.code = 'assistant'
ON CONFLICT DO NOTHING;

-- ดูอย่างเดียว
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('content.view','source.view')
WHERE r.code = 'viewer'
ON CONFLICT DO NOTHING;

COMMIT;
