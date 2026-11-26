-- =====================================================================
-- ส่วนเสริมที่ 4: ผูก Series Jeen API V1 + V2 (ฝั่งเซิร์ฟเวอร์)
-- ลำดับรัน: schema.sql -> bank_accounts.sql -> live_and_payments.sql -> ไฟล์นี้
-- =====================================================================

BEGIN;

-- ---------- 1) ลงทะเบียนแหล่งข้อมูล 2 ตัว (V1, V2) ----------
-- สถานะสิทธิ์เริ่มต้นเป็น 'unknown' เจ้าของต้องกรอกหลักฐานสิทธิ์เองในหลังบ้าน
-- api_key_ref = ชื่อตัวแปรใน environment ของเซิร์ฟเวอร์ (ไม่ใช่ตัวคีย์จริง)
INSERT INTO data_sources (code, name, base_url, source_kind, api_key_ref, license_status, license_note)
VALUES
  ('seriesjeen_v1', 'Series Jeen API V1', 'https://api.seriesjeen.online',    'both', 'SERIESJEEN_API_KEY', 'unknown',
   'รอเจ้าของตรวจเงื่อนไขการใช้งานและขอบเขตสิทธิ์เผยแพร่เชิงพาณิชย์'),
  ('seriesjeen_v2', 'Series Jeen API V2', 'https://api-v2.seriesjeen.online', 'both', 'SERIESJEEN_API_KEY', 'unknown',
   'รอเจ้าของตรวจเงื่อนไขการใช้งานและขอบเขตสิทธิ์เผยแพร่เชิงพาณิชย์');

-- ---------- 2) แพลตฟอร์มต้นทางที่ดึงได้ ----------
CREATE TABLE source_platforms (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id         bigint NOT NULL REFERENCES data_sources(id),
  platform_ref      text NOT NULL,              -- V2 = id ตัวเลข / V1 = slug เช่น dramabox, thaidub
  name              text NOT NULL,
  image_url         text,
  has_access        boolean NOT NULL DEFAULT false,   -- คีย์เรามีสิทธิ์แพลตฟอร์มนี้หรือไม่ (จาก /api/me)
  access_expires_at timestamptz,
  drama_count       integer,
  episode_count     integer,
  is_enabled        boolean NOT NULL DEFAULT false,   -- เจ้าของต้องเปิดใช้เองทีละแพลตฟอร์ม
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, platform_ref)
);
CREATE TRIGGER trg_source_platforms_updated BEFORE UPDATE ON source_platforms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- 3) ฟิลด์ผูกเรื่องในระบบเรากับเรื่องต้นทาง ----------
ALTER TABLE contents
  ADD COLUMN source_platform_id        bigint REFERENCES source_platforms(id),
  ADD COLUMN source_drama_id           bigint,        -- V2: id ตัวเลขของเรื่อง (ใช้ขอลิงก์เล่น)
  ADD COLUMN source_series_id          text,          -- series_id ต้นทาง
  ADD COLUMN poster_source_url         text,          -- ลิงก์โปสเตอร์ต้นทาง (มีวันหมดอายุ)
  ADD COLUMN poster_source_expires_at  timestamptz;

CREATE INDEX ix_contents_source_platform ON contents (source_platform_id) WHERE deleted_at IS NULL;

-- ---------- 4) บันทึกการเรียก API ภายนอก (ดูโควตา/ตรวจปัญหา) ----------
CREATE TABLE api_usage_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id     bigint NOT NULL REFERENCES data_sources(id),
  api_version   smallint NOT NULL CHECK (api_version IN (1,2)),
  endpoint      text NOT NULL,                  -- path เท่านั้น ห้ามเก็บคีย์หรือ query ที่มีข้อมูลลับ
  platform_ref  text,
  status_code   integer NOT NULL,               -- 0 = เครือข่ายล้มเหลว
  latency_ms    integer,
  quota_cost    smallint NOT NULL DEFAULT 0,    -- V2 /episodes = 1, อื่นๆ = 0
  error_code    text,                           -- เช่น rate_limit_exceeded, daily_quota_exceeded
  staff_id      bigint REFERENCES staff_users(id),
  member_id     bigint REFERENCES members(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_api_usage_time ON api_usage_logs (created_at DESC);
CREATE INDEX ix_api_usage_source_time ON api_usage_logs (source_id, created_at DESC);
CREATE INDEX ix_api_usage_errors ON api_usage_logs (created_at DESC) WHERE status_code >= 400 OR status_code = 0;

COMMIT;
