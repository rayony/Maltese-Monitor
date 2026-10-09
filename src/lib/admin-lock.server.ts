import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { asQty, clipNote } from "@/lib/soup";

const scryptAsync = promisify(scrypt);
const COOKIE = "soup_desk";
const SESSION_MS = 12 * 60 * 60 * 1000;

type Credential = {
  salt: string;
  password_hash: string;
  failures: number;
  locked_until: string | Date | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function cookieSecure() {
  const request = getRequest();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(request.url).protocol === "https:";
}

function writeCookie(token: string, maxAge: number) {
  setCookie(COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    maxAge,
  });
}

async function hashPassword(password: string, salt = randomBytes(16).toString("base64url")) {
  const hash = (await scryptAsync(password.normalize("NFKC"), salt, 32)) as Buffer;
  return { salt, passwordHash: hash.toString("base64url") };
}

async function passwordMatches(password: string, salt: string, expected: string) {
  const hash = (await scryptAsync(password.normalize("NFKC"), salt, 32)) as Buffer;
  const stored = Buffer.from(expected, "base64url");
  if (hash.length !== stored.length) return false;
  return timingSafeEqual(hash, stored);
}

function assertPassword(password: string) {
  const value = password.normalize("NFKC");
  if (value.length < 8) throw new Error("密碼最少 8 個字");
  if (value.length > 72) throw new Error("密碼太長");
  return value;
}

async function credential() {
  const sql = await getSql();
  const rows = await sql<Credential>`
    select salt, password_hash, failures, locked_until
    from admin_credential
    where id = 1
  `;
  return rows[0] ?? null;
}

function locked(row: Credential) {
  if (!row.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export async function readState() {
  const row = await credential();
  return { ready: Boolean(row), signedIn: row ? await validSession() : false };
}

async function validSession() {
  const token = getCookie(COOKIE);
  if (!token) return false;
  const sql = await getSql();
  const rows = await sql<{ ok: boolean }>`
    select true as ok
    from admin_session
    where token_hash = ${sha256(token)} and expires_at > now()
  `;
  return Boolean(rows[0]);
}

export async function requireSession() {
  if (!(await validSession())) throw new Error("請先入密碼");
}

async function startSession() {
  const token = randomBytes(32).toString("base64url");
  const sql = await getSql();
  await sql`delete from admin_session where expires_at <= now()`;
  await sql`
    insert into admin_session (token_hash, expires_at)
    values (${sha256(token)}, ${new Date(Date.now() + SESSION_MS).toISOString()})
  `;
  writeCookie(token, SESSION_MS / 1000);
}

export async function setupPassword(password: string, confirm: string) {
  const value = assertPassword(password);
  if (value !== confirm.normalize("NFKC")) throw new Error("兩次密碼唔同");
  const { salt, passwordHash } = await hashPassword(value);
  const sql = await getSql();
  const inserted = await sql<{ id: number }>`
    insert into admin_credential (id, salt, password_hash)
    select 1, ${salt}, ${passwordHash}
    where not exists (select 1 from admin_credential where id = 1)
    returning id
  `;
  if (!inserted[0]) throw new Error("密碼已經設定咗，請直接登入");
  await startSession();
}

export async function enterPassword(password: string) {
  const row = await credential();
  if (!row) throw new Error("未設定密碼");
  if (locked(row)) throw new Error("試得太多，請 15 分鐘後再試");
  const ok = await passwordMatches(password, row.salt, row.password_hash);
  const sql = await getSql();
  if (!ok) {
    await sql`
      update admin_credential
      set failures = failures + 1,
          locked_until = case when failures + 1 >= 5 then now() + interval '15 minutes' else null end
      where id = 1
    `;
    throw new Error("密碼唔啱");
  }
  await sql`update admin_credential set failures = 0, locked_until = null, updated_at = now() where id = 1`;
  await startSession();
}

export async function leaveDesk() {
  const token = getCookie(COOKIE);
  if (token) {
    const sql = await getSql();
    await sql`delete from admin_session where token_hash = ${sha256(token)}`;
  }
  writeCookie("", 0);
}

export async function changePassword(current: string, next: string, confirm: string) {
  await requireSession();
  const value = assertPassword(next);
  if (value !== confirm.normalize("NFKC")) throw new Error("兩次新密碼唔同");
  const row = await credential();
  if (!row || !(await passwordMatches(current, row.salt, row.password_hash))) throw new Error("而家嘅密碼唔啱");
  const { salt, passwordHash } = await hashPassword(value);
  const sql = await getSql();
  await sql`
    update admin_credential
    set salt = ${salt}, password_hash = ${passwordHash}, failures = 0, locked_until = null, updated_at = now()
    where id = 1
  `;
  await sql`delete from admin_session`;
  await startSession();
}

export type DeskRow = {
  id: string;
  brand: string;
  name: string;
  qty: string;
  note: string;
  at: string;
  filedAt: string;
  hidden: boolean;
};

export async function listDesk(): Promise<DeskRow[]> {
  await requireSession();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    brand: string;
    name: string;
    qty: string;
    note: string | null;
    at: string | Date;
    filed_at: string | Date | null;
    hidden_at: string | Date | null;
  }>`
    select id, brand, shop_name as name, qty, note, reported_at as at, created_at as filed_at, hidden_at
    from soup_reports
    where reported_at >= now() - interval '7 days'
    order by reported_at desc, created_at desc
    limit 200
  `;
  return rows.map((row) => ({
    id: String(row.id),
    brand: String(row.brand),
    name: String(row.name),
    qty: asQty(row.qty) || "好多",
    note: clipNote(String(row.note ?? "")).trim(),
    at: row.at instanceof Date ? row.at.toISOString() : String(row.at),
    filedAt: row.filed_at instanceof Date ? row.filed_at.toISOString() : String(row.filed_at ?? row.at),
    hidden: Boolean(row.hidden_at),
  }));
}

export async function setHidden(id: string, hidden: boolean) {
  await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("搵唔到呢條");
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update soup_reports
    set hidden_at = ${hidden ? new Date().toISOString() : null}
    where id = ${id}
    returning id
  `;
  if (!rows[0]) throw new Error("搵唔到呢條");
}

export async function updateReport(input: { id: string; qty: string; note: string; at: string }) {
  await requireSession();
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("搵唔到呢條");
  const qty = asQty(input.qty);
  if (!qty) throw new Error("請揀數量");
  const note = clipNote(input.note).trim();
  const at = new Date(input.at);
  if (Number.isNaN(at.getTime())) throw new Error("請填時間");
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update soup_reports
    set qty = ${qty}, note = ${note}, reported_at = ${at.toISOString()}
    where id = ${input.id}
    returning id
  `;
  if (!rows[0]) throw new Error("搵唔到呢條");
}
