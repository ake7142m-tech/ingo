/**
 * จัดการหนัง / ลิงก์ดูหนัง / หมวดหมู่ / ประเภท  (ทุกเส้นตรวจสิทธิ์ที่ฝั่งเซิร์ฟเวอร์)
 *
 * กติกาสำคัญ:
 *  - ลบ = ย้ายเข้าถังขยะ (กู้คืนได้) ลบถาวรได้เฉพาะรายการที่อยู่ในถังขยะและมีสิทธิ์ content.purge
 *  - เผยแพร่ ("active") ต้องมีคนที่มีสิทธิ์ content.publish ยืนยันว่ามีสิทธิ์เผยแพร่ (rightsConfirmed)
 *    ฐานข้อมูลมี CHECK ซ้ำอีกชั้น ต่อให้โค้ดผิดก็เผยแพร่โดยไม่ยืนยันไม่ได้
 *  - ข้อมูลที่หน้าเว็บส่งมาไม่ถูกเชื่อ: ตรวจชนิด ความยาว ช่วงค่า และลิงก์ต้องเป็น https
 */
import express, { type Router } from 'express';
import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AppConfig } from './config';
import type { Auth } from './auth';
import {
  HttpError, asObj, asyncH, clampPage, httpsUrl, idParam, intIdList, optBool, optEnum, optInt,
  optNum, optStr, reqStr, slugify,
} from './http';

