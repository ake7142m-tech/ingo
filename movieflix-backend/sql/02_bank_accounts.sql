-- =====================================================================
-- ส่วนเสริมของ schema.sql: ตารางบัญชีธนาคาร (จากฟอร์ม "เพิ่มข้อมูลบัญชีธนาคาร")
-- ต้องรัน schema.sql ก่อน (ใช้ staff_users, payments, set_updated_at)
-- =====================================================================

BEGIN;

-- ---------- 1) รายชื่อธนาคาร (ข้อมูลอ้างอิงจากตัวเลือก 24 ธนาคารในฟอร์ม) ----------
CREATE TABLE banks (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,            -- รหัสย่อ ตรงกับชื่อไอคอน เช่น kbank, scb
  name_th     text NOT NULL,                   -- ชื่อเต็มที่ใช้บันทึก/แสดง
  short_name  text,                            -- ชื่อย่อสำหรับพื้นที่แคบ
  icon_key    text NOT NULL,                   -- ชื่อไฟล์ไอคอน (แนะนำให้ดาวน์โหลดมาเก็บเอง)
  sort_order  smallint NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

INSERT INTO banks (code, name_th, short_name, icon_key, sort_order) VALUES
  ('bbl',   'ธนาคารกรุงเทพ',                          NULL,                     'bbl',   1),
  ('kbank', 'ธนาคารกสิกรไทย',                         NULL,                     'kbank', 2),
  ('ktb',   'ธนาคารกรุงไทย',                          NULL,                     'ktb',   3),
  ('scb',   'ธนาคารไทยพาณิชย์',                       NULL,                     'scb',   4),
  ('bay',   'ธนาคารกรุงศรีอยุธยา',                    NULL,                     'bay',   5),
  ('ttb',   'ธนาคารทีเอ็มบีธนชาต',                    NULL,                     'ttb',   6),
  ('gsb',   'ธนาคารออมสิน',                           NULL,                     'gsb',   7),
  ('ghb',   'ธนาคารอาคารสงเคราะห์',                   NULL,                     'ghb',   8),
  ('baac',  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',   'ธนาคารเพื่อการเกษตรฯ',   'baac',  9),
  ('ibank', 'ธนาคารอิสลามแห่งประเทศไทย',              NULL,                     'ibank', 10),
  ('tisco', 'ทิสโก้ แบงค์',                           NULL,                     'tisco', 11),
  ('kk',    'ธนาคารเกียรตินาคินภัทร',                 NULL,                     'kk',    12),
  ('lhb',   'แอลเอช แบงค์',                           NULL,                     'lhb',   13),
  ('citi',  'ซิตี้แบงค์',                             NULL,                     'citi',  14),
  ('hsbc',  'เอชเอสบีซี',                             NULL,                     'hsbc',  15),
  ('uob',   'ยูโอบี',                                 NULL,                     'uob',   16),
  ('cimb',  'ซิเอ็มบี ไทย',                           NULL,                     'cimb',  17),
  ('icbc',  'ไอซีบีซี (ไทย)',                         NULL,                     'icbc',  18),
  ('mufg',  'MUFG Bank',                              NULL,                     'mufg',  19),
  ('smbc',  'เอสเอ็มบีซี',                            NULL,                     'smbc',  20),
  ('sc',    'สแตนดาร์ดชาร์เตอร์ด',                    NULL,                     'sc',    21),
  ('mega',  'เมกา อินเตอร์เนชั่นแนล',                 NULL,                     'mega',  22),
  ('jpm',   'เจพี มอร์แกน เชส',                       NULL,                     'jpm',   23),
  ('boa',   'Bank of America',                        NULL,                     'boa',   24);

-- ---------- 2) บัญชีธนาคารของเจ้าของเว็บ (บัญชีรับเงิน) ----------
CREATE TABLE bank_accounts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bank_id         smallint NOT NULL REFERENCES banks(id),
  account_name    text NOT NULL CHECK (length(btrim(account_name)) > 0),   -- ชื่อบัญชี
  account_number  text NOT NULL CHECK (account_number ~ '^[0-9]{6,15}$'),  -- เก็บเฉพาะตัวเลข 6-15 หลัก
                                                                           -- ช่องว่างที่เห็นในฟอร์ม (123 456 7890) เป็นแค่การแสดงผล
  account_type    text NOT NULL DEFAULT 'savings'
                  CHECK (account_type IN ('savings','current','fixed')),   -- ออมทรัพย์ / กระแสรายวัน / ฝากประจำ
  is_primary      boolean NOT NULL DEFAULT false,                          -- บัญชีหลัก
  is_active       boolean NOT NULL DEFAULT true,                           -- ปิดใช้ชั่วคราวได้โดยไม่ต้องลบ

  -- ถังขยะ: ลบแล้วกู้คืนได้ และยังคงอ้างอิงจากประวัติการชำระเงินเดิมได้
  deleted_at      timestamptz,
  deleted_by      bigint REFERENCES staff_users(id),

  created_by      bigint REFERENCES staff_users(id),
  updated_by      bigint REFERENCES staff_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- บัญชีหลักต้องเปิดใช้งานอยู่
  CONSTRAINT chk_primary_active CHECK (NOT is_primary OR is_active)
);

-- เลขบัญชีเดียวกันของธนาคารเดียวกันซ้ำไม่ได้ (นับเฉพาะที่ยังไม่ถูกลบ)
CREATE UNIQUE INDEX uq_bank_accounts_number
  ON bank_accounts (bank_id, account_number) WHERE deleted_at IS NULL;

-- มีบัญชีหลักได้ไม่เกิน 1 บัญชี
CREATE UNIQUE INDEX uq_bank_accounts_one_primary
  ON bank_accounts (is_primary) WHERE is_primary AND deleted_at IS NULL;

CREATE INDEX ix_bank_accounts_active ON bank_accounts (is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 3) ผูกการชำระเงินกับบัญชีที่รับเงินจริง ----------
ALTER TABLE payments
  ADD COLUMN receiving_bank_account_id bigint REFERENCES bank_accounts(id);

CREATE INDEX ix_payments_bank_account ON payments (receiving_bank_account_id);

COMMIT;

-- =====================================================================
-- หมายเหตุสำหรับเดฟ
-- 1) ตั้งบัญชีหลักใหม่ ต้องทำใน transaction เดียว: UPDATE บัญชีหลักเดิมเป็น false ก่อน
--    แล้วค่อยตั้งบัญชีใหม่เป็น true ไม่เช่นนั้นจะชน uq_bank_accounts_one_primary
-- 2) เลขบัญชีเป็นข้อมูลอ่อนไหว: หน้าลิสต์ให้แสดงแบบปิดบังบางหลัก (เช่น xxx-x-x1234-x)
--    ให้เห็นเต็มเฉพาะสิทธิ์เจ้าของ และเขียนบันทึกใน audit_logs ทุกครั้งที่เพิ่ม/แก้/ลบ
-- 3) ฟอร์มเดิมโหลดไอคอนจากเว็บภายนอก (vercel-thai-banks-icon.vercel.app)
--    ควรดาวน์โหลดมาเก็บในที่เก็บไฟล์ของเว็บเอง เพื่อไม่ให้พึ่งเว็บอื่นและไม่รั่วข้อมูลผู้เข้าชม
-- 4) ตรวจสิทธิ์ (เฉพาะเจ้าของ) ที่ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่ม
-- =====================================================================
