-- =====================================================================
-- Schema ฐานข้อมูลเว็บหนัง + หลังบ้าน (PostgreSQL 15+)
-- ไม่มีข้อมูลจำลอง มีเฉพาะโครงสร้าง
-- กติกา: ลบข้อมูลสำคัญแบบ "ย้ายเข้าถังขยะ" (deleted_at) ก่อนเสมอ
-- ความปลอดภัย: สิทธิ์ต้องตรวจที่ฝั่งเซิร์ฟเวอร์ ฐานข้อมูลช่วยเก็บและบังคับความถูกต้องเท่านั้น
-- =====================================================================

BEGIN;

-- ---------- ฟังก์ชันอัปเดตเวลาแก้ไขอัตโนมัติ ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1) ผู้ดูแลระบบ (หลังบ้าน) แยกจากสมาชิกคนดูโดยเด็ดขาด
-- =====================================================================

CREATE TABLE roles (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,          -- owner / assistant / viewer
  name_th     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,          -- เช่น content.delete, revenue.view, staff.manage
  name_th     text NOT NULL
);

CREATE TABLE role_permissions (
  role_id        smallint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  smallint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE staff_users (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email              text NOT NULL,
  display_name       text NOT NULL,
  password_hash      text NOT NULL,           -- argon2id หรือ bcrypt เท่านั้น ห้ามเก็บรหัสจริง
  role_id            smallint NOT NULL REFERENCES roles(id),
  status             text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','suspended','invited')),
  totp_secret_enc    text,                    -- เก็บแบบเข้ารหัส (ยืนยันตัวตน 2 ชั้น)
  totp_enabled       boolean NOT NULL DEFAULT false,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz,
  created_by         bigint REFERENCES staff_users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_staff_email ON staff_users (lower(email));
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE staff_sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id     bigint NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,          -- เก็บแค่ค่าแฮช ไม่เก็บโทเคนจริง
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX ix_staff_sessions_staff ON staff_sessions (staff_id);

CREATE TABLE staff_login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  ip_address  inet,
  success     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_login_attempts_email_time ON staff_login_attempts (lower(email), created_at DESC);
CREATE INDEX ix_login_attempts_ip_time ON staff_login_attempts (ip_address, created_at DESC);

-- บันทึกการใช้งาน: ใครทำอะไร กับอะไร เมื่อไหร่ (เขียนอย่างเดียว ห้ามแก้ไข/ลบจากแอป)
CREATE TABLE audit_logs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id     bigint REFERENCES staff_users(id),
  action       text NOT NULL,                 -- login, content.create, content.delete, setting.update ...
  entity_type  text,
  entity_id    text,
  before_data  jsonb,
  after_data   jsonb,
  ip_address   inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_time ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX ix_audit_staff ON audit_logs (staff_id, created_at DESC);

-- =====================================================================
-- 2) แหล่งข้อมูล (API ภายนอก) พร้อมบันทึกสิทธิ์การใช้งาน
-- =====================================================================

CREATE TABLE data_sources (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                text NOT NULL UNIQUE,   -- เช่น apishort, tmdb
  name                text NOT NULL,
  base_url            text NOT NULL,
  source_kind         text NOT NULL CHECK (source_kind IN ('metadata','streaming','both')),
  api_key_ref         text,                   -- ชื่ออ้างอิงใน secret manager / env ห้ามเก็บคีย์จริงในตารางนี้
  is_active           boolean NOT NULL DEFAULT true,
  -- สิทธิ์เผยแพร่: บังคับให้เจ้าของระบุก่อนเผยแพร่เนื้อหาจากแหล่งนี้
  license_status      text NOT NULL DEFAULT 'unknown'
                      CHECK (license_status IN ('unknown','licensed','not_licensed','metadata_only')),
  license_note        text,
  license_evidence_url text,
  license_expires_at  date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ประวัติการดึงข้อมูลอัตโนมัติ
CREATE TABLE import_runs (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id    bigint NOT NULL REFERENCES data_sources(id),
  started_by   bigint REFERENCES staff_users(id),     -- NULL = ระบบรันเอง
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running'
               CHECK (status IN ('running','success','partial','failed')),
  items_found  integer NOT NULL DEFAULT 0,
  items_new    integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  error_message text
);
CREATE INDEX ix_import_runs_source ON import_runs (source_id, started_at DESC);

-- =====================================================================
-- 3) ไฟล์รูป (โปสเตอร์ แบนเนอร์ โลโก้) เก็บเฉพาะข้อมูลอ้างอิง ตัวไฟล์อยู่ที่เก็บแยก
-- =====================================================================

CREATE TABLE assets (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storage_key   text NOT NULL UNIQUE,          -- path ในที่เก็บไฟล์
  mime_type     text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/avif','image/svg+xml')),
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0),
  width         integer,
  height        integer,
  sha256        text,
  uploaded_by   bigint REFERENCES staff_users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4) หมวดหมู่ ประเภท
