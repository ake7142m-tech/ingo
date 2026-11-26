-- =====================================================================
-- ส่วนเสริมที่ 3 ของ schema.sql: สิ่งที่พบในโค้ดหน้าตาเดิมแต่ยังไม่มีตาราง
--   - ถ่ายทอดสด (กีฬา/แมตช์) + เซิร์ฟเวอร์สตรีม
--   - แจ้งเตือน Push ถึงสมาชิก
--   - แจ้งโอนเงิน/สลิป ให้เจ้าของกดอนุมัติ
--   - ตั้งค่า CDN สำหรับลิงก์วิดีโอที่ต้องเซ็นสิทธิ์ (HLS)
--   - ฟิลด์เพิ่มของหนัง (คุณภาพ, TMDB, พากย์ไทย)
-- ลำดับการรัน: schema.sql -> bank_accounts.sql -> ไฟล์นี้
-- =====================================================================

BEGIN;

-- ---------- 1) ฟิลด์เพิ่มของหนัง ----------
-- หมายเหตุ: หน้าตาเดิมใช้สถานะ active/Draft  ให้แมป active = published, Draft = draft
ALTER TABLE contents
  ADD COLUMN quality       text CHECK (quality IN ('SD','HD','FHD','4K','CAM')),
  ADD COLUMN tmdb_id       integer,
  ADD COLUMN is_thai_dub   boolean NOT NULL DEFAULT false,
  ADD COLUMN has_thai_sub  boolean NOT NULL DEFAULT false,
  ADD COLUMN platform_code text;           -- แพลตฟอร์มต้นทางจาก API เช่น thaidub

CREATE UNIQUE INDEX uq_contents_tmdb ON contents (tmdb_id)
  WHERE tmdb_id IS NOT NULL AND deleted_at IS NULL;

-- ---------- 2) ตั้งค่า CDN (ลิงก์วิดีโอเซ็นสิทธิ์ ใช้เวลาหมดอายุ) ----------
CREATE TABLE cdn_configs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code           text NOT NULL UNIQUE,         -- เช่น edgeone_main
  provider       text NOT NULL,
  domain         text NOT NULL,
  signing_key_ref text,                        -- ชื่ออ้างอิงใน secret manager ห้ามเก็บคีย์จริงที่นี่
  url_ttl_seconds integer NOT NULL DEFAULT 3600 CHECK (url_ttl_seconds BETWEEN 30 AND 86400),
  is_active      boolean NOT NULL DEFAULT true,
  updated_by     bigint REFERENCES staff_users(id),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- เชื่อมลิงก์ดูหนังกับ CDN ที่ใช้เซ็น (ว่างได้ = ลิงก์ธรรมดา)
ALTER TABLE stream_links ADD COLUMN cdn_config_id bigint REFERENCES cdn_configs(id);

-- ---------- 3) ถ่ายทอดสด ----------
CREATE TABLE live_streams (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text NOT NULL,
  league          text,
  stadium         text,
  channel_name    text,
  home_team_name  text,
  home_team_logo_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  home_score      smallint NOT NULL DEFAULT 0 CHECK (home_score >= 0),
  away_team_name  text,
  away_team_logo_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  away_score      smallint NOT NULL DEFAULT 0 CHECK (away_score >= 0),
  status          text NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','live','ended')),
  match_starts_at timestamptz NOT NULL,        -- แทน matchTime ที่เป็นข้อความ จัดเรียง/กรองได้ถูกต้อง
  resolution      text,                        -- 720p / 1080p / 4K
  thumbnail_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  view_count      bigint NOT NULL DEFAULT 0,

  is_published    boolean NOT NULL DEFAULT false,
  rights_confirmed_by bigint REFERENCES staff_users(id),   -- สิทธิ์ถ่ายทอดสดต้องมีคนยืนยัน
  rights_confirmed_at timestamptz,

  deleted_at      timestamptz,
  deleted_by      bigint REFERENCES staff_users(id),
  created_by      bigint REFERENCES staff_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_live_published_rights
    CHECK (NOT is_published OR rights_confirmed_at IS NOT NULL)
);
CREATE INDEX ix_live_status_time ON live_streams (status, match_starts_at) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_live_updated BEFORE UPDATE ON live_streams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ช่องทางสตรีมของแต่ละแมตช์ ("n ช่องทาง")
CREATE TABLE live_stream_servers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  live_stream_id  bigint NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  name            text NOT NULL,               -- เช่น "ช่อง 1 (HD)"
  url             text NOT NULL CHECK (url ~* '^https://'),
  link_kind       text NOT NULL CHECK (link_kind IN ('hls','mp4','embed')),
  cdn_config_id   bigint REFERENCES cdn_configs(id),
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  health_status   text NOT NULL DEFAULT 'unchecked'
                  CHECK (health_status IN ('unchecked','ok','broken')),
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_live_servers_stream ON live_stream_servers (live_stream_id, sort_order);

