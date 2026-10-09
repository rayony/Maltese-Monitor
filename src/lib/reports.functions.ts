import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { Qty, SoupReport } from "@/lib/soup";
import { asQty, clipNote } from "@/lib/soup";

const BRANDS = new Set(["百佳", "Taste", "Fusion", "惠康", "Market Place", "其他"]);

export type ReportInput = {
  brand: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  qty: string;
  note?: string;
  at: string;
};

function asIso(v: unknown) {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function asNum(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function inHongKong(lat: number, lng: number) {
  return lat >= 22.13 && lat <= 22.58 && lng >= 113.8 && lng <= 114.45;
}

function parseReport(input: ReportInput) {
  const brand = String(input?.brand ?? "").trim();
  const name = String(input?.name ?? "").trim().slice(0, 80);
  const address = String(input?.address ?? "").trim().slice(0, 160);
  const qty: Qty | "" = asQty(String(input?.qty ?? ""));
  const lat = Number(input?.lat);
  const lng = Number(input?.lng);
  const note = clipNote(String(input?.note ?? "")).trim();
  if ([...note].length > 50) throw new Error("留言最多 50 個字");
  const at = new Date(String(input?.at ?? ""));
  if (!BRANDS.has(brand)) throw new Error("請揀超市品牌");
  if (!name) throw new Error("請填店舖");
  if (!qty) throw new Error("請揀數量");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inHongKong(lat, lng)) {
    throw new Error("請喺香港地圖上面釘低位置");
  }
  if (Number.isNaN(at.getTime())) throw new Error("請填時間");
  if (at.getTime() > Date.now() + 15 * 60 * 1000) throw new Error("時間唔可以係未來");
  if (at.getTime() < Date.now() - 8 * 24 * 3600 * 1000) throw new Error("只收近 7 日嘅報料");
  return {
    brand,
    name,
    address: address || name,
    lat,
    lng,
    qty,
    note,
    at: at.toISOString(),
  };
}

function toReport(r: {
  id: string;
  brand: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  qty: string;
  note?: string | null;
  at: string | Date;
  filedAt?: string | Date | null;
}): SoupReport {
  return {
    id: String(r.id),
    brand: String(r.brand),
    name: String(r.name),
    address: String(r.address),
    lat: asNum(r.lat),
    lng: asNum(r.lng),
    qty: asQty(r.qty) || "好多",
    note: clipNote(String(r.note ?? "")).trim(),
    at: asIso(r.at),
    filedAt: asIso(r.filedAt ?? r.at),
  };
}

export async function listPublicReports() {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    brand: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    qty: string;
    note: string | null;
    at: string | Date;
    filed_at: string | Date | null;
  }>`
    select id, brand, shop_name as name, address, lat, lng, qty, note, reported_at as at, created_at as filed_at
    from soup_reports
    where reported_at >= now() - interval '7 days'
      and hidden_at is null
    order by reported_at desc, created_at desc
    limit 400
  `;
  return rows.map((row) => toReport({ ...row, filedAt: row.filed_at }));
}

export async function createReport(input: ReportInput) {
  const data = parseReport(input);
  const sql = await getSql();
  const id = crypto.randomUUID();
  const inserted = await sql<{ created_at: string | Date }>`
    insert into soup_reports (id, brand, shop_name, address, lat, lng, qty, note, reported_at)
    values (${id}, ${data.brand}, ${data.name}, ${data.address}, ${data.lat}, ${data.lng}, ${data.qty}, ${data.note}, ${data.at})
    returning created_at
  `;
  await sql`
    delete from soup_reports
    where id in (
      select id from soup_reports
      where brand = ${data.brand} and shop_name = ${data.name} and address = ${data.address}
      order by reported_at desc
      offset 5
    )
  `;
  return { id, ...data, filedAt: asIso(inserted[0]?.created_at ?? new Date()) } satisfies SoupReport;
}

export const listReports = createServerFn({ method: "GET" }).handler(async () => listPublicReports());

export const submitReport = createServerFn({ method: "POST" })
  .validator((input: ReportInput) => parseReport(input))
  .handler(async ({ data }) => createReport(data));