-- =====================================================================

CREATE TABLE categories (                       -- "หมวดหมู่หลัก"
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  seo_title        text,
  seo_description  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE genres (                           -- "ประเภทหนัง"
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  external_ref text,                            -- รหัสประเภทจากแหล่งข้อมูล
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

-- =====================================================================
-- 5) เนื้อหา: หนัง / ซีรีส์ / ละครสั้น
-- =====================================================================

CREATE TABLE contents (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_type    text NOT NULL CHECK (content_type IN ('movie','series','short_drama')),
  title           text NOT NULL,
  original_title  text,
  slug            text NOT NULL UNIQUE,
  synopsis        text,
  release_year    smallint CHECK (release_year BETWEEN 1888 AND 2100),
  runtime_minutes integer CHECK (runtime_minutes > 0),
  rating          numeric(3,1) CHECK (rating BETWEEN 0 AND 10),
  original_language text,
  country_code    char(2),
  poster_asset_id   bigint REFERENCES assets(id) ON DELETE SET NULL,
  backdrop_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  trailer_url     text,

  -- สถานะเผยแพร่
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','published','hidden')),
  publish_at      timestamptz,                  -- ตั้งเวลาเผยแพร่
  published_at    timestamptz,

  -- ที่มาของข้อมูล
  source_id       bigint REFERENCES data_sources(id),
  external_id     text,                         -- รหัสเรื่องในแหล่งข้อมูล กันดึงซ้ำ
  rights_confirmed_by bigint REFERENCES staff_users(id),  -- ใครยืนยันว่ามีสิทธิ์เผยแพร่
  rights_confirmed_at timestamptz,

  view_count      bigint NOT NULL DEFAULT 0,
  seo_title       text,
  seo_description text,

  -- ถังขยะ: ลบแล้วกู้คืนได้
  deleted_at      timestamptz,
  deleted_by      bigint REFERENCES staff_users(id),

  created_by      bigint REFERENCES staff_users(id),
  updated_by      bigint REFERENCES staff_users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_contents_source_external UNIQUE (source_id, external_id),
  -- เผยแพร่ได้ก็ต่อเมื่อมีคนยืนยันสิทธิ์แล้ว
  CONSTRAINT chk_published_requires_rights
    CHECK (status NOT IN ('published','scheduled') OR rights_confirmed_at IS NOT NULL),
  CONSTRAINT chk_scheduled_needs_time
    CHECK (status <> 'scheduled' OR publish_at IS NOT NULL)
);
CREATE INDEX ix_contents_status ON contents (status) WHERE deleted_at IS NULL;
CREATE INDEX ix_contents_type ON contents (content_type) WHERE deleted_at IS NULL;
CREATE INDEX ix_contents_created ON contents (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_contents_views ON contents (view_count DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX ix_contents_title_lower ON contents (lower(title));
CREATE TRIGGER trg_contents_updated BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE content_categories (
  content_id   bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  category_id  bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, category_id)
);
CREATE INDEX ix_content_categories_cat ON content_categories (category_id);

CREATE TABLE content_genres (
  content_id  bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  genre_id    bigint NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, genre_id)
);
CREATE INDEX ix_content_genres_genre ON content_genres (genre_id);

-- ตอน (ซีรีส์/ละครสั้น) หนังเดี่ยวไม่ต้องมี
CREATE TABLE episodes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id      bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  season_number   smallint NOT NULL DEFAULT 1 CHECK (season_number > 0),
  episode_number  integer NOT NULL CHECK (episode_number > 0),
  title           text,
  runtime_minutes integer CHECK (runtime_minutes > 0),
  external_id     text,
  is_free         boolean NOT NULL DEFAULT true,   -- ใช้เมื่อมีตอนที่ต้องเป็นสมาชิก
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, season_number, episode_number)
);
CREATE TRIGGER trg_episodes_updated BEFORE UPDATE ON episodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ลิงก์ดูหนัง: ผูกกับหนังทั้งเรื่อง หรือกับตอนใดตอนหนึ่ง อย่างใดอย่างหนึ่งเท่านั้น
CREATE TABLE stream_links (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id      bigint REFERENCES contents(id) ON DELETE CASCADE,
  episode_id      bigint REFERENCES episodes(id) ON DELETE CASCADE,
  url             text NOT NULL,
  link_kind       text NOT NULL CHECK (link_kind IN ('hls','mp4','embed')),
  quality         text,                         -- 480p / 720p / 1080p
  audio_language  text,
  subtitle_language text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  health_status   text NOT NULL DEFAULT 'unchecked'
                  CHECK (health_status IN ('unchecked','ok','broken')),
  fail_count      integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_link_target CHECK ((content_id IS NOT NULL)::int + (episode_id IS NOT NULL)::int = 1),
  CONSTRAINT chk_link_https CHECK (url ~* '^https://')
);
CREATE INDEX ix_links_content ON stream_links (content_id) WHERE content_id IS NOT NULL;
CREATE INDEX ix_links_episode ON stream_links (episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX ix_links_broken ON stream_links (health_status) WHERE health_status = 'broken';
CREATE TRIGGER trg_links_updated BEFORE UPDATE ON stream_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 6) สมาชิกคนดู (แยกจากผู้ดูแลระบบ)
-- =====================================================================