-- ---------- 4) แจ้งเตือน Push ถึงสมาชิก ----------
CREATE TABLE push_subscriptions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   bigint REFERENCES members(id) ON DELETE CASCADE,   -- ว่างได้ = ผู้เยี่ยมชมที่ยังไม่ล็อกอิน
  endpoint    text NOT NULL UNIQUE,
  p256dh_key  text NOT NULL,
  auth_key    text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  disabled_at timestamptz                      -- ส่งไม่ถึงต่อเนื่อง ให้ปิดอัตโนมัติ
);

CREATE TABLE live_notifications (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  live_stream_id  bigint REFERENCES live_streams(id) ON DELETE SET NULL,
  title           text NOT NULL,
  message         text NOT NULL,
  channel_push    boolean NOT NULL DEFAULT true,
  status          text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','sending','sent','failed')),
  recipients_count integer NOT NULL DEFAULT 0,
  success_count   integer NOT NULL DEFAULT 0,
  failed_count    integer NOT NULL DEFAULT 0,
  sent_by         bigint REFERENCES staff_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX ix_live_notifications_stream ON live_notifications (live_stream_id, created_at DESC);

-- ---------- 5) แจ้งโอนเงิน / สลิป (เจ้าของกดอนุมัติ) ----------
CREATE TABLE payment_slips (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id        bigint NOT NULL REFERENCES members(id),
  plan_id          bigint NOT NULL REFERENCES subscription_plans(id),
  bank_account_id  bigint NOT NULL REFERENCES bank_accounts(id),   -- บัญชีที่โอนเข้า
  amount_satang    bigint NOT NULL CHECK (amount_satang > 0),
  transferred_at   timestamptz NOT NULL,
  slip_asset_id    bigint NOT NULL REFERENCES assets(id),
  slip_sha256      text NOT NULL,                                   -- กันใช้สลิปใบเดิมซ้ำ
  note             text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  reviewed_by      bigint REFERENCES staff_users(id),
  reviewed_at      timestamptz,
  reject_reason    text,
  payment_id       bigint REFERENCES payments(id),                  -- ผูกเมื่ออนุมัติแล้ว
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_slip_hash UNIQUE (slip_sha256),
  CONSTRAINT chk_slip_reviewed
    CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT chk_slip_reject_reason
    CHECK (status <> 'rejected' OR reject_reason IS NOT NULL)
);
CREATE INDEX ix_slips_pending ON payment_slips (created_at) WHERE status = 'pending';
CREATE INDEX ix_slips_member ON payment_slips (member_id, created_at DESC);

-- ---------- 6) แจ้งเตือนหลังบ้านเพิ่มชนิดใหม่ ----------
ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('broken_link','movie_request','takedown','ad_inquiry','import_failed',
                  'backup_failed','security','payment_slip','live_stream_down'));

COMMIT;

-- =====================================================================
-- คีย์ตั้งค่าที่ควรมีใน site_settings (ตามหน้าตั้งค่าเดิม)
--   site_name, site_tagline, support_email, maintenance_mode,
--   seo_meta_title, seo_meta_description, seo_meta_keywords,
--   default_language ('th' | 'en')
-- ส่วน FAQ -> faq_items, เมนู -> menu_items, โฆษณาวิดีโอ -> ads/ad_slots (มีอยู่แล้ว)
--
-- สิ่งที่หน้าตาเดิมทำไม่ปลอดภัย และต้องย้ายไปฝั่งเซิร์ฟเวอร์:
--   1) คีย์ API ของแหล่งข้อมูล (SeriesJeen) และ TMDB: เก็บใน secret manager เท่านั้น
--      ให้เซิร์ฟเวอร์เป็นคนเรียก API แล้วส่งผลให้หน้าตา
--   2) การเซ็นลิงก์ HLS (EdgeOne): ทำที่เซิร์ฟเวอร์ ใช้ cdn_configs.signing_key_ref
--   3) ล็อกอิน/ผู้ใช้: ใช้ staff_users ของ schema.sql แทนรายการผู้ใช้ที่ฝังในโค้ด
-- =====================================================================
