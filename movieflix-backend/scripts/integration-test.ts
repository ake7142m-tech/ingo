/**
 * ทดสอบแบบ end-to-end: เปิดเซิร์ฟเวอร์จริง + ฐานข้อมูล PostgreSQL จริง แล้วยิง HTTP
 * ต้องตั้ง DATABASE_URL ชี้ฐานทดสอบที่รัน SQL ครบทุกไฟล์แล้ว (ห้ามชี้ฐานจริง ข้อมูลจะถูกเพิ่ม/ลบ)
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { loadConfig, createPool } from '../src/config';
import { hashPassword, totpAt } from '../src/crypto';
import { decryptSecret } from '../src/crypto';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}`, extra === undefined ? '' : JSON.stringify(extra)); }
};

class Client {
  cookie = '';
  csrf = '';
  constructor(private readonly base: string) {}
  async call(method: string, path: string, body?: unknown, opts: { noCsrf?: boolean } = {}) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.cookie) headers.Cookie = this.cookie;
    if (this.csrf && !opts.noCsrf) headers['X-CSRF-Token'] = this.csrf;
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.getSetCookie?.() ?? [];
    for (const c of sc) {
      const [kv] = c.split(';');
      if (/Max-Age=0/i.test(c)) this.cookie = ''; else this.cookie = kv;
    }
    const text = await res.text();
    let json: any = undefined;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
    return { status: res.status, json, headers: res.headers, text };
  }
  async login(email: string, password: string, totp?: string) {
    this.cookie = ''; this.csrf = '';
    const r = await this.call('POST', '/auth/login', { email, password, totp }, { noCsrf: true });
    if (r.status === 200) this.csrf = r.json.csrfToken;
    return r;
  }
}

async function main(): Promise<void> {
  const SECRET_KEY = 'sjv2-testkey-SECRET-should-never-leak';
  const env = {
    ...process.env,
    APP_ENC_KEY: '0'.repeat(64).replace(/0/g, 'a'),
    APP_CSRF_SECRET: 'x'.repeat(40),
    SERIESJEEN_API_KEY: SECRET_KEY,
  };

  // เซิร์ฟเวอร์จำลองของ SeriesJeen (ไม่ยิงของจริง)
  const mock = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.startsWith('/api/me')) {
      res.end(JSON.stringify({ daily_quota: { limit: 1000, used: 10, remaining: 990, reset_in_seconds: 100, shared_with_v1: true }, access: [] }));
    } else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
  const mockUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
  (env as Record<string, string>).SERIESJEEN_V1_URL = mockUrl;
  (env as Record<string, string>).SERIESJEEN_V2_URL = mockUrl;

  const cfg = loadConfig(env);
  const db: Pool = createPool(cfg);
  const app = createApp(db, cfg, env);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // ล้างข้อมูลทดสอบเดิม + สร้างเจ้าของ
  await db.query(`TRUNCATE staff_login_attempts, audit_logs, staff_sessions, stream_links, content_categories, content_genres, contents, categories, genres, staff_users RESTART IDENTITY CASCADE`);
  const ownerPw = 'Owner-Passw0rd!x';
  await db.query(`INSERT INTO staff_users (email, display_name, password_hash, role_id) VALUES ('owner@test.local','เจ้าของ',$1,(SELECT id FROM roles WHERE code='owner'))`, [await hashPassword(ownerPw)]);

  const anon = new Client(base);
  const owner = new Client(base);

  console.log('\n[1] ไม่ล็อกอินต้องเข้าไม่ได้');
  for (const [m, p] of [['GET', '/admin/movies'], ['POST', '/admin/movies'], ['GET', '/admin/staff'], ['GET', '/admin/audit-logs'],
    ['GET', '/admin/categories'], ['GET', '/admin/sources/seriesjeen/status']] as const) {
    const r = await anon.call(m, p, m === 'POST' ? { title: 'x' } : undefined);
    check(`${m} ${p} -> 401`, r.status === 401, r.status);
  }
  check('ไม่มีรหัสผ่านฝังในโค้ดฝั่งเซิร์ฟเวอร์ตอบกลับ (login admin/Admin123 ใช้ไม่ได้)', (await anon.login('admin', 'Admin123')).status === 401);

  console.log('\n[2] ล็อกอิน');
  const bad = await owner.login('owner@test.local', 'wrong-password-123');
  const unknown = await anon.login('nobody@test.local', 'wrong-password-123');
  check('รหัสผิด -> 401', bad.status === 401);
  check('ข้อความ error ของ "รหัสผิด" กับ "ไม่มีผู้ใช้" เหมือนกัน (กันเดาอีเมล)', bad.json?.message === unknown.json?.message && bad.status === unknown.status);
  const ok = await owner.login('owner@test.local', ownerPw);
  check('รหัสถูก -> 200', ok.status === 200, ok.json);
  check('cookie เซสชันเป็น HttpOnly + SameSite=Strict', /HttpOnly/i.test(ok.headers.getSetCookie().join(';')) && /SameSite=Strict/i.test(ok.headers.getSetCookie().join(';')));
  check('ตอบสิทธิ์เจ้าของครบ (content.publish, staff.manage)', ok.json?.user?.permissions?.includes('content.publish') && ok.json?.user?.permissions?.includes('staff.manage'));
  check('ไม่ส่ง password_hash กลับ', !/password|hash|scrypt/i.test(ok.text));
  const stored = await db.query(`SELECT token_hash FROM staff_sessions`);
  check('ฐานข้อมูลเก็บเซสชันเป็นค่าแฮช ไม่ใช่โทเคนจริง', stored.rows.length === 1 && !owner.cookie.includes(stored.rows[0].token_hash) && stored.rows[0].token_hash.length === 64);
  const hashRow = await db.query(`SELECT password_hash FROM staff_users WHERE email='owner@test.local'`);
  check('รหัสผ่านเก็บเป็น scrypt hash', hashRow.rows[0].password_hash.startsWith('scrypt$') && !hashRow.rows[0].password_hash.includes(ownerPw));

  console.log('\n[3] CSRF');
  const noCsrf = await owner.call('POST', '/admin/movies', { title: 'ทดสอบ' }, { noCsrf: true });
  check('POST ไม่มี X-CSRF-Token -> 403', noCsrf.status === 403 && noCsrf.json?.error === 'csrf', noCsrf.json);

  console.log('\n[4] เพิ่ม/แก้/เผยแพร่ หนัง');
  const cat = await owner.call('POST', '/admin/categories', { name: 'แอ็กชัน' });
  const gen = await owner.call('POST', '/admin/genres', { name: 'ระทึกขวัญ' });
  check('สร้างหมวดหมู่/ประเภท', cat.status === 201 && gen.status === 201, [cat.json, gen.json]);
  const draft = await owner.call('POST', '/admin/movies', {
    title: 'Extraction 2', titleEn: 'Extraction 2', year: 2023, rating: 7.1, duration: 122, quality: '4K',
    synopsis: 'ทดสอบ', director: 'Sam Hargrave', cast: ['A', 'B'], categoryIds: [cat.json.id], genreIds: [gen.json.id],
    posterUrl: 'https://example.com/p.jpg',
  });
  check('สร้างเป็นฉบับร่าง (201, status=draft)', draft.status === 201 && draft.json.status === 'draft', draft.json);
  check('ตอบหมวดหมู่/ประเภท/รหัส MV', draft.json.category === 'แอ็กชัน' && draft.json.genres[0] === 'ระทึกขวัญ' && /^MV\d{5}$/.test(draft.json.code));
  const mid = draft.json.id;
  const noRights = await owner.call('POST', '/admin/movies', { title: 'X', status: 'active' });
  check('เผยแพร่โดยไม่ยืนยันสิทธิ์ -> 422 rights_required', noRights.status === 422 && noRights.json?.error === 'rights_required', noRights.json);
  const pub = await owner.call('PATCH', `/admin/movies/${mid}`, { status: 'active', rightsConfirmed: true });
  check('เจ้าของยืนยันสิทธิ์แล้วเผยแพร่ได้', pub.status === 200 && pub.json.status === 'active' && pub.json.rightsConfirmed === true, pub.json);
  const dbRow = await db.query(`SELECT rights_confirmed_by FROM contents WHERE id=$1`, [mid]);
  check('บันทึกว่าใครยืนยันสิทธิ์', dbRow.rows[0].rights_confirmed_by === '1' || dbRow.rows[0].rights_confirmed_by === 1);
  let dbBlocked = false;
  try { await db.query(`INSERT INTO contents (content_type,title,slug,status) VALUES ('movie','bypass','bypass-1','published')`); } catch { dbBlocked = true; }
  check('ฐานข้อมูลเองก็กันการเผยแพร่โดยไม่ยืนยันสิทธิ์ (CHECK)', dbBlocked);
  const before = (await db.query(`SELECT view_count FROM contents WHERE id=$1`, [mid])).rows[0].view_count;
  await owner.call('PATCH', `/admin/movies/${mid}`, { title: 'Extraction 2 (แก้)', view_count: 999999, id: 777, deleted_at: null, rights_confirmed_by: 5 });
  const after = (await db.query(`SELECT view_count, id FROM contents WHERE id=$1`, [mid])).rows[0];
  check('ฟิลด์ที่ไม่อนุญาต (view_count, id) แก้ผ่านคำขอไม่ได้', String(after.view_count) === String(before) && String(after.id) === String(mid));
  check('ปีไม่ถูกต้อง -> 422', (await owner.call('POST', '/admin/movies', { title: 'x', year: 99999 })).status === 422);
  check('เรตติ้งเกินช่วง -> 422', (await owner.call('POST', '/admin/movies', { title: 'x', rating: 11 })).status === 422);
  check('ลิงก์โปสเตอร์ http:// -> 422', (await owner.call('POST', '/admin/movies', { title: 'x', posterUrl: 'http://a.com/p.jpg' })).status === 422);
  check('ลิงก์โปสเตอร์ javascript: -> 422', (await owner.call('POST', '/admin/movies', { title: 'x', posterUrl: 'javascript:alert(1)' })).status === 422);
  check('หมวดหมู่ที่ไม่มีอยู่ -> 422', (await owner.call('POST', '/admin/movies', { title: 'x', categoryIds: [9999] })).status === 422);

  console.log('\n[5] ค้นหา / ตัวกรอง / SQL injection');
  const search = await owner.call('GET', '/admin/movies?q=' + encodeURIComponent('Extraction'));
  check('ค้นหาตามชื่อเจอ', search.status === 200 && search.json.items.length === 1 && search.json.total === 1, search.json);
  const inj = await owner.call('GET', '/admin/movies?q=' + encodeURIComponent(`' OR 1=1 --`));
  check('SQL injection ใน q ไม่ได้ผล (ไม่ error ไม่รั่วข้อมูล)', inj.status === 200 && inj.json.items.length === 0);
  const wild = await owner.call('GET', '/admin/movies?q=' + encodeURIComponent('%'));
  check('อักขระ % ถูกมองเป็นตัวอักษร ไม่ใช่ wildcard', wild.status === 200 && wild.json.items.length === 0);
  check('sort ที่ไม่อยู่ในรายการ ไม่ทำให้ error/ฉีด SQL', (await owner.call('GET', '/admin/movies?sort=' + encodeURIComponent('id; DROP TABLE contents'))).status === 200);
  check('ตารางยังอยู่หลังลองฉีด', (await db.query(`SELECT count(*)::int AS n FROM contents`)).rows[0].n >= 1);
  check('กรองสถานะ active เจอเรื่องที่เผยแพร่', (await owner.call('GET', '/admin/movies?status=active')).json.items.length === 1);
  check('กรองสถานะ draft ไม่เจอ', (await owner.call('GET', '/admin/movies?status=draft')).json.items.length === 0);

  console.log('\n[6] ผู้ช่วย: แยกสิทธิ์ที่ฝั่งเซิร์ฟเวอร์');
  const weak = await owner.call('POST', '/admin/staff', { email: 'a@test.local', displayName: 'ผู้ช่วย', role: 'assistant', password: '12345' });
  check('รหัสผ่านอ่อน -> 422', weak.status === 422);
  const mk = await owner.call('POST', '/admin/staff', { email: 'assist@test.local', displayName: 'ผู้ช่วย', role: 'assistant', password: 'Assistant-Pass1!' });
  check('เจ้าของสร้างผู้ช่วยได้', mk.status === 201, mk.json);
  check('สร้างเจ้าของเพิ่มผ่าน API ไม่ได้', (await owner.call('POST', '/admin/staff', { email: 'o2@test.local', displayName: 'x', role: 'owner', password: 'Another-Pass12!' })).status === 422);
  const asst = new Client(base);
  check('ผู้ช่วยล็อกอินได้', (await asst.login('assist@test.local', 'Assistant-Pass1!')).status === 200);
  check('ผู้ช่วยไม่เห็นหน้าจัดการผู้ดูแล -> 403', (await asst.call('GET', '/admin/staff')).status === 403);
  check('ผู้ช่วยไม่เห็นบันทึกการใช้งาน -> 403', (await asst.call('GET', '/admin/audit-logs')).status === 403);
  const aDraft = await asst.call('POST', '/admin/movies', { title: 'หนังของผู้ช่วย' });
  check('ผู้ช่วยสร้างฉบับร่างได้', aDraft.status === 201);
  const aPub = await asst.call('POST', '/admin/movies', { title: 'พยายามเผยแพร่', status: 'active', rightsConfirmed: true });
  check('ผู้ช่วยเผยแพร่เองไม่ได้ (ต่อให้ส่ง rightsConfirmed) -> 403', aPub.status === 403, aPub.json);
  check('ผู้ช่วยแก้เป็นเผยแพร่ไม่ได้ -> 403', (await asst.call('PATCH', `/admin/movies/${aDraft.json.id}`, { status: 'active', rightsConfirmed: true })).status === 403);
  const aDel = await asst.call('DELETE', `/admin/movies/${aDraft.json.id}`);
  check('ผู้ช่วยลบเข้าถังขยะได้', aDel.status === 200);
  check('ผู้ช่วยลบถาวรไม่ได้ -> 403', (await asst.call('DELETE', `/admin/movies/${aDraft.json.id}/permanent`)).status === 403);
  check('ผู้ช่วยดูแหล่งข้อมูล SeriesJeen ได้ (source.view)', (await asst.call('GET', '/admin/sources/seriesjeen/status')).status === 200);

  console.log('\n[7] ถังขยะ');
  const trash = await owner.call('GET', '/admin/movies?trash=1');
  check('รายการในถังขยะเห็นเรื่องที่ลบ', trash.json.items.length === 1 && trash.json.items[0].title === 'หนังของผู้ช่วย');
  check('ลบถาวรเรื่องที่ยังไม่อยู่ในถังขยะ -> 409', (await owner.call('DELETE', `/admin/movies/${mid}/permanent`)).status === 409);
  const restored = await owner.call('POST', `/admin/movies/${aDraft.json.id}/restore`);
  check('กู้คืนจากถังขยะได้', restored.status === 200);
  await owner.call('DELETE', `/admin/movies/${aDraft.json.id}`);
  check('เจ้าของลบถาวรจากถังขยะได้', (await owner.call('DELETE', `/admin/movies/${aDraft.json.id}/permanent`)).status === 200);
  check('หนังที่ลบเข้าถังขยะไม่โผล่ในรายการปกติ', (await owner.call('GET', '/admin/movies')).json.items.every((m: any) => m.id !== aDraft.json.id));

  console.log('\n[8] ลิงก์ดูหนัง');
  check('ลิงก์ http:// ถูกปฏิเสธ', (await owner.call('POST', `/admin/movies/${mid}/links`, { url: 'http://x.com/a.m3u8', linkKind: 'hls' })).status === 422);
  const lk = await owner.call('POST', `/admin/movies/${mid}/links`, { url: 'https://cdn.example.com/a.m3u8', linkKind: 'hls', quality: '1080p' });
  check('เพิ่มลิงก์ https ได้', lk.status === 201, lk.json);
  check('ผู้ช่วยแก้ลิงก์ได้ (link.manage)', (await asst.call('PATCH', `/admin/movies/${mid}/links/${lk.json.id}`, { quality: '720p' })).status === 200);
  check('ลิงก์ของหนังอื่นแก้ผ่านรหัสหนังที่ไม่ตรงไม่ได้ -> 404', (await owner.call('PATCH', `/admin/movies/99999/links/${lk.json.id}`, { quality: '1' })).status === 404);

  console.log('\n[9] หมวดหมู่ที่ถูกใช้อยู่ลบไม่ได้');
  const delCat = await owner.call('DELETE', `/admin/categories/${cat.json.id}`);
  check('ลบหมวดหมู่ที่มีหนังใช้อยู่ -> 409', delCat.status === 409, delCat.json);

  console.log('\n[10] ล็อกบัญชีเมื่อใส่รหัสผิดซ้ำ');
  await owner.call('POST', '/admin/staff', { email: 'lock@test.local', displayName: 'ทดสอบล็อก', role: 'viewer', password: 'Viewer-Pass123!' });
  const lockClient = new Client(base);
  let last = 0;
  for (let i = 0; i < 5; i++) last = (await lockClient.login('lock@test.local', 'wrong-pass-' + i)).status;
  check('ใส่ผิด 5 ครั้งยังได้ 401', last === 401);
  const afterLock = await lockClient.login('lock@test.local', 'Viewer-Pass123!');
  check('หลังโดนล็อก ต่อให้รหัสถูกก็เข้าไม่ได้ (429)', afterLock.status === 429, afterLock.json);

  console.log('\n[11] ยืนยัน 2 ชั้น (TOTP)');
  const setup = await owner.call('POST', '/auth/totp/setup');
  check('ขอตั้งค่า 2FA ได้ secret', setup.status === 200 && /^[A-Z2-7]{32}$/.test(setup.json.secret), setup.json);
  const enc = (await db.query(`SELECT totp_secret_enc FROM staff_users WHERE email='owner@test.local'`)).rows[0].totp_secret_enc as string;
  check('secret ถูกเข้ารหัสในฐานข้อมูล (ไม่ใช่ข้อความดิบ)', !enc.includes(setup.json.secret) && decryptSecret(enc, cfg.encKey) === setup.json.secret);
  const step = Math.floor(Date.now() / 30000);
  check('รหัส 2FA ผิดเปิดใช้ไม่ได้ (422)', (await owner.call('POST', '/auth/totp/enable', { code: '000000' })).status === 422);
  const en = await owner.call('POST', '/auth/totp/enable', { code: totpAt(setup.json.secret, step) });
  check('เปิด 2FA ด้วยรหัสที่ถูก', en.status === 200, en.json);
  const noTotp = await new Client(base).login('owner@test.local', ownerPw);
  check('ล็อกอินโดยไม่ใส่รหัส 2FA -> 401 totp_required', noTotp.status === 401 && noTotp.json?.error === 'totp_required', noTotp.json);
  const replay = await new Client(base).login('owner@test.local', ownerPw, totpAt(setup.json.secret, step));
  check('ใช้รหัส 2FA ซ้ำ (ที่เพิ่งใช้เปิด) ไม่ได้', replay.status === 401, replay.json);
  const good = await new Client(base).login('owner@test.local', ownerPw, totpAt(setup.json.secret, step + 1));
  check('รหัส 2FA ช่วงถัดไปล็อกอินได้', good.status === 200, good.json);

  console.log('\n[12] ออกจากระบบ + เปลี่ยนรหัสผ่าน');
  const sess = new Client(base);
  await sess.login('assist@test.local', 'Assistant-Pass1!');
  const savedCookie = sess.cookie;
  check('ออกจากระบบ', (await sess.call('POST', '/auth/logout')).status === 200);
  const reuse = new Client(base); reuse.cookie = savedCookie;
  check('เซสชันเก่าหลังออกจากระบบใช้ไม่ได้ (401)', (await reuse.call('GET', '/auth/me')).status === 401);
  const c2 = new Client(base);
  await c2.login('assist@test.local', 'Assistant-Pass1!');
  const other = new Client(base);
  await other.login('assist@test.local', 'Assistant-Pass1!');
  check('เปลี่ยนรหัสผ่านด้วยรหัสเดิมผิด -> 401', (await c2.call('POST', '/auth/change-password', { currentPassword: 'nope', newPassword: 'New-Assistant-9x!' })).status === 401);
  check('เปลี่ยนรหัสผ่านสำเร็จ', (await c2.call('POST', '/auth/change-password', { currentPassword: 'Assistant-Pass1!', newPassword: 'New-Assistant-9x!' })).status === 200);
  check('เครื่องอื่นที่ล็อกอินค้างถูกเตะออก', (await other.call('GET', '/auth/me')).status === 401);
  check('เครื่องที่เปลี่ยนรหัสยังใช้งานต่อได้', (await c2.call('GET', '/auth/me')).status === 200);
  check('รหัสเก่าใช้ไม่ได้แล้ว', (await new Client(base).login('assist@test.local', 'Assistant-Pass1!')).status === 401);

  console.log('\n[13] SeriesJeen: คีย์ไม่รั่ว + ต้องล็อกอิน');
  const st = await owner.call('GET', '/admin/sources/seriesjeen/status');
  check('สถานะ SeriesJeen ตอบได้ (ผ่านเซิร์ฟเวอร์)', st.status === 200, st.text.slice(0, 200));
  check('ไม่มีคีย์ API ในคำตอบ', !st.text.includes(SECRET_KEY));
  const sync = await asst.call('POST', '/admin/sources/seriesjeen/v2/sync-platforms');
  check('เซสชันผู้ช่วยถูกเพิกถอนหลังเปลี่ยนรหัสผ่าน จึงเรียกเส้นซิงก์ไม่ได้ (401)', sync.status === 401, sync.status);
  check('ผู้ชมที่ไม่ล็อกอินเรียกเส้นซิงก์ไม่ได้ -> 401', (await anon.call('POST', '/admin/sources/seriesjeen/v2/sync-platforms')).status === 401);

  console.log('\n[14] บันทึกการใช้งาน');
  const logs = await owner.call('GET', '/admin/audit-logs?pageSize=200');
  const actions = new Set((logs.json.items as any[]).map((x) => x.action));
  for (const a of ['auth.login', 'content.create', 'content.update', 'content.trash', 'content.purge', 'content.restore', 'link.create', 'staff.create', 'auth.denied', 'auth.totp_enabled', 'auth.password_changed']) {
    check(`audit มี ${a}`, actions.has(a));
  }
  const upd = (logs.json.items as any[]).find((x) => x.action === 'content.update');
  check('audit เก็บค่าก่อน/หลังแก้', !!upd?.before && !!upd?.after);
  check('บันทึกความพยายามล็อกอินที่ล้มเหลว', (await db.query(`SELECT count(*)::int AS n FROM staff_login_attempts WHERE success=false`)).rows[0].n >= 5);

  console.log('\n[15] ข้อผิดพลาดไม่รั่วรายละเอียดภายใน');
  const badJson = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  const bjText = await badJson.text();
  check('JSON เสียตอบ 400 โดยไม่มี stack', badJson.status === 400 && !/at |node_modules|\.js:/.test(bjText), bjText);
  const nf = await anon.call('GET', '/nope');
  check('เส้นที่ไม่มี -> 404 ภาษาไทย', nf.status === 404 && typeof nf.json?.message === 'string');
  check('ไม่มีหัว X-Powered-By', anon.cookie === '' && (await fetch(base + '/healthz')).headers.get('x-powered-by') === null);

  console.log(`\nสรุป: ผ่าน ${passed} ไม่ผ่าน ${failed}`);
  server.close(); mock.close(); await db.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ทดสอบล้มเหลว:', e); process.exit(2); });