CREATE TABLE members (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          text NOT NULL,
  display_name   text,
  password_hash  text NOT NULL,
  email_verified_at timestamptz,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','deleted')),
  consent_privacy_at timestamptz NOT NULL,     -- ยอมรับนโยบายข้อมูลส่วนบุคคล (PDPA)
  consent_version    text NOT NULL,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_members_email ON members (lower(email));
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE member_tokens (                    -- ยืนยันอีเมล / ลืมรหัสผ่าน
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purpose     text NOT NULL CHECK (purpose IN ('verify_email','reset_password','session')),
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE favorites (
  member_id   bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content_id  bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, content_id)
);

CREATE TABLE watch_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id     bigint NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content_id    bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  episode_id    bigint REFERENCES episodes(id) ON DELETE CASCADE,
  progress_seconds integer NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, content_id, episode_id)
);

-- =====================================================================
-- 7) สมาชิกจ่ายเงิน (ใช้เมื่อมีแผนเก็บเงินเท่านั้น)
-- =====================================================================

CREATE TABLE subscription_plans (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  price_satang  bigint NOT NULL CHECK (price_satang >= 0),   -- เก็บเป็นสตางค์ กันทศนิยมเพี้ยน
  currency      char(3) NOT NULL DEFAULT 'THB',
  duration_days integer NOT NULL CHECK (duration_days > 0),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   bigint NOT NULL REFERENCES members(id),
  plan_id     bigint NOT NULL REFERENCES subscription_plans(id),
  status      text NOT NULL CHECK (status IN ('pending','active','expired','cancelled')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_subscriptions_member ON subscriptions (member_id, status);

CREATE TABLE payments (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id      bigint NOT NULL REFERENCES members(id),
  subscription_id bigint REFERENCES subscriptions(id),
  provider       text NOT NULL,                 -- ชื่อผู้ให้บริการชำระเงิน
  provider_ref   text NOT NULL,                 -- รหัสอ้างอิงจากผู้ให้บริการ
  amount_satang  bigint NOT NULL CHECK (amount_satang >= 0),
  currency       char(3) NOT NULL DEFAULT 'THB',
  status         text NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)               -- กันบันทึกซ้ำ
  -- ห้ามเก็บเลขบัตรเครดิตในฐานข้อมูลนี้ ให้ผู้ให้บริการชำระเงินเก็บเอง
);

-- =====================================================================
-- 8) ตั้งค่าเว็บ เมนู แบนเนอร์ บทความ
-- =====================================================================

