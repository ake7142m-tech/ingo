/**
 * เครื่องมือด้านความปลอดภัย ใช้เฉพาะ node:crypto (ไม่พึ่งแพ็กเกจเสริม)
 *  - แฮชรหัสผ่านด้วย scrypt (ถอดกลับไม่ได้)
 *  - โทเคนเซสชันสุ่ม 256 บิต เก็บในฐานข้อมูลเป็นค่าแฮชเท่านั้น
 *  - รหัสยืนยัน 2 ชั้น (TOTP, RFC 6238) และเข้ารหัส secret ก่อนเก็บ (AES-256-GCM)
 */
import {
  createCipheriv, createDecipheriv, createHash, createHmac,
  randomBytes, scrypt, timingSafeEqual,
} from 'node:crypto';

/* ---------------- รหัสผ่าน ---------------- */

const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 128 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, o: { N: number; r: number; p: number; keylen: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: SCRYPT.maxmem }, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), {
    N: Number(n), r: Number(r), p: Number(p), keylen: expected.length,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** ใช้ตอนไม่พบผู้ใช้ เพื่อให้เวลาตอบใกล้เคียงกับกรณีมีผู้ใช้ (กันเดาว่าอีเมลมีอยู่จริง) */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordTime(password: string): Promise<void> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(password, await dummyHash);
}

/** นโยบายรหัสผ่าน: อย่างน้อย 12 ตัว ไม่ใช่รหัสยอดนิยม และมีอย่างน้อย 2 ชนิดตัวอักษร */
export function checkPasswordPolicy(pw: string): string | null {
  if (pw.length < 12) return 'รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร';
  if (pw.length > 200) return 'รหัสผ่านยาวเกินไป';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 2) return 'รหัสผ่านต้องมีตัวอักษรอย่างน้อย 2 ชนิด (พิมพ์เล็ก/ใหญ่/ตัวเลข/สัญลักษณ์)';
  const common = ['password', 'admin123', '123456789012', 'qwertyuiop12', 'iloveyou1234'];
  if (common.some((c) => pw.toLowerCase().includes(c))) return 'รหัสผ่านเดาง่ายเกินไป';
  return null;
}

/* ---------------- โทเคน ---------------- */

export const newToken = (): string => randomBytes(32).toString('base64url');
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export function csrfFor(sessionToken: string, secret: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionToken}`).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/* ---------------- TOTP ---------------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('invalid base32');
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

export function totpAt(secretB32: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secretB32)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const code = (h.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

/** คืน step ที่ตรง (หรือ null) รับคลาดเคลื่อน ±1 ช่วง (30 วินาที) */
export function verifyTotp(secretB32: string, code: string, nowMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const cur = Math.floor(nowMs / 30000);
  for (const d of [0, -1, 1]) {
    if (safeEqual(totpAt(secretB32, cur + d), code)) return cur + d;
  }
  return null;
}

export const otpauthUrl = (secret: string, account: string, issuer: string): string =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;

/* ---------------- เข้ารหัส secret ที่เก็บในฐานข้อมูล ---------------- */

function key32(hex: string): Buffer {
  const k = Buffer.from(hex, 'hex');
  if (k.length !== 32) throw new Error('APP_ENC_KEY ต้องเป็น hex 64 ตัวอักษร (32 ไบต์)');
  return k;
}

export function encryptSecret(plain: string, hexKey: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key32(hexKey), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(blob: string, hexKey: string): string {
  const [v, iv, tag, enc] = blob.split('.');
  if (v !== 'v1') throw new Error('unknown secret format');
  const d = createDecipheriv('aes-256-gcm', key32(hexKey), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}
