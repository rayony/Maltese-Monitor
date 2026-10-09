export const GROUPS = [
  { id: "park", label: "百佳 & Taste & Fusion", brands: ["百佳", "Taste", "Fusion"] },
  { id: "well", label: "惠康 & Market Place", brands: ["惠康", "Market Place"] },
  { id: "other", label: "其他", brands: ["其他"] },
] as const;

export type GroupId = (typeof GROUPS)[number]["id"];
export type Qty = "好多" | "好少" | "冇晒";

export type SoupReport = {
  id: string;
  brand: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  qty: Qty;
  note: string;
  at: string;
  filedAt: string;
};

export type SoupPin = {
  key: string;
  lat: number;
  lng: number;
  brand: string;
  name: string;
  address: string;
  qty: Qty;
  history: { at: string; filedAt: string; qty: Qty; note: string }[];
};

export function clipNote(value: string) {
  const clean = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "");
  return [...clean].slice(0, 50).join("");
}

export function asQty(qty: string): Qty | "" {
  if (qty === "好多" || qty === "多貨") return "好多";
  if (qty === "好少" || qty === "少量") return "好少";
  if (qty === "冇晒" || qty === "無貨" || qty === "冇貨") return "冇晒";
  return "";
}

export function qtyChipClass(qty: string) {
  const value = asQty(qty);
  if (value === "好多" || value === "") return "bg-moss text-cream";
  if (value === "冇晒") return "bg-soup text-cream";
  return "bg-yolk text-ink";
}

export function qtyPinClass(qty: Qty) {
  if (qty === "好多") return "is-many";
  if (qty === "冇晒") return "is-none";
  return "is-few";
}

export function groupForBrand(brand: string) {
  return GROUPS.find((group) => (group.brands as readonly string[]).includes(brand)) ?? GROUPS[2];
}

export function inferBrand(groupId: GroupId, text: string) {
  const group = GROUPS.find((item) => item.id === groupId) ?? GROUPS[0];
  const lower = text.toLowerCase();
  const hit = group.brands.find((brand) => brand !== "其他" && lower.includes(brand.toLowerCase()));
  return hit ?? group.brands[0];
}

export function placeKey(r: Pick<SoupReport, "brand" | "name" | "address">) {
  return `${r.brand}|${r.name}|${r.address}`.replace(/\s+/g, "");
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hourCycle: "h23",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${Number(pick("day"))}/${Number(pick("month"))} ${pick("hour")}:${pick("minute")}`;
}

export const RANGE_STOPS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440, 2880, 4320, 5760, 7200, 8640, 10080] as const;

export function rangeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} 分鐘`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小時`;
  return `${Math.round(minutes / 1440)} 日`;
}