CREATE TABLE site_settings (
  key         text PRIMARY KEY,                 -- เช่น site_name, logo_asset_id, theme_color
  value       jsonb NOT NULL,
  updated_by  bigint REFERENCES staff_users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (                       -- ทั้ง "เมนูด้านบน" และ "เมนู Footer"
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location    text NOT NULL CHECK (location IN ('header','footer')),
  label       text NOT NULL,
  url         text NOT NULL,
  parent_id   bigint REFERENCES menu_items(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE banners (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  position    text NOT NULL CHECK (position IN ('home_top','home_bottom')),
  title       text,
  image_asset_id bigint NOT NULL REFERENCES assets(id),
  link_url    text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE faq_items (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question    text NOT NULL,
  answer      text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE articles (                         -- "บทความ SEO"
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       text NOT NULL,
  slug        text NOT NULL UNIQUE,
  body_html   text NOT NULL,                    -- ต้องกรอง HTML ก่อนบันทึกและก่อนแสดง
  cover_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  seo_title   text,
  seo_description text,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  deleted_at  timestamptz,
  created_by  bigint REFERENCES staff_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 9) โฆษณา
-- =====================================================================

CREATE TABLE ad_slots (                         -- "VDO โฆษณา" "แบนเนอร์หน้าหลัก/หน้าหนัง"
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  slot_kind   text NOT NULL CHECK (slot_kind IN ('banner','video','script')),
  is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE ads (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slot_id     bigint NOT NULL REFERENCES ad_slots(id),
  advertiser  text,
  image_asset_id bigint REFERENCES assets(id) ON DELETE SET NULL,
  video_url   text,
  target_url  text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ad_inquiries (                     -- "ติดต่อโฆษณา" ที่ผู้ลงโฆษณาส่งมา
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','closed')),
  handled_by  bigint REFERENCES staff_users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 10) เสียงจากผู้ใช้: ขอหนัง / แจ้งลิงก์เสีย / แจ้งลบเนื้อหา
-- =====================================================================

CREATE TABLE movie_requests (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id   bigint REFERENCES members(id) ON DELETE SET NULL,
  title       text NOT NULL,
  note        text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','added','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE link_reports (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id  bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  episode_id  bigint REFERENCES episodes(id) ON DELETE CASCADE,
  member_id   bigint REFERENCES members(id) ON DELETE SET NULL,
  reason      text,
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','fixed','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ระบบรับแจ้งลบเนื้อหาจากเจ้าของลิขสิทธิ์ (DMCA / แจ้งลบ)
CREATE TABLE takedown_requests (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id    bigint REFERENCES contents(id) ON DELETE SET NULL,
  reported_url  text,
  claimant_name text NOT NULL,
  claimant_email text NOT NULL,
  claimant_organization text,
  description   text NOT NULL,
  good_faith_statement boolean NOT NULL,
  status        text NOT NULL DEFAULT 'received'
                CHECK (status IN ('received','content_removed','rejected','counter_notice')),
  received_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  handled_by    bigint REFERENCES staff_users(id),
  resolution_note text
);
CREATE INDEX ix_takedown_status ON takedown_requests (status, received_at DESC);

-- =====================================================================
-- 11) สถิติ
-- =====================================================================

-- ดิบ: 1 แถวต่อการดู (ควรล้างหรือ partition ตามเดือนเมื่อข้อมูลโต)
CREATE TABLE view_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_id  bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  episode_id  bigint REFERENCES episodes(id) ON DELETE CASCADE,
  member_id   bigint REFERENCES members(id) ON DELETE SET NULL,
  visitor_hash text,                            -- แฮชของผู้เยี่ยมชม ไม่เก็บ IP ตรงๆ
  viewed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_view_events_time ON view_events (viewed_at DESC);
CREATE INDEX ix_view_events_content ON view_events (content_id, viewed_at DESC);

-- สรุปรายวัน: แดชบอร์ดอ่านตารางนี้ ไม่อ่านตารางดิบ
CREATE TABLE content_daily_stats (
  stat_date   date NOT NULL,
  content_id  bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  views       bigint NOT NULL DEFAULT 0,
  unique_visitors bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, content_id)
);

-- =====================================================================
-- 12) แจ้งเตือนหลังบ้าน และบันทึกการสำรองข้อมูล
-- =====================================================================

CREATE TABLE notifications (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('broken_link','movie_request','takedown','ad_inquiry','import_failed','backup_failed','security')),
  message     text NOT NULL,
  ref_type    text,
  ref_id      bigint,
  is_read     boolean NOT NULL DEFAULT false,
  read_by     bigint REFERENCES staff_users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notifications_unread ON notifications (created_at DESC) WHERE is_read = false;

CREATE TABLE backup_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind          text NOT NULL CHECK (kind IN ('database','assets')),
  status        text NOT NULL CHECK (status IN ('success','failed')),
  location      text,
  size_bytes    bigint,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  restore_tested_at timestamptz,                -- วันที่ทดสอบกู้คืนจริงล่าสุด
  error_message text
);

COMMIT;