const QUALITIES = ['SD', 'HD', 'FHD', '4K', 'CAM'] as const;
const TYPES = ['movie', 'series', 'short_drama'] as const;
const LINK_KINDS = ['hls', 'mp4', 'embed'] as const;
const SORTS: Record<string, string> = {
  latest: 'c.created_at DESC, c.id DESC',
  title: 'lower(c.title) ASC, c.id ASC',
  year: 'c.release_year DESC NULLS LAST, c.id DESC',
  rating: 'c.rating DESC NULLS LAST, c.id DESC',
  views: 'c.view_count DESC, c.id DESC',
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const movieCode = (id: number | string) => `MV${String(id).padStart(5, '0')}`;

interface MovieRow {
  id: string; content_type: string; title: string; original_title: string | null; release_year: number | null;
  rating: string | null; runtime_minutes: number | null; quality: string | null; status: string; synopsis: string | null;
  director: string | null; cast_members: string[]; is_featured: boolean; poster_source_url: string | null;
  backdrop_source_url: string | null; poster_key: string | null; rights_confirmed: boolean; deleted_at: Date | null;
  created_at: Date; view_count: string; categories: { id: number; name: string }[]; genres: { id: number; name: string }[];
  total?: string;
}

export function createMovieRouter(db: Pool, cfg: AppConfig, auth: Auth): Router {
  const r = express.Router();
  const { requireStaff, auditEntity } = auth;

  const toMovie = (m: MovieRow) => {
    const poster = m.poster_key ? `${cfg.assetBaseUrl}/${m.poster_key}` : (m.poster_source_url ?? '');
    return {
      id: Number(m.id),
      code: movieCode(m.id),
      contentType: m.content_type,
      title: m.title,
      titleEn: m.original_title ?? '',
      year: m.release_year,
      rating: m.rating === null ? null : Number(m.rating),
      duration: m.runtime_minutes,
      quality: m.quality,
      status: m.status === 'published' ? 'active' : 'draft',   // ชื่อสถานะตามหน้าตาเดิม
      publishStatus: m.status,
      synopsis: m.synopsis ?? '',
      director: m.director ?? '',
      cast: m.cast_members,
      featured: m.is_featured,
      poster, posterUrl: poster,
      backdropUrl: m.backdrop_source_url ?? '',
      category: m.categories[0]?.name ?? '',
      categories: m.categories,
      genres: m.genres.map((g) => g.name),
      genreList: m.genres,
      rightsConfirmed: m.rights_confirmed,
      views: Number(m.view_count),
      deletedAt: m.deleted_at,
      createdAt: m.created_at,
    };
  };

  const SELECT_MOVIE = `
    SELECT c.id, c.content_type, c.title, c.original_title, c.release_year, c.rating, c.runtime_minutes, c.quality,
           c.status, c.synopsis, c.director, c.cast_members, c.is_featured, c.poster_source_url, c.backdrop_source_url,
           pa.storage_key AS poster_key, (c.rights_confirmed_at IS NOT NULL) AS rights_confirmed,
           c.deleted_at, c.created_at, c.view_count,
           COALESCE((SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name) ORDER BY cat.sort_order, cat.id)
                       FROM content_categories cc JOIN categories cat ON cat.id = cc.category_id
                      WHERE cc.content_id = c.id), '[]'::json) AS categories,
           COALESCE((SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.sort_order, g.id)
                       FROM content_genres cg JOIN genres g ON g.id = cg.genre_id
                      WHERE cg.content_id = c.id), '[]'::json) AS genres
      FROM contents c LEFT JOIN assets pa ON pa.id = c.poster_asset_id`;

  async function getMovie(id: number, includeDeleted = false): Promise<MovieRow | null> {
    const { rows } = await db.query<MovieRow>(`${SELECT_MOVIE} WHERE c.id = $1 ${includeDeleted ? '' : 'AND c.deleted_at IS NULL'}`, [id]);
    return rows[0] ?? null;
  }

  /* ---------- รายการ ---------- */
  r.get('/admin/movies', requireStaff('content.view'), asyncH(async (req, res) => {
    const page = clampPage(req.query.page, 1, 100000);
    const size = Math.min(clampPage(req.query.pageSize, 24, 100), 100);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? `%${likeEscape(req.query.q.trim().slice(0, 100))}%` : null;
    const trash = req.query.trash === '1';
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    if (status && !['active', 'draft'].includes(status)) throw new HttpError(422, 'validation', 'สถานะไม่ถูกต้อง');
    const type = typeof req.query.type === 'string' ? req.query.type : null;
    if (type && !(TYPES as readonly string[]).includes(type)) throw new HttpError(422, 'validation', 'ประเภทเนื้อหาไม่ถูกต้อง');
    const cat = req.query.categoryId ? idParam(req.query.categoryId, 'หมวดหมู่') : null;
    const sort = SORTS[typeof req.query.sort === 'string' ? req.query.sort : 'latest'] ?? SORTS.latest;

    const { rows } = await db.query<MovieRow>(
      `${SELECT_MOVIE}
        WHERE (c.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'})
          AND ($1::text IS NULL OR c.title ILIKE $1 ESCAPE '\\' OR c.original_title ILIKE $1 ESCAPE '\\')
          AND ($2::text IS NULL OR (($2 = 'active') = (c.status = 'published')))
          AND ($3::text IS NULL OR c.content_type = $3)
          AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM content_categories x WHERE x.content_id = c.id AND x.category_id = $4))
        ORDER BY ${sort} LIMIT $5 OFFSET $6`,
      [q, status, type, cat, size, (page - 1) * size]);
    const cnt = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM contents c
        WHERE (c.deleted_at IS ${trash ? 'NOT NULL' : 'NULL'})
          AND ($1::text IS NULL OR c.title ILIKE $1 ESCAPE '\\' OR c.original_title ILIKE $1 ESCAPE '\\')
          AND ($2::text IS NULL OR (($2 = 'active') = (c.status = 'published')))
          AND ($3::text IS NULL OR c.content_type = $3)
          AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM content_categories x WHERE x.content_id = c.id AND x.category_id = $4))`,
      [q, status, type, cat]);
    res.json({ items: rows.map(toMovie), total: Number(cnt.rows[0].n), page, pageSize: size });
  }));

  r.get('/admin/movies/:id', requireStaff('content.view'), asyncH(async (req, res) => {
    const m = await getMovie(idParam(req.params.id), true);
    if (!m) throw new HttpError(404, 'not_found', 'ไม่พบหนังเรื่องนี้');
    res.json(toMovie(m));
  }));

  /* ---------- ตรวจ/แปลงข้อมูลจากฟอร์ม ---------- */
  interface Parsed {
    contentType?: (typeof TYPES)[number]; title?: string; titleEn?: string | null; year?: number | null; rating?: number | null;
    duration?: number | null; quality?: (typeof QUALITIES)[number] | null; synopsis?: string | null; director?: string | null;
    cast?: string[]; featured?: boolean; posterUrl?: string | null; backdropUrl?: string | null;
    categoryIds?: number[]; genreIds?: number[]; status?: 'active' | 'draft'; rightsConfirmed?: boolean;
  }

  function parseMovie(b: Record<string, unknown>, creating: boolean): Parsed {
    const p: Parsed = {};
    p.contentType = optEnum(b, 'contentType', 'ประเภทเนื้อหา', TYPES);
    if (creating || 'title' in b) p.title = reqStr(b, 'title', 'ชื่อเรื่อง', 1, 200);
    p.titleEn = optStr(b, 'titleEn', 'ชื่อภาษาอังกฤษ', 200);
    p.year = optInt(b, 'year', 'ปีที่ฉาย', 1888, 2100);
    p.rating = optNum(b, 'rating', 'เรตติ้ง', 0, 10);
    p.duration = optInt(b, 'duration', 'ความยาว (นาที)', 1, 100000);
    if ('quality' in b) {
      if (b.quality === null || b.quality === '') p.quality = null;
      else p.quality = optEnum(b, 'quality', 'คุณภาพ', QUALITIES);
    }
    p.synopsis = optStr(b, 'synopsis', 'เรื่องย่อ', 5000);
    p.director = optStr(b, 'director', 'ผู้กำกับ', 200);
    if ('cast' in b) {
      const c = b.cast;
      if (!Array.isArray(c) || c.length > 30 || c.some((x) => typeof x !== 'string' || x.length > 80)) {
        throw new HttpError(422, 'validation', 'รายชื่อนักแสดงไม่ถูกต้อง');
      }
      p.cast = (c as string[]).map((x) => x.trim()).filter(Boolean);
    }
    p.featured = optBool(b, 'featured');
    for (const [key, label] of [['posterUrl', 'ลิงก์โปสเตอร์'], ['backdropUrl', 'ลิงก์ภาพพื้นหลัง']] as const) {
      const v = optStr(b, key, label, 1000);
      if (v === undefined) continue;
      p[key] = v === null ? null : httpsUrl(v, label);
    }
    p.categoryIds = intIdList(b, 'categoryIds', 'หมวดหมู่');
    p.genreIds = intIdList(b, 'genreIds', 'ประเภท');
    p.status = optEnum(b, 'status', 'สถานะ', ['active', 'draft'] as const);
    p.rightsConfirmed = optBool(b, 'rightsConfirmed');
    return p;
  }

  async function uniqueSlug(c: PoolClient, title: string): Promise<string> {
    const base = slugify(title);
    for (let i = 0; i < 6; i++) {
      const cand = i === 0 ? base : i < 5 ? `${base}-${i + 1}` : `${base}-${randomBytes(3).toString('hex')}`;
      const e = await c.query('SELECT 1 FROM contents WHERE slug = $1', [cand]);
      if (!e.rowCount) return cand;
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }

  async function replaceLinks(c: PoolClient, id: number, p: Parsed): Promise<void> {
    if (p.categoryIds) {
      await c.query('DELETE FROM content_categories WHERE content_id = $1', [id]);
      if (p.categoryIds.length) await c.query('INSERT INTO content_categories (content_id, category_id) SELECT $1, unnest($2::bigint[])', [id, p.categoryIds]);
    }
    if (p.genreIds) {
      await c.query('DELETE FROM content_genres WHERE content_id = $1', [id]);
      if (p.genreIds.length) await c.query('INSERT INTO content_genres (content_id, genre_id) SELECT $1, unnest($2::bigint[])', [id, p.genreIds]);
    }
  }

  const fkToHttp = (e: unknown): never => {
    const code = (e as { code?: string }).code;
    if (code === '23503') throw new HttpError(422, 'validation', 'หมวดหมู่หรือประเภทที่เลือกไม่มีอยู่ในระบบ');
    throw e;
  };

  /* ---------- เพิ่ม ---------- */
  r.post('/admin/movies', requireStaff('content.create'), asyncH(async (req, res) => {
    const staff = req.staff!;
    const p = parseMovie(asObj(req.body), true);
    const wantPublish = p.status === 'active';
    if (wantPublish) {
      if (!staff.permissions.has('content.publish')) throw new HttpError(403, 'forbidden', 'บัญชีของคุณเผยแพร่เองไม่ได้ ให้บันทึกเป็นฉบับร่างแล้วให้เจ้าของยืนยัน');
      if (p.rightsConfirmed !== true) throw new HttpError(422, 'rights_required', 'ต้องติ๊กยืนยันว่ามีสิทธิ์เผยแพร่เรื่องนี้ก่อนเผยแพร่');
    }
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      const slug = await uniqueSlug(c, p.title!);
      const ins = await c.query<{ id: string }>(
        `INSERT INTO contents (content_type, title, original_title, slug, synopsis, release_year, runtime_minutes, rating, quality,
                               director, cast_members, is_featured, poster_source_url, backdrop_source_url,
                               status, published_at, rights_confirmed_by, rights_confirmed_at, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                 $15, CASE WHEN $16 THEN now() END, CASE WHEN $16 THEN $17::bigint END, CASE WHEN $16 THEN now() END, $17, $17)
         RETURNING id`,
        [p.contentType ?? 'movie', p.title, p.titleEn ?? null, slug, p.synopsis ?? null, p.year ?? null, p.duration ?? null,
         p.rating ?? null, p.quality ?? null, p.director ?? null, p.cast ?? [], p.featured ?? false, p.posterUrl ?? null,
         p.backdropUrl ?? null, wantPublish ? 'published' : 'draft', wantPublish, staff.id]);
      const id = Number(ins.rows[0].id);
      await replaceLinks(c, id, p);
      await c.query('COMMIT');
      const created = await getMovie(id);
      await auditEntity(staff.id, 'content.create', 'content', id, null, { title: p.title, published: wantPublish }, req.ip);
      res.status(201).json(toMovie(created!));
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      fkToHttp(e);
    } finally { c.release(); }
  }));

  /* ---------- แก้ไข ---------- */
  r.patch('/admin/movies/:id', requireStaff('content.edit'), asyncH(async (req, res) => {
    const staff = req.staff!;
    const id = idParam(req.params.id);
    const p = parseMovie(asObj(req.body), false);
    const before = await getMovie(id);
    if (!before) throw new HttpError(404, 'not_found', 'ไม่พบหนังเรื่องนี้ (หรืออยู่ในถังขยะ)');

    let publishNow: boolean | undefined;
    if (p.status === 'active' && before.status !== 'published') {
      if (!staff.permissions.has('content.publish')) throw new HttpError(403, 'forbidden', 'บัญชีของคุณเผยแพร่เองไม่ได้ ให้เจ้าของเป็นผู้ยืนยัน');
      if (!before.rights_confirmed && p.rightsConfirmed !== true) throw new HttpError(422, 'rights_required', 'ต้องติ๊กยืนยันว่ามีสิทธิ์เผยแพร่เรื่องนี้ก่อนเผยแพร่');
      publishNow = true;
    } else if (p.status === 'draft' && before.status === 'published') {
      publishNow = false;
    }

    const c = await db.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `UPDATE contents SET
           content_type = COALESCE($2, content_type), title = COALESCE($3, title),
           original_title = CASE WHEN $4 THEN $5 ELSE original_title END,
           synopsis = CASE WHEN $6 THEN $7 ELSE synopsis END,
           release_year = CASE WHEN $8 THEN $9 ELSE release_year END,
           runtime_minutes = CASE WHEN $10 THEN $11 ELSE runtime_minutes END,
           rating = CASE WHEN $12 THEN $13 ELSE rating END,
           quality = CASE WHEN $14 THEN $15 ELSE quality END,
           director = CASE WHEN $16 THEN $17 ELSE director END,
           cast_members = COALESCE($18, cast_members), is_featured = COALESCE($19, is_featured),
           poster_source_url = CASE WHEN $20 THEN $21 ELSE poster_source_url END,
           backdrop_source_url = CASE WHEN $22 THEN $23 ELSE backdrop_source_url END,
           status = CASE WHEN $24::boolean IS TRUE THEN 'published' WHEN $24::boolean IS FALSE THEN 'draft' ELSE status END,
           published_at = CASE WHEN $24::boolean IS TRUE THEN COALESCE(published_at, now()) ELSE published_at END,
           rights_confirmed_by = CASE WHEN $24::boolean IS TRUE AND rights_confirmed_at IS NULL THEN $25::bigint ELSE rights_confirmed_by END,
           rights_confirmed_at = CASE WHEN $24::boolean IS TRUE AND rights_confirmed_at IS NULL THEN now() ELSE rights_confirmed_at END,
           updated_by = $25
         WHERE id = $1 AND deleted_at IS NULL`,
        [id, p.contentType ?? null, p.title ?? null,
         p.titleEn !== undefined, p.titleEn ?? null, p.synopsis !== undefined, p.synopsis ?? null,
         p.year !== undefined, p.year ?? null, p.duration !== undefined, p.duration ?? null,
         p.rating !== undefined, p.rating ?? null, p.quality !== undefined, p.quality ?? null,
         p.director !== undefined, p.director ?? null, p.cast ?? null, p.featured ?? null,
         p.posterUrl !== undefined, p.posterUrl ?? null, p.backdropUrl !== undefined, p.backdropUrl ?? null,
         publishNow ?? null, staff.id]);
      await replaceLinks(c, id, p);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      fkToHttp(e);
    } finally { c.release(); }

    const after = await getMovie(id);
    await auditEntity(staff.id, 'content.update', 'content', id, toMovie(before), toMovie(after!), req.ip);
    res.json(toMovie(after!));
  }));

  /* ---------- ลบ / กู้คืน / ลบถาวร ---------- */
  r.delete('/admin/movies/:id', requireStaff('content.delete'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const u = await db.query(
      `UPDATE contents SET deleted_at = now(), deleted_by = $2, status = 'draft' WHERE id = $1 AND deleted_at IS NULL`,
      [id, req.staff!.id]);
    if (!u.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบหนังเรื่องนี้');
    await auditEntity(req.staff!.id, 'content.trash', 'content', id, null, null, req.ip);
    res.json({ ok: true, message: 'ย้ายเข้าถังขยะแล้ว กู้คืนได้' });
  }));

  r.post('/admin/movies/:id/restore', requireStaff('content.delete'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const u = await db.query(`UPDATE contents SET deleted_at = NULL, deleted_by = NULL, updated_by = $2 WHERE id = $1 AND deleted_at IS NOT NULL`, [id, req.staff!.id]);
    if (!u.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบหนังเรื่องนี้ในถังขยะ');
    await auditEntity(req.staff!.id, 'content.restore', 'content', id, null, null, req.ip);
    res.json({ ok: true, message: 'กู้คืนแล้ว (สถานะเป็นฉบับร่าง ต้องเผยแพร่ใหม่เอง)' });
  }));

  r.delete('/admin/movies/:id/permanent', requireStaff('content.purge'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const before = await getMovie(id, true);
    const u = await db.query('DELETE FROM contents WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
    if (!u.rowCount) throw new HttpError(409, 'not_in_trash', 'ลบถาวรได้เฉพาะรายการที่อยู่ในถังขยะ');
    await auditEntity(req.staff!.id, 'content.purge', 'content', id, before ? toMovie(before) : null, null, req.ip);
    res.json({ ok: true });
  }));

  /* ---------- ลิงก์ดูหนัง ---------- */
  const LINK_COLS = `id, url, link_kind AS "linkKind", quality, audio_language AS "audioLanguage",
                     subtitle_language AS "subtitleLanguage", sort_order AS "sortOrder", is_active AS "isActive",
                     health_status AS "healthStatus", last_checked_at AS "lastCheckedAt"`;

  r.get('/admin/movies/:id/links', requireStaff('content.view'), asyncH(async (req, res) => {
    const { rows } = await db.query(`SELECT ${LINK_COLS} FROM stream_links WHERE content_id = $1 ORDER BY sort_order, id`, [idParam(req.params.id)]);
    res.json({ items: rows });
  }));

  r.post('/admin/movies/:id/links', requireStaff('link.manage'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const b = asObj(req.body);
    const url = httpsUrl(reqStr(b, 'url', 'ลิงก์', 8, 2000), 'ลิงก์');
    const kind = optEnum(b, 'linkKind', 'ชนิดลิงก์', LINK_KINDS);
    if (!kind) throw new HttpError(422, 'validation', 'กรุณาเลือกชนิดลิงก์ (hls / mp4 / embed)');
    const ex = await db.query('SELECT 1 FROM contents WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!ex.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบหนังเรื่องนี้');
    const ins = await db.query<{ id: string }>(
      `INSERT INTO stream_links (content_id, url, link_kind, quality, audio_language, subtitle_language, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [id, url, kind, optStr(b, 'quality', 'คุณภาพ', 20) ?? null, optStr(b, 'audioLanguage', 'ภาษาเสียง', 20) ?? null,
       optStr(b, 'subtitleLanguage', 'ภาษาซับ', 20) ?? null, optInt(b, 'sortOrder', 'ลำดับ', 0, 10000) ?? 0, optBool(b, 'isActive') ?? true]);
    await auditEntity(req.staff!.id, 'link.create', 'stream_link', ins.rows[0].id, null, { contentId: id, kind }, req.ip);
    res.status(201).json({ id: Number(ins.rows[0].id) });
  }));

  r.patch('/admin/movies/:id/links/:linkId', requireStaff('link.manage'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const linkId = idParam(req.params.linkId, 'รหัสลิงก์');
    const b = asObj(req.body);
    let url: string | undefined;
    if ('url' in b) url = httpsUrl(reqStr(b, 'url', 'ลิงก์', 8, 2000), 'ลิงก์');
    const kind = optEnum(b, 'linkKind', 'ชนิดลิงก์', LINK_KINDS);
    const q = optStr(b, 'quality', 'คุณภาพ', 20);
    const active = optBool(b, 'isActive');
    const sort = optInt(b, 'sortOrder', 'ลำดับ', 0, 10000);
    const u = await db.query(
      `UPDATE stream_links SET url = COALESCE($3, url), link_kind = COALESCE($4, link_kind),
              quality = CASE WHEN $5 THEN $6 ELSE quality END, is_active = COALESCE($7, is_active),
              sort_order = COALESCE($8, sort_order),
              health_status = CASE WHEN $3::text IS NOT NULL THEN 'unchecked' ELSE health_status END
        WHERE id = $2 AND content_id = $1`,
      [id, linkId, url ?? null, kind ?? null, q !== undefined, q ?? null, active ?? null, sort ?? null]);
    if (!u.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบลิงก์นี้');
    await auditEntity(req.staff!.id, 'link.update', 'stream_link', linkId, null, { contentId: id }, req.ip);
    res.json({ ok: true });
  }));

  r.delete('/admin/movies/:id/links/:linkId', requireStaff('link.manage'), asyncH(async (req, res) => {
    const id = idParam(req.params.id);
    const linkId = idParam(req.params.linkId, 'รหัสลิงก์');
    const d = await db.query('DELETE FROM stream_links WHERE id = $2 AND content_id = $1', [id, linkId]);
    if (!d.rowCount) throw new HttpError(404, 'not_found', 'ไม่พบลิงก์นี้');
    await auditEntity(req.staff!.id, 'link.delete', 'stream_link', linkId, { contentId: id }, null, req.ip);
    res.json({ ok: true });
  }));

  /* ---------- หมวดหมู่ / ประเภท (ใช้ตัวช่วยร่วมกัน) ---------- */
  function simpleTaxonomy(path: string, table: 'categories' | 'genres', label: string, hasSeo: boolean) {
    const cols = hasSeo
      ? `id, name, slug, sort_order AS "sortOrder", is_active AS "isActive", seo_title AS "seoTitle", seo_description AS "seoDescription"`
      : `id, name, slug, sort_order AS "sortOrder", is_active AS "isActive"`;
    const joinTable = table === 'categories' ? 'content_categories' : 'content_genres';
    const joinCol = table === 'categories' ? 'category_id' : 'genre_id';

    r.get(`/admin/${path}`, requireStaff('content.view'), asyncH(async (_req, res) => {
      const { rows } = await db.query(
        `SELECT ${cols}, (SELECT count(*) FROM ${joinTable} j JOIN contents c ON c.id = j.content_id AND c.deleted_at IS NULL WHERE j.${joinCol} = t.id)::int AS "movieCount"
           FROM ${table} t ORDER BY sort_order, id`);
      res.json({ items: rows });
    }));

    r.post(`/admin/${path}`, requireStaff('category.manage'), asyncH(async (req, res) => {
      const b = asObj(req.body);
      const name = reqStr(b, 'name', `ชื่อ${label}`, 1, 100);
      const slug = slugify(optStr(b, 'slug', 'slug', 80) ?? name);
      try {
        const ins = hasSeo
          ? await db.query<{ id: string }>(
              `INSERT INTO ${table} (name, slug, sort_order, is_active, seo_title, seo_description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
              [name, slug, optInt(b, 'sortOrder', 'ลำดับ', 0, 10000) ?? 0, optBool(b, 'isActive') ?? true,
               optStr(b, 'seoTitle', 'SEO title', 200) ?? null, optStr(b, 'seoDescription', 'SEO description', 400) ?? null])
          : await db.query<{ id: string }>(
              `INSERT INTO ${table} (name, slug, sort_order, is_active) VALUES ($1,$2,$3,$4) RETURNING id`,
              [name, slug, optInt(b, 'sortOrder', 'ลำดับ', 0, 10000) ?? 0, optBool(b, 'isActive') ?? true]);
        await auditEntity(req.staff!.id, `${table}.create`, table, ins.rows[0].id, null, { name }, req.ip);
        res.status(201).json({ id: Number(ins.rows[0].id) });
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new HttpError(409, 'duplicate', `มี${label}ที่ใช้ slug นี้อยู่แล้ว`);
        throw e;
      }
    }));

    r.patch(`/admin/${path}/:id`, requireStaff('category.manage'), asyncH(async (req, res) => {
      const id = idParam(req.params.id);
      const b = asObj(req.body);
      const name = 'name' in b ? reqStr(b, 'name', `ชื่อ${label}`, 1, 100) : null;
      const sort = optInt(b, 'sortOrder', 'ลำดับ', 0, 10000);
      const active = optBool(b, 'isActive');
      const u = await db.query(
        `UPDATE ${table} SET name = COALESCE($2, name), sort_order = COALESCE($3, sort_order), is_active = COALESCE($4, is_active) WHERE id = $1`,
        [id, name, sort ?? null, active ?? null]);
      if (!u.rowCount) throw new HttpError(404, 'not_found', `ไม่พบ${label}`);
      await auditEntity(req.staff!.id, `${table}.update`, table, id, null, { name, sort, active }, req.ip);
      res.json({ ok: true });
    }));

    r.delete(`/admin/${path}/:id`, requireStaff('category.manage'), asyncH(async (req, res) => {
      const id = idParam(req.params.id);
      const used = await db.query<{ n: string }>(`SELECT count(*) AS n FROM ${joinTable} WHERE ${joinCol} = $1`, [id]);
      if (Number(used.rows[0].n) > 0) {
        throw new HttpError(409, 'in_use', `ลบไม่ได้ ยังมีหนัง ${used.rows[0].n} เรื่องใช้${label}นี้อยู่ ให้ย้ายหนังออกก่อนหรือปิดการใช้งานแทน`);
      }
      const d = await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      if (!d.rowCount) throw new HttpError(404, 'not_found', `ไม่พบ${label}`);
      await auditEntity(req.staff!.id, `${table}.delete`, table, id, null, null, req.ip);
      res.json({ ok: true });
    }));
  }

  simpleTaxonomy('categories', 'categories', 'หมวดหมู่', true);
  simpleTaxonomy('genres', 'genres', 'ประเภท', false);

  return r;
}
